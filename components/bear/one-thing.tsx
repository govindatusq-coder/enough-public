'use client';
import {useState} from 'react';
import Link from 'next/link';
import {apiSend} from '@/lib/bear/client';
import type {OneThing} from '@/lib/bear/services/home';
import {Button,Chip,Sheet} from './ui';

// "One thing worth doing now": the Priority Engine's single pick, in the existing card style.
// Optional "Why this one?" shows 1–3 plain reasons; "Not today" steps Bear back until tomorrow.
const reasonIcon:Record<string,string>={matters:'❤️',pressure:'📅',lead:'⏳',depends:'🔗',window:'⏱',bear:'🐻',safety:'⚠️',deadline:'📅'};
const whyNot=[{key:'no_time',label:'No time'},{key:'no_energy',label:'No energy'},{key:'need_first',label:'Need something first'},{key:'dont_want',label:'Don’t want to deal with this'},{key:'not_important',label:'Not actually important'},{key:'changed',label:'Something changed'}] as const;
export function OneThingCard({item,onChanged,onSaid}:{item:OneThing;onChanged:()=>void;onSaid:(s:string)=>void}){
 const [why,setWhy]=useState(false);const [ask,setAsk]=useState(false);const [busy,setBusy]=useState(false);
 const href=item.billId?`/bear/bills/${item.billId}`:`/bear/tasks/${item.taskId}`;
 async function later(reason?:string){setBusy(true);try{const r=await apiSend<{askWhy:boolean}>(`/api/bear/tasks/${item.taskId}/later`,{reason:reason??null});setWhy(false);
  if(r.askWhy&&!reason){setAsk(true);}else{setAsk(false);onSaid(reason?'Thanks. Bear will remember that.':'No problem. Bear will bring it back tomorrow.');onChanged();}}catch(e){onSaid((e as Error).message);}finally{setBusy(false);}}
 return (
  <section className="one-thing glass" aria-labelledby="one-thing-title">
   <p className="eyebrow coral" id="one-thing-title">One thing worth doing now</p>
   <p className="one-thing-action">{item.action}</p>
   <p className="small muted one-thing-meta">{!item.action.toLowerCase().includes(item.title.toLowerCase().replace(/^\w+:\s*/,''))?<>{item.title} · </>:null}{item.minutes?`${item.minutes} min for you`:''}{item.line?` · ${item.line}`:''}</p>
   <div className="one-thing-actions"><Button href={href} variant="coral" className="sm">Do this now</Button><button type="button" className="one-thing-link" onClick={()=>setWhy(true)}>Why this one?</button><button type="button" className="one-thing-link" disabled={busy} onClick={()=>later()}>Not today</button></div>
   {why&&<Sheet onClose={()=>setWhy(false)} label="Why this one?">
    <h2>Why this one?</h2>
    <p className="muted" style={{marginTop:6}}>{item.why.headline}</p>
    <div style={{marginTop:12,display:'grid',gap:12}}>{item.why.reasons.map(r=><div key={r.key} style={{display:'flex',gap:10}}><span aria-hidden="true" style={{fontSize:20,lineHeight:'24px'}}>{reasonIcon[r.key]||'·'}</span><div><p style={{fontWeight:700}}>{r.title}</p><p className="small muted">{r.text}</p></div></div>)}</div>
    {item.firstStep&&<p className="note teal" style={{marginTop:14}}>{item.firstStep}</p>}
    <div className="btn-stack"><Button href={href} variant="coral">Sounds good</Button><Button variant="quiet" disabled={busy} onClick={()=>later()}>Not today</Button></div>
   </Sheet>}
   {ask&&<Sheet onClose={()=>{setAsk(false);onChanged();}} label="What made today a bad fit?">
    <h2>What made today a bad fit?</h2>
    <p className="small muted" style={{marginTop:6}}>Only if you’d like to say. It helps Bear get the timing right.</p>
    <div className="chips" style={{marginTop:12}}>{whyNot.map(w=><Chip key={w.key} label={w.label} selected={false} onToggle={()=>later(w.key)}/>)}</div>
    <div className="btn-stack"><Button variant="quiet" onClick={()=>{setAsk(false);onSaid('No problem. Bear will bring it back tomorrow.');onChanged();}}>Skip</Button></div>
   </Sheet>}
  </section>
 );
}
