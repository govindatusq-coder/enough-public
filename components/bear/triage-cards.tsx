'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';

// The action cards from triage: what Bear found, what it already prepared, and one tap to use each draft. Bear never sends:
// every button opens the person's own email, messages or calendar with the draft filled in.
export interface Payload{email:{to:string|null;subject:string;body:string}|null;sms:{to:string|null;body:string}|null;calendar_hold:{title:string;start:string;end:string|null;all_day:boolean;location:string|null}|null;shopping_list:string[]|null;steps:string[]|null}
export interface TriageCardView{card_id:string;family_member:string|null;action_type:string;urgency:'red'|'amber'|'green';hard_deadline:string|null;card_headline:string;ai_work_completed:string;execution_payload:Payload;confidence_score:number;missing_blocker:string|null;taskId:string|null;area:string;when:string;already:boolean}
export interface TriageView{reasoning:string;summary:string;cards:TriageCardView[]}
const areaLabel:Record<string,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
const groups=[{light:'red',dot:'🔴',label:'Urgent'},{light:'amber',dot:'🟠',label:'Coming up'},{light:'green',dot:'🟢',label:'Can wait'}] as const;

// Debug view (the model's reasoning) is for the owner: on with ?debug=1, off with ?debug=0, remembered on this device.
const DEBUG_KEY='bear-debug';
const debugOn=()=>{try{return localStorage.getItem(DEBUG_KEY)==='1';}catch{return false;}};
const subscribe=(cb:()=>void)=>{window.addEventListener('storage',cb);return()=>window.removeEventListener('storage',cb);};
export function useDebug(){
 useEffect(()=>{try{const q=new URLSearchParams(location.search).get('debug');if(q==='1'||q==='0'){localStorage.setItem(DEBUG_KEY,q);window.dispatchEvent(new StorageEvent('storage'));}}catch{/* no storage */}},[]);
 return useSyncExternalStore(subscribe,debugOn,()=>false);
}

// The steps shown while Bear reads. They move on a timer (the reading is one request), so they show progress, not a promise.
const STEPS=['Reading layout & dates…','Matching family profile…','Drafting 90% done cards…'];
export function TriageProgress(){
 const [step,setStep]=useState(0);
 useEffect(()=>{const a=setTimeout(()=>setStep(1),5000),b=setTimeout(()=>setStep(2),12000);return()=>{clearTimeout(a);clearTimeout(b);};},[]);
 return <ol className="qc-reply qc-progress" aria-live="polite">{STEPS.map((s,i)=><li key={s} className={i<step?'done':i===step?'now':''}><span aria-hidden="true">{i<step?'✓':i===step?'•':'○'}</span> {s}</li>)}</ol>;
}

