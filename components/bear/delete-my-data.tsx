'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiSend} from '@/lib/bear/client';
import {Button} from './ui';

// Delete everything in Load Bear. Plain words about what goes, an explicit typed confirmation, and an honest result.
export function DeleteMyData(){
 const router=useRouter();const [phase,setPhase]=useState<'idle'|'confirm'|'busy'|'done'|'error'>('idle');const [typed,setTyped]=useState('');const [msg,setMsg]=useState<string|null>(null);
 async function run(){setPhase('busy');setMsg(null);
  try{const r=await apiSend<{loginRemoved:boolean;historyKept?:boolean}>('/api/bear/me/data',{confirm:typed},'DELETE');
   setMsg((r.loginRemoved?'Everything is deleted, including your sign-in.':'Everything in Load Bear is deleted. Your sign-in (email and password) still exists. To have it removed too, ask the person who runs Load Bear.')+(r.historyKept?' One thing remains: a log of status changes (what changed and when) that Bear could not remove by itself. Ask the person who runs Load Bear to remove it.':''));setPhase('done');
   setTimeout(()=>router.replace('/bear/welcome'),4500);}
  catch(e){setMsg((e as Error).message||'That didn’t finish. Nothing more was deleted. Try again.');setPhase('error');}}
 return <section className="section" aria-labelledby="del"><p className="eyebrow" id="del">Your data</p><div className="card">
  {(phase==='idle'||phase==='error')&&<><p className="small">You can delete everything Bear holds for you at any time.</p>
   <div className="btn-row"><Button className="sm" variant="ghost" onClick={()=>{setPhase('confirm');setMsg(null);}}>Delete my data</Button></div></>}
  {phase==='confirm'&&<><p className="small"><strong>This permanently deletes</strong> your responsibilities, everything you’ve shared with Bear, uploaded files and forms, reminders, saved details and settings. It can’t be undone.</p>
   <div className="field" style={{marginTop:10}}><label htmlFor="del-confirm">Type DELETE to confirm</label><input id="del-confirm" value={typed} autoComplete="off" onChange={e=>setTyped(e.target.value)}/></div>
   <div className="btn-row"><Button className="sm" variant="coral" disabled={typed!=='DELETE'} onClick={run}>Delete everything</Button><Button className="sm" variant="quiet" onClick={()=>{setPhase('idle');setTyped('');}}>Keep my data</Button></div></>}
  {phase==='busy'&&<p className="small" role="status">Deleting…</p>}
  {phase==='done'&&<p className="small" role="status">{msg}</p>}
  {phase==='error'&&msg&&<p className="note" role="alert" style={{marginTop:10}}>{msg}</p>}
 </div></section>;
}
