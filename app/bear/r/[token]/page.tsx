'use client';
// What someone sees when a Load Bear user asks them for help by text. No app, no account: the link is the key to this one
// request. Opening it changes nothing; they answer with a button, and Bear tells the person who asked.
import {use,useCallback,useEffect,useState} from 'react';
import {Art} from '@/components/bear/art';
import {formatAU} from '@/lib/bear/domain/dates';
import type {PublicView} from '@/lib/bear/sharebear/core';

type Act='accept'|'decline'|'done'|'unable'|'on_track'|'reminders_off'|'reminders_on';
const when=(v:PublicView)=>v.due?`${formatAU(v.due,'weekday')} ${formatAU(v.due,'short')}${v.dueTime?`, ${v.dueTime}`:' '}`.trim():null;
function storeLink(){
 const ua=typeof navigator==='undefined'?'':navigator.userAgent;
 const ios=process.env.NEXT_PUBLIC_LOADBEAR_IOS_URL,android=process.env.NEXT_PUBLIC_LOADBEAR_ANDROID_URL;
 if(/iPhone|iPad|iPod/.test(ua)&&ios)return ios;if(/Android/.test(ua)&&android)return android;
 return process.env.NEXT_PUBLIC_LOADBEAR_LANDING_URL||'/bear/welcome';
}
export default function HelpRequest({params}:{params:Promise<{token:string}>}){
 const {token}=use(params);
 const [v,setV]=useState<PublicView|null>(null);const [err,setErr]=useState<string|null>(null);const [busy,setBusy]=useState<Act|null>(null);
 const [just,setJust]=useState<Act|null>(null);const [confirm,setConfirm]=useState<'done'|'unable'|null>(null);const [offline,setOffline]=useState(false);
 const load=useCallback(()=>fetch(`/api/bear/r/${encodeURIComponent(token)}`,{cache:'no-store'}).then(r=>r.json()).then(j=>{setV(j);setErr(null);}).catch(()=>setErr('This page couldn’t load. Check your connection and try again.')),[token]);
 useEffect(()=>{load();const on=()=>setOffline(!navigator.onLine);on();window.addEventListener('online',on);window.addEventListener('offline',on);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',on);};},[load]);
 async function act(a:Act){
  setBusy(a);setErr(null);
  try{const r=await fetch(`/api/bear/r/${encodeURIComponent(token)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:a,...(a==='done'?{confirm:true}:{})})});const j=await r.json();
   if(!r.ok){setErr(j.error||'That didn’t go through. Please try again.');if(r.status===410)setV({state:'gone'});return;}
   setV(j);setJust(a);setConfirm(null);}
  catch{setErr('That didn’t go through (no connection?). Nothing changed. Please try again.');}
  finally{setBusy(null);}
 }
 const who=v?.ownerName||'They';const due=v?when(v):null;
 const cta=<aside className="hr-cta"><p className="hr-cta-h">Want your own Bear?</p><p>Less on your mind. More of your life.</p><a className="hr-btn ghost" href={storeLink()}>Get Load Bear</a></aside>;
 const task=<div className="hr-task"><p className="hr-title">{v?.title}</p>{due&&<p className="hr-due">{due}</p>}</div>;
 return <main className="hr" id="main">
  <div className="hr-bear" aria-hidden="true"><Art file="hero-bear-cut" className="hr-bear-img"/></div>
  {offline&&<p className="hr-note" role="status">You’re offline. Your answer will need a connection to go through.</p>}
  {!v&&!err&&<p className="hr-sub" role="status">One moment…</p>}
  {!v&&err&&<><p className="hr-sub" role="alert">{err}</p><button type="button" className="hr-btn" onClick={load}>Try again</button></>}
  {v?.state==='gone'&&<><h1 className="hr-h">This request is no longer active.</h1><p className="hr-sub">Nothing more is needed from you. Thanks!</p></>}
  {v?.state==='active'&&<>
   {v.status==='SENT'&&<>
    <h1 className="hr-h">🐻 {who} needs a hand</h1><p className="hr-sub">{who} wants your help with this:</p>{task}
    {v.message&&<p className="hr-msg">“{v.message}”</p>}
    <p className="hr-ask">Can you take care of it?</p>
    <div className="hr-actions"><button type="button" className="hr-btn yes" disabled={!!busy} onClick={()=>act('accept')}>{busy==='accept'?'One moment…':'Yes, I’ll do it'}</button><button type="button" className="hr-btn no" disabled={!!busy} onClick={()=>act('decline')}>{busy==='decline'?'One moment…':'Sorry, I can’t'}</button></div>
   </>}
   {v.status==='ACCEPTED'&&<>
    {just==='accept'?<><h1 className="hr-h">🐻 You’ve got this!</h1><p className="hr-sub">Thanks for helping {who}.</p></>:<h1 className="hr-h">Your responsibility</h1>}
    {task}<p className="hr-state">Current status: Accepted{just==='on_track'?' · Bear has told '+who+' it’s on track':''}</p>
    {confirm==='done'?<div className="hr-confirm" role="group" aria-label="Confirm done"><p>Is it all done? Bear will tell {who}.</p><div className="hr-actions"><button type="button" className="hr-btn yes" disabled={!!busy} onClick={()=>act('done')}>{busy==='done'?'One moment…':'Yes, it’s done'}</button><button type="button" className="hr-btn ghost" onClick={()=>setConfirm(null)}>Not yet</button></div></div>
    :confirm==='unable'?<div className="hr-confirm" role="group" aria-label="Confirm you can’t"><p>Bear will let {who} know so they can make another plan.</p><div className="hr-actions"><button type="button" className="hr-btn no" disabled={!!busy} onClick={()=>act('unable')}>{busy==='unable'?'One moment…':'Yes, let them know'}</button><button type="button" className="hr-btn ghost" onClick={()=>setConfirm(null)}>Never mind</button></div></div>
    :<div className="hr-actions"><button type="button" className="hr-btn yes" onClick={()=>setConfirm('done')}>Mark as done</button>{due&&<button type="button" className="hr-btn ghost" disabled={!!busy} onClick={()=>act('on_track')}>Still on track</button>}<button type="button" className="hr-btn ghost" onClick={()=>setConfirm('unable')}>I can’t do this anymore</button></div>}
    <p className="hr-small">{v.remindersOff?<>Bear won’t text you reminders. <button type="button" className="hr-link" disabled={!!busy} onClick={()=>act('reminders_on')}>Turn reminders back on</button></>:<>Bear may text you one reminder on the day. <button type="button" className="hr-link" disabled={!!busy} onClick={()=>act('reminders_off')}>No reminders, thanks</button></>}</p>
    {just==='accept'&&cta}
   </>}
   {v.status==='DECLINED'&&<><h1 className="hr-h">No worries!</h1><p className="hr-sub">Bear will let {who} know.</p>{cta}</>}
   {v.status==='COMPLETED'&&<><h1 className="hr-h">🐻 All taken care of!</h1><p className="hr-sub">Thanks. Bear has let {who} know it’s done.</p>{task}{cta}</>}
   {v.status==='UNABLE_TO_COMPLETE'&&<><h1 className="hr-h">Thanks for letting us know</h1><p className="hr-sub">Bear has told {who}, so they can make another plan.</p>{cta}</>}
  </>}
  {v&&err&&<p className="hr-note err" role="alert">{err}</p>}
  <p className="hr-foot">Sent with Load Bear on behalf of {v?.state==='active'?who:'someone you know'}. Only this request is shared with you.</p>
 </main>;
}