const pad=(n:number)=>String(n).padStart(2,'0');
const icsDate=(s:string,allDay:boolean)=>allDay?s.slice(0,10).replace(/-/g,''):s.replace(/[-:]/g,'').slice(0,13)+'00';
const nextDay=(d:string)=>{const x=new Date(d.slice(0,10)+'T12:00:00');x.setDate(x.getDate()+1);return `${x.getFullYear()}${pad(x.getMonth()+1)}${pad(x.getDate())}`;};
const esc=(s:string)=>s.replace(/[\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
function icsHref(h:NonNullable<Payload['calendar_hold']>){
 const allDay=h.all_day||!h.start.includes('T');const start=icsDate(h.start,allDay);
 const end=h.end?icsDate(h.end,allDay):allDay?nextDay(h.start):(()=>{const d=new Date(h.start);d.setHours(d.getHours()+1);return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;})();
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Load Bear//EN','BEGIN:VEVENT',`UID:${Date.now()}-${Math.random().toString(36).slice(2)}@loadbear`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').slice(0,15)}Z`,
  allDay?`DTSTART;VALUE=DATE:${start}`:`DTSTART:${start}`,allDay?`DTEND;VALUE=DATE:${end}`:`DTEND:${end}`,`SUMMARY:${esc(h.title)}`,...(h.location?[`LOCATION:${esc(h.location)}`]:[]),'END:VEVENT','END:VCALENDAR'];
 return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(lines.join('\r\n'));
}
const mailto=(e:NonNullable<Payload['email']>)=>`mailto:${encodeURIComponent(e.to||'')}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
const smsHref=(s:NonNullable<Payload['sms']>)=>`sms:${encodeURIComponent(s.to||'')}${/iPhone|iPad/.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'&':'?'}body=${encodeURIComponent(s.body)}`;
async function copy(text:string){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}

function Card({c,reasoning,debug}:{c:TriageCardView;reasoning:string;debug:boolean}){
 const p=c.execution_payload;const [copied,setCopied]=useState<string|null>(null);
 const did=async(what:string,text:string)=>{if(await copy(text)){setCopied(what);setTimeout(()=>setCopied(null),1800);}};
 return <li className="qc-card tc-card">
  {c.taskId?<Link className="qc-title" href={`/bear/tasks/${c.taskId}`}>{c.card_headline}</Link>:<span className="qc-title">{c.card_headline}</span>}
  <span className="qc-meta"><span className="qc-area">{areaLabel[c.area]||c.area}</span>{c.family_member?` · ${c.family_member}`:''} · {c.when}{c.already?' · Already on my list':''}</span>
  {c.ai_work_completed&&<span className="tc-work">{c.ai_work_completed}</span>}
  {p.email&&<details className="tc-draft"><summary>Email draft{p.email.to?` to ${p.email.to}`:''}</summary><p className="tc-subject">{p.email.subject}</p><p className="tc-body">{p.email.body}</p>
   <span className="tc-actions"><a className="chip sm" href={mailto(p.email)}>Open in email</a><button type="button" className="chip sm" onClick={()=>did('email',`${p.email!.subject}\n\n${p.email!.body}`)}>{copied==='email'?'Copied':'Copy'}</button></span></details>}
  {p.sms&&<details className="tc-draft"><summary>Text message{p.sms.to?` to ${p.sms.to}`:''}</summary><p className="tc-body">{p.sms.body}</p>
   <span className="tc-actions"><a className="chip sm" href={smsHref(p.sms)}>Open in Messages</a><button type="button" className="chip sm" onClick={()=>did('sms',p.sms!.body)}>{copied==='sms'?'Copied':'Copy'}</button></span></details>}
  {p.calendar_hold&&<span className="tc-actions"><a className="chip sm" href={icsHref(p.calendar_hold)} download={`${p.calendar_hold.title.replace(/[^\w ]+/g,'').slice(0,40)||'event'}.ics`}>Add to calendar</a></span>}
  {p.shopping_list?.length?<details className="tc-draft"><summary>To buy or pack ({p.shopping_list.length})</summary><ul className="tc-list">{p.shopping_list.map((s,i)=><li key={i}>{s}</li>)}</ul>
   <span className="tc-actions"><button type="button" className="chip sm" onClick={()=>did('list',p.shopping_list!.join('\n'))}>{copied==='list'?'Copied':'Copy list'}</button></span></details>:null}
  {p.steps?.length?<details className="tc-draft"><summary>Steps</summary><ol className="tc-list">{p.steps.map((s,i)=><li key={i}>{s}</li>)}</ol></details>:null}
  {c.missing_blocker&&<span className="tc-blocker">{c.missing_blocker}</span>}
  {debug&&<details className="tc-debug"><summary>AI Reasoning</summary><pre>{reasoning}</pre><p className="tc-meta-debug">{c.action_type} · urgency {c.urgency} · confidence {Math.round(c.confidence_score*100)}%{c.hard_deadline?` · deadline ${c.hard_deadline}`:''}</p></details>}
 </li>;
}
export function TriageCards({t}:{t:TriageView}){
 const debug=useDebug();
 return <div className="qc-reply qc-sorted tc">
  <p className="qc-head">{t.cards.length?(t.cards.length===1?'I’ve sorted this for you.':`I found ${t.cards.length} things in that.`):'I read it. There’s nothing in it that needs you.'}</p>
  {t.summary&&<p className="qc-next">{t.summary}</p>}
  {groups.map(g=>{const list=t.cards.filter(c=>c.urgency===g.light);if(!list.length)return null;
   return <section key={g.light} className={`qc-group ${g.light}`} aria-label={g.label}><p className="qc-group-head"><span aria-hidden="true">{g.dot}</span> {g.label}</p>
    <ul>{list.map(c=><Card key={c.card_id} c={c} reasoning={t.reasoning} debug={debug}/>)}</ul></section>;})}
  {debug&&!t.cards.length&&<details className="tc-debug"><summary>AI Reasoning</summary><pre>{t.reasoning}</pre></details>}
  <p className="qc-next">Drafts are ready for you to send. I haven’t sent anything.</p>
 </div>;
}
