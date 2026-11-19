'use client';
// Got a Moment?: one useful thing that fits the time she has right now. Never busywork; never "you must".
import {useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiSend} from '@/lib/bear/client';
import {AppHeader,Icon,LabelChip,MamaBear} from '@/components/bear/v2';

interface Rec{taskId:string;title:string;label:string;minutes:number;why:string;needsBear:boolean;alternative:{taskId:string;title:string}|null}
interface Res{recommendation:Rec|null;message:string|null;suggestMinutes:number|null;waiting:number}
const OPTIONS:[number,string][]=[[5,'5 min'],[10,'10 min'],[20,'20 min'],[60,'Some time']];
export default function GotAMoment(){
 const router=useRouter();
 const [minutes,setMinutes]=useState<number|null>(null);const [res,setRes]=useState<Res|null>(null);const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 const [exclude,setExclude]=useState<string[]>([]);const [giving,setGiving]=useState(false);
 async function ask(m:number,ex:string[]=[]){setMinutes(m);setBusy(true);setErr(null);setExclude(ex);
  try{setRes(await apiSend<Res>('/api/bear/rre/moment',{minutes:m,exclude:ex}));}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 async function give(r:Rec){setGiving(true);try{if(r.needsBear)await apiSend(`/api/bear/rre/${r.taskId}/give`,{});router.push(`/bear/brain/${r.taskId}`);}catch(e){setErr((e as Error).message);setGiving(false);}}
 async function notNow(r:Rec){try{await apiSend(`/api/bear/rre/${r.taskId}/skip`,{});}catch{/* still moves on */}ask(minutes!,exclude);}
 const r=res?.recommendation||null;
 return <main id="main" className="bear-screen v2-screen v2-fill v2-moment">
  <AppHeader/>
  <header className="v2-hero stacked small"><MamaBear/><div className="v2-hero-text"><h1 className="v2-hello">Got a moment?</h1><p className="v2-sub">How much time do you have right now?</p></div></header>
  <div className="v2-pills" role="radiogroup" aria-label="How much time do you have?">
   {OPTIONS.map(([m,l])=><button key={m} type="button" role="radio" aria-checked={minutes===m} className={`v2-pill${minutes===m?' on':''}`} disabled={busy} onClick={()=>ask(m)}>{l}</button>)}
  </div>
  {err&&<p className="note coral" role="alert" style={{marginTop:14}}>{err}</p>}
  {busy&&<div className="v2-reco skeleton" style={{minHeight:180}} aria-busy="true"/>}
  {!busy&&r&&<section className="v2-reco" aria-live="polite">
   <LabelChip label={r.label}/>
   <Link href={`/bear/brain/${r.taskId}`} className="v2-reco-head"><span><strong className="v2-reco-title">{r.title}</strong><span className="v2-reco-time">Takes about {r.minutes} minute{r.minutes===1?'':'s'}.</span></span><span className="v2-chev" aria-label="Details">{Icon.chevron()}</span></Link>
   <p className="v2-reco-why">{r.why}</p>
   <button type="button" className="btn coral wide v2-give" disabled={giving} onClick={()=>give(r)}>{giving?'One moment…':'Give it to Bear'}</button>
   <div className="v2-reco-more"><button type="button" className="link-btn small" onClick={()=>notNow(r)}>Not now</button><button type="button" className="link-btn small" onClick={()=>ask(minutes!,[...exclude,r.taskId])}>Something else</button></div>
  </section>}
  {!busy&&res&&!r&&<section className="v2-reco calm" aria-live="polite">
   <p className="v2-reco-title">{res.message}</p>
   {res.suggestMinutes&&<button type="button" className="btn ghost sm" style={{marginTop:12}} onClick={()=>ask(res.suggestMinutes!)}>Try {res.suggestMinutes>=60?'Some time':`${res.suggestMinutes} min`}</button>}
   {exclude.length>0&&<button type="button" className="link-btn small" style={{display:'block',marginTop:10}} onClick={()=>ask(minutes!)}>Back to the first suggestion</button>}
  </section>}
  {!res&&!busy&&<p className="v2-hint small">Pick how long you’ve got, and Bear finds one useful thing that fits.</p>}
  <nav className="v2-more-chips" aria-label="More">
   <Link href="/bear/calendar" className="v2-more-chip"><span aria-hidden="true">📅</span> Calendar</Link>
   <Link href="/bear/shared" className="v2-more-chip"><span aria-hidden="true">🤝</span> Share Bear</Link>
  </nav>
  <Link href="/bear/brain" className="v2-see-all">See All Tasks <span aria-hidden="true">→</span></Link>
 </main>;
}
