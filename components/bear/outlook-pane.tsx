'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {CompactLockup} from './art';
import {Button} from './ui';
import {captureText,givenKey,readableAttachments,type OutlookAttachment,type OutlookItem} from '@/lib/bear/outlook/item';
import {decide} from '@/lib/bear/engine/decide';
import {presentRead,READ_CHOICES} from '@/lib/bear/outlook/read';
import {accessToken,addinAuth,attachmentFile,authConfigured,canReadAttachments,loadOffice,onItemChanged,openInBrowser,readOpenItem,signInWithPopup} from '@/lib/bear/outlook/office-client';

// Bear in Outlook. The person opens an email, taps "Give to Bear" in Outlook, then "Give this to Bear"
// here. The email goes through the same capture pipeline as everything else; nothing is sent before
// that tap, Bear never reads the rest of the mailbox, and the result says exactly what Bear did.
type Outcome={label:string;detail:string|null;href:string;kind:'added'|'check'|'merged'|'filed'};
type Phase='loading'|'outside'|'signed_out'|'ready'|'sending'|'done'|'error';
interface CaptureResponse{capture:{id:string};auto?:{taskId:string;title:string;dueAt:string|null;merged:boolean};dump?:{captureId:string;projects:{title:string;count:number}[]}}

const fmt=(iso:string|null)=>{if(!iso)return null;const d=new Date(iso.length===10?iso+'T12:00:00':iso);return isNaN(+d)?null:d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});};
function describe(r:CaptureResponse):Outcome{
 if(r.dump)return {kind:'filed',label:`Filed ${r.dump.projects.length} project${r.dump.projects.length===1?'':'s'}`,detail:r.dump.projects.slice(0,3).map(p=>p.title).join(', ')||null,href:`/bear/sort/${r.dump.captureId}`};
 if(r.auto)return {kind:r.auto.merged?'merged':'added',label:r.auto.title,detail:r.auto.merged?'Bear already had this, so it updated it instead of adding it twice.':fmt(r.auto.dueAt),href:`/bear/tasks/${r.auto.taskId}`};
 return {kind:'check',label:'Bear needs you to check this one',detail:'Open it in Bear to confirm the details.',href:`/bear/verify/${r.capture.id}`};
}

