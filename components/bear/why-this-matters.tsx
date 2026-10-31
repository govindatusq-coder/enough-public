'use client';
import {useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {todayISO} from '@/lib/bear/domain/dates';
import {friendlyDate} from '@/lib/bear/load/words';
import {reasonIcon,type WhyReason} from './why-inline';
import {Chip} from './ui';

// The default is minimal: a calm label, roughly how long, and one short line. "Why this matters? ⌄"
// stays collapsed until the person taps it; only then are the reasons (and a calm timeline) fetched.
// At most one question, and only when Bear is unsure and the answer would change what it does.
export interface PriorityView{label:string;minutes:number;shortReason:string|null;ask:'importance'|'reliance'|null;surfaceNow:boolean}
interface WhyView{reasons:WhyReason[];latestComfortable:string|null;latestSafe:string|null;deadline:string|null;firstStep:string|null}
// Importance, not priority: how much it matters, never how urgent it is. "Bear decide" clears the person's say.
export const trafficLight=[{key:'very',dot:'🔴',label:'Really matters'},{key:'nice',dot:'🟠',label:'Matters'},{key:'not',dot:'🟢',label:'Low stakes'},{key:null,dot:'○',label:'Bear decide'}] as const;
export function WhyThisMatters({taskId,p,onChanged}:{taskId:string;p:PriorityView;onChanged:()=>void}){
 const today=todayISO();const [busy,setBusy]=useState(false);const [open,setOpen]=useState(false);const [why,setWhy]=useState<WhyView|null>(null);
 async function rate(level:'very'|'nice'|'not'){setBusy(true);try{await apiSend(`/api/bear/tasks/${taskId}/importance`,{level});onChanged();}finally{setBusy(false);}}
 async function toggle(){const next=!open;setOpen(next);if(next&&!why){try{setWhy(await apiGet<WhyView>(`/api/bear/tasks/${taskId}/why`));}catch{setWhy({reasons:[],latestComfortable:null,latestSafe:null,deadline:null,firstStep:null});}}}
 const timeline=why&&why.deadline&&why.latestComfortable&&why.latestSafe&&why.latestComfortable<why.deadline;
 return (
  <section className="glass why-card" aria-label="How Bear sees this" style={{padding:16,marginTop:14}}>
   <p className="why-summary"><span className="pill">{p.label}</span>{p.minutes>0&&<span className="small muted">~{p.minutes} {p.minutes===1?'minute':'minutes'}</span>}</p>
   {p.shortReason&&<p className="small" style={{marginTop:8}}>{p.shortReason}</p>}
   <button type="button" className="one-thing-link why-toggle" aria-expanded={open} aria-controls={`why-${taskId}`} onClick={toggle} style={{marginTop:6}}>Why this matters? <span aria-hidden="true" className={`why-chev ${open?'open':''}`}>⌄</span></button>
   {open&&<div id={`why-${taskId}`} className="why-list">
    {!why&&<p className="small muted">One moment…</p>}
    {why?.reasons.slice(0,4).map(r=><div key={r.key+r.title} className="why-row"><span aria-hidden="true">{reasonIcon[r.key]||'·'}</span><p className="small"><strong>{r.title}</strong><br/><span className="muted">{r.text}</span></p></div>)}
    {why&&why.reasons.length===0&&<p className="small muted">Bear is keeping track of this. Nothing more to it.</p>}
    {why?.firstStep&&<p className="note teal small" style={{marginTop:10}}>{why.firstStep}</p>}
    {timeline&&<div className="why-timeline" aria-label="Timeline">
     <div className={why!.latestComfortable!<=today?'on':''}><i/><span>Good time to act</span><b>{why!.latestComfortable!<=today?'now':friendlyDate(why!.latestComfortable,today)}</b></div>
     <div className={why!.latestSafe!<=today?'on':''}><i/><span>Gets tighter</span><b>{friendlyDate(why!.latestSafe,today)}</b></div>
     <div><i/><span>Deadline</span><b>{friendlyDate(why!.deadline,today)}</b></div>
    </div>}
   </div>}
   {p.ask==='importance'&&<div style={{marginTop:12}}><p className="small" style={{fontWeight:700}} id={`imp-q-${taskId}`}>How much does this matter?</p><div className="chips" role="group" aria-labelledby={`imp-q-${taskId}`} style={{marginTop:6}}>{trafficLight.filter(l=>l.key).map(l=><Chip key={l.label} label={`${l.dot} ${l.label}`} selected={false} onToggle={()=>!busy&&rate(l.key!)}/>)}</div></div>}
  </section>
 );
}
