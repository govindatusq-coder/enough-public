'use client';
import {useId,useState} from 'react';

// "Why this matters? ⌄": collapsed by default, opened only when the person taps it. Shows at most
// four plain-language reasons. Reasons can come with the card or be fetched on the tap (load).
export interface WhyReason{key:string;title:string;text:string}
export const reasonIcon:Record<string,string>={matters:'❤️',pressure:'📅',lead:'⏳',depends:'🔗',window:'⏱',bear:'🐻',safety:'⚠️',deadline:'📅',person:'👥',relationship:'🌱',future:'🚀',responsibility:'🤝',meaning:'❤️',timing:'🕐',project:'🚀'};
export function WhyInline({reasons,load,label='Why this matters?'}:{reasons?:WhyReason[];load?:()=>Promise<WhyReason[]>;label?:string}){
 const [open,setOpen]=useState(false);const [list,setList]=useState<WhyReason[]|null>(reasons||null);const [busy,setBusy]=useState(false);const id=useId();
 async function toggle(){const next=!open;setOpen(next);if(next&&!list&&load){setBusy(true);try{setList(await load());}catch{setList([]);}finally{setBusy(false);}}}
 return <div className="why-inline">
  <button type="button" className="one-thing-link why-toggle" aria-expanded={open} aria-controls={id} onClick={toggle}>{label} <span aria-hidden="true" className={`why-chev ${open?'open':''}`}>⌄</span></button>
  {open&&<div id={id} className="why-list">{busy&&<p className="small muted">One moment…</p>}{list?.slice(0,4).map(r=><div key={r.key+r.title} className="why-row"><span aria-hidden="true">{reasonIcon[r.key]||'·'}</span><p className="small"><strong>{r.title}</strong><br/><span className="muted">{r.text}</span></p></div>)}{list&&list.length===0&&!busy&&<p className="small muted">Nothing more to it than that.</p>}</div>}
 </div>;
}