export function OutlookPane(){
 const [phase,setPhase]=useState<Phase>('loading');
 const [item,setItem]=useState<{id:string|null;item:OutlookItem;attachments:OutlookAttachment[]}|null>(null);
 const [picked,setPicked]=useState<Set<string>>(new Set());
 const [outcomes,setOutcomes]=useState<Outcome[]>([]);const [note,setNote]=useState<string|null>(null);const [given,setGiven]=useState(false);
 // Bear's first read (only when switched on). Worked out here in the panel, so the email isn't sent before the tap.
 const [firstRead,setFirstRead]=useState(false);const [fb,setFb]=useState<'idle'|'choosing'|'thanks'>('idle');
 const origin=typeof window!=='undefined'?window.location.origin:'';

 const signedIn=useCallback(async()=>!authConfigured()||!!(await accessToken()),[]);
 const refresh=useCallback(async()=>{
  setOutcomes([]);setNote(null);setFb('idle');
  const it=await readOpenItem();setItem(it);
  setPicked(new Set(readableAttachments(it?.attachments||[]).map(a=>a.id)));
  const k=givenKey(it?.id);let seen=false;try{seen=!!(k&&localStorage.getItem(k));}catch{/* no storage */}setGiven(seen);
  setPhase(await signedIn()?'ready':'signed_out');
 },[signedIn]);

 useEffect(()=>{let off=()=>{};loadOffice().then(inOutlook=>{if(!inOutlook){setPhase('outside');return;}refresh();off=onItemChanged(()=>{refresh();});});return()=>off();},[refresh]);

 useEffect(()=>{fetch('/api/bear/decide',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>setFirstRead(!!j?.enabled)).catch(()=>setFirstRead(false));},[]);
 const read=useMemo(()=>firstRead&&item?decide(captureText(item.item)):null,[firstRead,item]);
 async function feedback(correct:boolean,expected?:string){if(!read)return;
  try{await send('/api/bear/decide/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({predicted:read.decision,correct,expected,rule:read.rule})});setFb('thanks');}catch{setFb('idle');setNote('Bear couldn’t save that. Nothing was lost.');}}
 async function connect(){setNote(null);const r=await signInWithPopup(origin);if(r==='signed_in')setPhase('ready');else if(r==='blocked')setNote('Outlook didn’t open the sign-in window. Allow pop-ups for Outlook, then try again.');}
 async function signOut(){await addinAuth()?.auth.signOut().catch(()=>null);setPhase('signed_out');}

 async function send(path:string,init:RequestInit):Promise<CaptureResponse>{
  const token=await accessToken();if(authConfigured()&&!token){setPhase('signed_out');throw new Error('Sign in to give things to Bear.');}
  const res=await fetch(path,{...init,credentials:token?'omit':'same-origin',headers:{...(init.headers||{}),Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{})}});
  let body:Record<string,unknown>={};try{body=await res.json();}catch{/* empty */}
  if(res.status===401){setPhase('signed_out');throw new Error('Sign in again to keep giving things to Bear.');}
  if(!res.ok)throw new Error(typeof body.error==='string'?body.error:`Bear hit a snag (${res.status}). Nothing was lost. Please try again.`);
  return body as unknown as CaptureResponse;
 }
 async function give(){
  if(!item)return;setPhase('sending');setNote(null);const out:Outcome[]=[];const problems:string[]=[];
  try{
   const text=captureText(item.item);
   if(text)out.push(describe(await send('/api/bear/captures',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'email',text})})));
   for(const a of readableAttachments(item.attachments).filter(a=>picked.has(a.id))){
    const file=await attachmentFile(a);if(!file){problems.push(a.name);continue;}
    const form=new FormData();form.append('file',file,a.name);form.append('method','email');
    try{out.push(describe(await send('/api/bear/captures',{method:'POST',body:form})));}catch{problems.push(a.name);}
   }
   const k=givenKey(item.id);try{if(k)localStorage.setItem(k,new Date().toISOString());}catch{/* no storage */}
   setOutcomes(out);setGiven(true);setPhase('done');
   if(problems.length)setNote(`Bear couldn’t read ${problems.join(', ')}. Save ${problems.length===1?'it':'them'} and add ${problems.length===1?'it':'them'} in Bear instead.`);
  }catch(e){setOutcomes(out);setNote((e as Error).message);setPhase(out.length?'done':'error');}
 }

 const files=readableAttachments(item?.attachments||[]);const filesOk=canReadAttachments();
 return <main id="main" className="bear-screen flow outlook-pane">
  <div style={{margin:'4px 0 14px'}}><CompactLockup width={200}/></div>
  {phase==='loading'&&<p className="muted" role="status">One moment…</p>}

  {phase==='outside'&&<section className="card"><h1 style={{fontSize:22}}>Bear in Outlook</h1>
   <p className="small" style={{marginTop:8}}>This page runs inside Outlook. Add Load Bear to Outlook, open an email, then tap <b>Give to Bear</b>.</p>
   <div className="btn-row"><Button href="/bear/outlook/help" className="sm">How to add it</Button></div></section>}

  {phase==='signed_out'&&<section className="card"><h1 style={{fontSize:22}}>Connect your Bear</h1>
   <p className="small" style={{marginTop:8}}>Sign in once and you can give emails to Bear straight from Outlook.</p>
   <div className="btn-stack"><Button className="wide" onClick={connect}>Sign in to Load Bear</Button></div>
   {note&&<p className="note" role="status" style={{marginTop:12}}>{note}</p>}</section>}

  {(phase==='ready'||phase==='sending'||phase==='error')&&item&&<section className="card" aria-labelledby="ol-subject">
   <p className="eyebrow">This email</p>
   <h1 id="ol-subject" style={{fontSize:19,lineHeight:1.3,marginTop:4,wordBreak:'break-word'}}>{item.item.subject||'(no subject)'}</h1>
   {item.item.from&&<p className="small muted" style={{marginTop:4,wordBreak:'break-word'}}>{item.item.from}</p>}
   {files.length>0&&<fieldset className="ol-files" style={{border:0,padding:0,margin:'14px 0 0'}}><legend className="small" style={{fontWeight:600}}>Attachments to read too</legend>
    {files.map(a=><label key={a.id} className="small" style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
     <input type="checkbox" checked={picked.has(a.id)} disabled={!filesOk} onChange={e=>{const n=new Set(picked);if(e.target.checked)n.add(a.id);else n.delete(a.id);setPicked(n);}}/>{a.name}</label>)}
    {!filesOk&&<p className="small muted" style={{marginTop:6}}>This version of Outlook can’t pass attachments to Bear. Save them and add them in Bear instead.</p>}
   </fieldset>}
   {given&&<p className="note" style={{marginTop:12}}>You’ve given this email to Bear before. Giving it again is fine: Bear won’t add the same thing twice.</p>}
   {read&&(()=>{const p=presentRead(read.decision);return <div className="ol-read" role="status" style={{marginTop:14,padding:'12px 14px',borderRadius:14,background:'rgba(255,255,255,.6)'}}>
    <p className="eyebrow">Bear’s first read</p><p style={{fontWeight:700,margin:'2px 0 0'}}>{p.headline}</p><p className="small muted" style={{margin:'2px 0 0'}}>{p.detail}</p>
    {fb==='idle'&&<p className="small" style={{margin:'8px 0 0'}}>Is that right? <button type="button" className="btn quiet sm" onClick={()=>feedback(true)}>Yes</button> <button type="button" className="btn quiet sm" onClick={()=>setFb('choosing')}>No</button></p>}
    {fb==='choosing'&&<div style={{marginTop:8}}><p className="small">What should it be?</p><div className="btn-row">{READ_CHOICES.map(c=><button key={c.value} type="button" className="btn quiet sm" onClick={()=>feedback(false,c.value)}>{c.label}</button>)}</div></div>}
    {fb==='thanks'&&<p className="small muted" style={{margin:'8px 0 0'}}>Thanks. Bear kept only your answer, not your email.</p>}
   </div>;})()}
   <div className="btn-stack"><Button className="wide" variant={read&&!presentRead(read.decision).primary?'quiet':'primary'} disabled={phase==='sending'} onClick={give}>{phase==='sending'?'Bear is reading it…':read?presentRead(read.decision).button:'Give this to Bear'}</Button></div>
   {note&&<p className="note" role="alert" style={{marginTop:12}}>{note}</p>}
   <p className="faint" style={{marginTop:12}}>Bear only sees this email, and only when you tap. It doesn’t read your inbox.</p>
  </section>}
  {phase==='ready'&&!item&&<p className="muted">Open an email to give it to Bear.</p>}

  {phase==='done'&&<section className="card" aria-live="polite">
   <p className="eyebrow">{outcomes.length?'Bear’s got it':'Nothing to do'}</p>
   {outcomes.length===0&&<p className="small" style={{marginTop:6}}>Bear read it and didn’t find anything that needs you.</p>}
   <ul style={{listStyle:'none',padding:0,margin:'8px 0 0'}}>{outcomes.map((o,i)=><li key={i} style={{padding:'10px 0',borderTop:i?'1px solid rgba(16,42,67,.1)':undefined}}>
    <p style={{fontWeight:700,margin:0}}>{o.label}</p>{o.detail&&<p className="small muted" style={{margin:'2px 0 0'}}>{o.detail}</p>}
    <button type="button" className="btn quiet sm" style={{marginTop:6}} onClick={()=>openInBrowser(origin+o.href)}>{o.kind==='check'?'Check it in Bear':'Open in Bear'}</button></li>)}</ul>
   {note&&<p className="note" role="status" style={{marginTop:12}}>{note}</p>}
   <div className="btn-row"><Button variant="quiet" className="sm" onClick={()=>setPhase('ready')}>Back to this email</Button></div>
  </section>}

  {(phase==='ready'||phase==='done')&&authConfigured()&&<p className="faint" style={{marginTop:18}}><button type="button" className="btn quiet sm" onClick={signOut}>Sign out of Bear in Outlook</button></p>}
 </main>;
}
