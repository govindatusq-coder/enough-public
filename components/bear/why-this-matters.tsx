'use client';
import {useState} from 'react';
import {apiSend} from '@/lib/bear/client';
import {todayISO} from '@/lib/bear/domain/dates';
import {friendlyDate} from '@/lib/bear/load/words';
import type {Reason} from '@/lib/bear/priority/types';
import {Chip} from './ui';

export interface PriorityView{label:string;reasons:Reason[];headline:string;latestComfortable:string|null;latestSafe:string|null;deadline:string|null;minutes:number;firstStep:string|null;askImportance:boolean;surfaceNow:boolean}
const icon:Record<string,string>={matters:'❤️',pressure:'📅',lead:'⏳',depends:'🔗',window:'⏱',bear:'🐻',safety:'⚠️',deadline:'📅'};
// "Why this matters", in the item's existing card style: 1–3 reasons, a calm timeline where it helps,
// and one question about importance only when Bear is unsure and the answer would change things.
export function WhyThisMatters({taskId,p,onChanged}:{taskId:string;p:PriorityView;onChanged:()=>void}){
 const today=todayISO();const [busy,setBusy]=useState(false);
 const timeline=p.deadline&&p.latestComfortable&&p.latestSafe&&p.latestComfortable<p.deadline;
 async function rate(level:'very'|'nice'|'not'){setBusy(true);try{await apiSend(`/api/bear/tasks/${taskId}/importance`,{level});onChanged();}finally{setBusy(false);}}
 if(!p.reasons.length&&!timeline&&!p.askImportance)return null;
 return (
  <section className="glass why-card" aria-labelledby="why-title" style={{padding:16,marginTop:14}}>
   <p className="eyebrow" id="why-title" style={{marginBottom:6}}>Why this matters <span className="pill" style={{marginLeft:6}}>{p.label}</span></p>
   {p.reasons.slice(0,3).map(r=><div key={r.key} className="why-row"><span aria-hidden="true">{icon[r.key]||'·'}</span><p className="small"><strong>{r.title}.</strong> {r.text}</p></div>)}
   {p.firstStep&&<p className="note teal small" style={{marginTop:10}}>{p.firstStep}</p>}
   {timeline&&<div className="why-timeline" aria-label="Timeline">
    <div className={p.latestComfortable!<=today?'on':''}><i/><span>Good time to act</span><b>{p.latestComfortable!<=today?'now':friendlyDate(p.latestComfortable,today)}</b></div>
    <div className={p.latestSafe!<=today?'on':''}><i/><span>Gets tighter</span><b>{friendlyDate(p.latestSafe,today)}</b></div>
    <div><i/><span>Deadline</span><b>{friendlyDate(p.deadline,today)}</b></div>
   </div>}
   {p.askImportance&&<div style={{marginTop:12}}><p className="small" style={{fontWeight:700}}>How important is this to you?</p><div className="chips" style={{marginTop:6}}><Chip label="Very important" selected={false} onToggle={()=>!busy&&rate('very')}/><Chip label="Nice if possible" selected={false} onToggle={()=>!busy&&rate('nice')}/><Chip label="Not particularly" selected={false} onToggle={()=>!busy&&rate('not')}/></div></div>}
  </section>
 );
}
