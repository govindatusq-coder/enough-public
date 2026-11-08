'use client';
import {useState} from 'react';
import {apiSend} from '@/lib/bear/client';
import type {LoadView} from '@/lib/bear/load/view';
import {friendlyDate} from '@/lib/bear/load/words';
import {todayISO} from '@/lib/bear/domain/dates';
import {Button} from './ui';

// What an item means for the person, in the order that matters: what needs you now, what Bear
// has covered, what Bear is waiting on, and what is coming up. Built from the existing glass card,
// eyebrow, button and chip styles; the full plan stays behind the scenes.
export function LoadPanel({taskId,view,onChanged,onNeedInfo,onSaid,readOnly,hideComingUp}:{taskId:string;view:LoadView;onChanged:(done:boolean)=>void;onNeedInfo?:()=>void;onSaid?:(s:string)=>void;readOnly?:boolean;hideComingUp?:boolean}){
 const [busy,setBusy]=useState(false);const today=todayISO();const [prep,setPrep]=useState(false);
 async function copy(text:string,label:string){try{await navigator.clipboard.writeText(text);onSaid?.(`${label} copied.`);}catch{onSaid?.(`${label}: ${text}`);}}
 const need=view.needsYou;
 async function act(evidence?:string){if(!need)return;
  // Bear is asking for a fact (a date, an amount): the edit sheet is where facts go.
  if(need.kind==='information'&&need.stepId.includes(':need_')&&onNeedInfo){onNeedInfo();return;}
  setBusy(true);try{const r=await apiSend<{said:string;done:boolean}>(`/api/bear/tasks/${taskId}/load`,{stepId:need.stepId,evidence:evidence??null});onSaid?.(r.said);onChanged(r.done);}catch(e){onSaid?.((e as Error).message);}finally{setBusy(false);}}
 return (
  <section className="glass load-panel" aria-label="What Bear has" style={{padding:16,marginTop:14}}>
   <p className="eyebrow teal" style={{marginBottom:4}}>{view.state==='resolved'?'Sorted':view.state==='waiting'?'Waiting':'Bear’s got this'}</p>
   <p style={{fontWeight:700,fontSize:19}}>{view.headline}</p>
   {need?<div className="load-need" style={{marginTop:12,padding:14,borderRadius:'var(--r-md)',background:'var(--blush-tint)'}}>
    <p className="eyebrow" style={{marginBottom:4,color:'#B42318'}}>One thing needs you</p>
    <p style={{fontWeight:700,fontSize:17}}>{need.headline}</p>
    {need.dueAt&&!/\b(due|by)\b/i.test(need.headline)&&<p className="small muted" style={{marginTop:2}}>By {friendlyDate(need.dueAt,today)}</p>}
    {!readOnly&&<div className="btn-row" style={{marginTop:10}}>{need.choices?.length?need.choices.map((c,i)=><Button key={c.evidence} className="sm" variant={i===0?'primary':'ghost'} disabled={busy} onClick={()=>act(c.evidence)}>{c.label}</Button>):<Button className="sm" variant="primary" disabled={busy} onClick={()=>act()}>{need.cta}</Button>}</div>}
   </div>:view.state!=='resolved'&&<p className="small" style={{marginTop:8,fontWeight:600,color:'#0d7a71'}}>Nothing for you to do right now.</p>}
   {/* Bear's preparation: the details the person needs, collapsed until they want them. Links open the
       school's own page; Bear never pays, submits or books anything itself. */}
   {view.prepared&&view.prepared.length>0&&<div className="load-prep" style={{marginTop:12}}>
    <button type="button" className="one-thing-link why-toggle" aria-expanded={prep} aria-controls={`prep-${taskId}`} onClick={()=>setPrep(v=>!v)}>Bear’s preparation <span aria-hidden="true" className={`why-chev ${prep?'open':''}`}>⌄</span></button>
    {prep&&<div id={`prep-${taskId}`} className="prep-list">{view.prepared.map(p=><div key={p.key} className="prep-row">
     <p className="small"><strong>{p.done?'✓ ':''}{p.label}</strong><br/><span className="muted">{p.value}</span></p>
     <div className="prep-actions">{p.href&&<a className="btn ghost sm" href={p.href} target="_blank" rel="noopener noreferrer">Open</a>}{p.copy&&<button type="button" className="btn ghost sm" onClick={()=>copy(p.copy!,p.key==='payment'?'Reference':'Code')}>Copy {p.key==='payment'?'reference':'code'}</button>}</div>
    </div>)}</div>}
   </div>}
   {view.covered.length>0&&<div style={{marginTop:14}}><p className="eyebrow" style={{marginBottom:4}}>Bear has it covered</p>{view.covered.map(l=><p key={l} className="small" style={{marginTop:2}}>· {l}</p>)}</div>}
   {view.waiting.length>0&&<div style={{marginTop:14}}><p className="eyebrow" style={{marginBottom:4}}>Waiting for</p>{view.waiting.map(w=><p key={w.who} className="small" style={{marginTop:2}}>{w.line}</p>)}</div>}
   {view.comingUp.length>0&&!hideComingUp&&<div style={{marginTop:14}}><p className="eyebrow" style={{marginBottom:4}}>Coming up</p>{view.comingUp.map(c=><p key={c.line} className="small muted" style={{marginTop:2}}>{c.line}</p>)}</div>}
  </section>
 );
}
