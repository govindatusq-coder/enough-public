'use client';
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';

// On a task with an event date: add it to the person's Outlook calendar. It shows exactly what will be added and asks first;
// Bear says "added" only when Microsoft confirmed the event exists. Hidden unless Outlook calendar is on and connected.
type Result={status:string;message?:string;summary?:{title:string;when:string;where:string}};
export function AddToOutlook({taskId}:{taskId:string}){
 const [ok,setOk]=useState(false);const [phase,setPhase]=useState<'idle'|'asking'|'working'|'done'>('idle');const [summary,setSummary]=useState<Result['summary']|null>(null);const [msg,setMsg]=useState<string|null>(null);
 useEffect(()=>{apiGet<{available:boolean;connected:boolean}>('/api/bear/calendar/status').then(s=>setOk(s.available&&s.connected)).catch(()=>setOk(false));},[]);
 if(!ok)return null;
 async function ask(){setPhase('working');setMsg(null);try{const r=await apiSend<Result>(`/api/bear/tasks/${taskId}/calendar/create`,{step:'request'});
  if(r.status==='needs_approval'&&r.summary){setSummary(r.summary);setPhase('asking');}else{setMsg(r.message||'Bear can’t add this one yet.');setPhase('done');}}catch(e){setMsg((e as Error).message);setPhase('done');}}
 async function approve(){setPhase('working');try{const r=await apiSend<Result>(`/api/bear/tasks/${taskId}/calendar/create`,{step:'approve'});setMsg(r.message||null);if(r.status==='needs_approval'&&r.summary){setSummary(r.summary);setPhase('asking');return;}setPhase('done');}catch(e){setMsg((e as Error).message);setPhase('done');}}
 if(phase==='idle')return <p className="small" style={{margin:'6px 0 0'}}><button type="button" className="btn ghost sm" onClick={ask}>Add to my Outlook calendar</button></p>;
 return <div className="card" style={{marginTop:8}} role="status">
  {phase==='asking'&&summary&&<><p className="eyebrow">Add to Outlook?</p><p style={{fontWeight:700,margin:'2px 0 0'}}>{summary.title}</p><p className="small muted" style={{margin:'2px 0 0'}}>{summary.when} · {summary.where}</p>
   <div className="btn-row"><button type="button" className="btn primary sm" onClick={approve}>Add it</button><button type="button" className="btn quiet sm" onClick={()=>setPhase('idle')}>Not now</button></div></>}
  {phase==='working'&&<p className="small">One moment…</p>}
  {phase==='done'&&<><p className="small">{msg}</p><button type="button" className="btn quiet sm" onClick={() => setPhase("idle")}>OK</button></>}
 </div>;
}
