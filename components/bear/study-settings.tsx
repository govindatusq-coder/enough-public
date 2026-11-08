'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {Button,Sheet} from './ui';

// Research study in Settings. Hidden unless a study is running. Joining needs the code from the invitation
// and a clear yes; leaving is one tap, with the choice to delete every answer.
type Status={available:false}|{available:true;enrolled:false}|{available:true;enrolled:true;enrolledOn:string;endsOn:string;due:{label:string}|null;completed:number};
export function StudySettings(){
 const [s,setS]=useState<Status|null>(null);const [join,setJoin]=useState(false);const [leave,setLeave]=useState(false);const [code,setCode]=useState('');const [agree,setAgree]=useState(false);const [err,setErr]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const load=()=>apiGet<Status>('/api/bear/study').then(setS).catch(()=>setS(null));
 useEffect(()=>{load();},[]);
 if(!s?.available)return null;
 async function doJoin(){setBusy(true);setErr(null);try{await apiSend('/api/bear/study',{action:'join',code,consent:true});setJoin(false);await load();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 async function doLeave(deleteAnswers:boolean){setBusy(true);try{await apiSend('/api/bear/study',{action:'leave',deleteAnswers});setLeave(false);await load();}finally{setBusy(false);}}
 return <section className="section" aria-labelledby="study"><p className="eyebrow" id="study">Research study</p><div className="card">
  {s.enrolled?<>
   <p className="small">You’re in the Load Bear study until {formatAU(s.endsOn)}. Thank you.</p>
   {s.due?<div className="btn-row"><Button className="sm" variant="primary" href="/bear/study">{s.due.label}</Button></div>:<p className="small muted" style={{marginTop:6}}>Nothing to answer right now.</p>}
   <div className="btn-row"><Button className="sm" variant="quiet" href="/bear/study/info">About the study</Button><Button className="sm" variant="quiet" onClick={()=>setLeave(true)}>Leave the study</Button></div>
  </>:<>
   <p className="small">If you were invited to the Load Bear study, you can join here. It takes about a minute a week.</p>
   <div className="btn-row"><Button className="sm" variant="primary" onClick={()=>setJoin(true)}>Join the study</Button><Button className="sm" variant="quiet" href="/bear/study/info">About the study</Button></div>
  </>}
 </div>
 {join&&<Sheet onClose={()=>setJoin(false)} label="Join the study"><h2>Join the study</h2>
  <p className="small" style={{marginTop:8}}>The study looks at whether Load Bear makes household admin feel lighter. You’d answer a short survey now, a one-minute check-in each week for six weeks, and a final survey.</p>
  <p className="small" style={{marginTop:8}}>Researchers see counts (like how many things you gave Bear) and your answers, under a code instead of your name. They never see what your items say, your documents, names or amounts. You can skip any question and leave at any time.</p>
  <p className="small" style={{marginTop:8}}><Link href="/bear/study/info">Read the full participant information</Link></p>
  <div className="field" style={{marginTop:12}}><label htmlFor="study-code">Study code</label><input id="study-code" value={code} maxLength={40} autoComplete="off" onChange={e=>setCode(e.target.value)}/></div>
  <label className="small" style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:10}}><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} style={{marginTop:3}}/><span>I’ve read the participant information, I’m 18 or over, and I agree to take part.</span></label>
  {err&&<p className="small" role="alert" style={{marginTop:8,color:'#B42318'}}>{err}</p>}
  <div className="btn-stack"><Button variant="coral" disabled={busy||!agree||code.trim().length<3} onClick={doJoin}>Join</Button><Button variant="quiet" onClick={()=>setJoin(false)}>Not now</Button></div>
 </Sheet>}
 {leave&&<Sheet onClose={()=>setLeave(false)} label="Leave the study"><h2>Leave the study</h2>
  <p className="small" style={{marginTop:8}}>Nothing about how Bear works for you changes. Do you want your study answers deleted too?</p>
  <div className="btn-stack"><Button variant="coral" disabled={busy} onClick={()=>doLeave(true)}>Leave and delete my answers</Button><Button variant="quiet" disabled={busy} onClick={()=>doLeave(false)}>Leave, keep my answers</Button><Button variant="quiet" onClick={()=>setLeave(false)}>Stay in the study</Button></div>
 </Sheet>}
 </section>;
}
