'use client';
import {useState} from 'react';
import {apiSend,type ApiError} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';

// What every card Bear shows in the chat can do: go into the calendar, and (after "Change something") be renamed, re-dated,
// moved to another area, given another traffic light, or removed. Changes save straight away.
export type Light='red'|'amber'|'green';
export interface CardChange{title?:string;deadline?:string|null;when?:string;light?:Light;area?:string;removed?:boolean}
const AREAS=[['work','Work'],['family','Family'],['home','Home'],['money','Money'],['health','Health'],['me','Me']] as const;
const LIGHTS=[{light:'red' as const,dot:'🔴',label:'Urgent'},{light:'amber' as const,dot:'🟠',label:'Coming up'},{light:'green' as const,dot:'🟢',label:'Can wait'}];
const pad=(n:number)=>String(n).padStart(2,'0');
const esc=(s:string)=>s.replace(/[\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
export interface Hold{title:string;start:string;end:string|null;all_day:boolean;location:string|null}
// A calendar file for the event (or, with no event time, an all-day entry on the due date). It opens in the person's own calendar.
export function icsHref(h:Hold){
 const allDay=h.all_day||!h.start.includes('T');const day=(s:string)=>s.slice(0,10).replace(/-/g,'');const at=(s:string)=>s.replace(/[-:]/g,'').slice(0,13)+'00';
 const next=(d:string)=>{const x=new Date(d.slice(0,10)+'T12:00:00');x.setDate(x.getDate()+1);return `${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}`;};
 const start=allDay?day(h.start):at(h.start);
 const end=h.end?(allDay?day(h.end):at(h.end)):allDay?next(h.start):(()=>{const d=new Date(h.start);d.setHours(d.getHours()+1);return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;})();
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Load Bear//EN','BEGIN:VEVENT',`UID:${Date.now()}-${Math.random().toString(36).slice(2)}@loadbear`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
  allDay?`DTSTART;VALUE=DATE:${start}`:`DTSTART:${start}`,allDay?`DTEND;VALUE=DATE:${end}`:`DTEND:${end}`,`SUMMARY:${esc(h.title)}`,...(h.location?[`LOCATION:${esc(h.location)}`]:[]),'END:VEVENT','END:VCALENDAR'];
 return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(lines.join('\r\n'));
}
// Saved tasks get the file from the server (iPhones open a served calendar file and offer "Add"; they ignore one built inside
// the page). Only something not yet saved falls back to a file made here.
export function CalendarButton({title,deadline,hold,taskId}:{title:string;deadline:string|null;hold?:Hold|null;taskId?:string|null}){
 if(taskId&&deadline)return <a className="chip sm" href={`/api/bear/tasks/${taskId}/ics`}>Add to calendar</a>;
 const h=hold||(deadline?{title,start:deadline,end:null,all_day:true,location:null}:null);if(!h)return null;
 return <a className="chip sm" href={icsHref(h)} download={`${h.title.replace(/[^\w ]+/g,'').slice(0,40)||'event'}.ics`}>Add to calendar</a>;
}
const whenFor=(d:string|null)=>d?`Due ${formatAU(d,'short')}`:'No date';
export function CardEditor({taskId,title,deadline,light,area,onChange}:{taskId:string;title:string;deadline:string|null;light:Light;area:string;onChange:(c:CardChange)=>void}){
 const [t,setT]=useState(title);const [d,setD]=useState(deadline||'');const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 async function run(fn:()=>Promise<void>){setBusy(true);setErr(null);try{await fn();}catch(e){setErr((e as ApiError).message||'That didn’t save. Try again.');}finally{setBusy(false);}}
 const sort=(patch:Record<string,string>)=>run(async()=>{const r=await apiSend<{changed:{light:Light;domain:string;when:string}|null}>('/api/bear/sort',{taskIds:[taskId],taskId,...patch},'PATCH');if(r.changed)onChange({light:r.changed.light,area:r.changed.domain,when:r.changed.when});});
 const dirty=t.trim()!==title||(d||null)!==(deadline||null);
 return <div className="ce" role="group" aria-label={`Change ${title}`}>
  <label className="ce-field">What<input value={t} onChange={e=>setT(e.target.value)} maxLength={120}/></label>
  <label className="ce-field">Due<input type="date" value={d} onChange={e=>setD(e.target.value)}/></label>
  {dirty&&<button type="button" className="btn coral sm" disabled={busy||!t.trim()} onClick={()=>run(async()=>{await apiSend(`/api/bear/tasks/${taskId}`,{title:t.trim(),dueAt:d||null},'PATCH');onChange({title:t.trim(),deadline:d||null,when:whenFor(d||null)});})}>Save</button>}
  <span className="qc-lights" role="group" aria-label="How soon">{LIGHTS.map(x=><button key={x.light} type="button" className="chip sm" aria-pressed={light===x.light} disabled={busy} onClick={()=>sort({light:x.light})}><span aria-hidden="true">{x.dot}</span> {x.label}</button>)}</span>
  <span className="ce-row"><label className="sr-only" htmlFor={`ce-area-${taskId}`}>Area</label>
   <select id={`ce-area-${taskId}`} className="qc-select" value={area} disabled={busy} onChange={e=>sort({domain:e.target.value})}>{AREAS.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select>
   <button type="button" className="qc-link ce-remove" disabled={busy} onClick={()=>run(async()=>{await apiSend(`/api/bear/tasks/${taskId}/drop`,{});onChange({removed:true});})}>Remove</button></span>
  {err&&<span className="tc-blocker" role="alert">{err}</span>}
 </div>;
}
