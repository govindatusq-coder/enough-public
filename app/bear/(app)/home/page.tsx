'use client';
// Drop Bear: tell Bear what's on your mind. No categories, priorities or dates needed; Bear sorts, plans and gets it moving.
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {buildTriageRequest} from '@/lib/bear/inputProcessor';
import type {FamilyMember} from '@/lib/bear/services/triage-core';
import {ErrorCard,Skeleton,useOnline} from '@/components/bear/ui';
import {showLocalReminder} from '@/components/bear/runtime';
import {BrainDumpInput,type Say} from '@/components/bear/board';
import {AppHeader,MamaBear,greetingV2} from '@/components/bear/v2';

const WORDS=['','that','those two things','those three things','those four things','those five things','those six things','those seven things','those eight things','those nine things','those ten things'];
type Due={reminderId:string;taskId:string;billId:string|null;message:string};
interface Got{title:string;note:string|null}
interface Ack{text:string;tip:{taskId:string;text:string}|null;items?:Got[]}
type TriageCard={card_headline:string;already:boolean;linkedFrom?:string|null;execution_payload?:{shopping_list?:string[]|null}};
type TriageReply={cards:TriageCard[];items?:{unclear:number};unplaced?:string[]};
const SHOW=8;
// What Bear is doing while it works. The steps move on with time (a photo takes longer than typing); the last one stays until
// Bear has really finished.
const STEPS={photo:[['Reading every line on the page',0],['Working out what needs doing',12],['Filing each thing in Bear Brain',35]],text:[['Reading what you wrote',0],['Sorting it into tasks',2],['Filing it in Bear Brain',5]]} as const;
function Working({kind,count}:{kind:'photo'|'text';count:number}){
 const [secs,setSecs]=useState(0);
 useEffect(()=>{const t0=Date.now();const id=setInterval(()=>setSecs(Math.floor((Date.now()-t0)/1000)),1000);return()=>clearInterval(id);},[]);
 const steps=STEPS[kind];const at=steps.reduce((n,[,from],i)=>secs>=from?i:n,0);
 const what=kind==='photo'?(count>1?`your ${count} pictures`:'your picture'):'that';
 return <section className="v2-working" role="status" aria-live="polite" aria-busy="true">
  <h2 className="v2-working-title">Bear is working on {what}<span className="dots" aria-hidden="true"><i/><i/><i/></span></h2>
  <ol className="v2-steps">{steps.map(([label],i)=><li key={label} className={i<at?'done':i===at?'now':''}><span className="v2-step-mark" aria-hidden="true">{i<at?'✓':''}</span>{label}{i===at?'…':''}</li>)}</ol>
  <p className="v2-working-note">{kind==='photo'?`${secs}s · a long list can take a minute or two. Keep the app open until Bear’s done.`:`${secs}s`}</p>
 </section>;
}
export default function DropBear(){
 const router=useRouter();const online=useOnline();
 const [name,setName]=useState<string|null>(null);const [hour,setHour]=useState(9);const [error,setError]=useState<string|null>(null);
 const [notices,setNotices]=useState<{id:string;text:string;taskId?:string;delegationId?:string}[]>([]);const [due,setDue]=useState<Due[]>([]);const delivered=useRef(new Set<string>());
 const [ack,setAck]=useState<Ack|null>(null);const [allShown,setAllShown]=useState(false);const [typing,setTyping]=useState(false);const [count,setCount]=useState(1);
 const fresh=()=>{setAck(null);setAllShown(false);window.scrollTo({top:0,behavior:'smooth'});};const [filesBusy,setFilesBusy]=useState(false);const [giving,setGiving]=useState(false);
 const working=filesBusy?'photo':typing?'text':null;
 const [toast,setToast]=useState<string|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const load=useCallback(()=>Promise.race([apiGet<{onboarding?:boolean;board?:{name:string};notices?:{id:string;text:string;taskId?:string;delegationId?:string}[];due?:Due[]}>('/api/bear/board'),new Promise<never>((_,no)=>setTimeout(()=>no(new Error('Bear is taking too long to answer. Check your connection and try again.')),20000))]).then(r=>{
  if(r.onboarding){router.replace('/bear/onboarding');return;}setName(r.board?.name||'');setNotices(r.notices||[]);setDue(r.due||[]);setError(null);
  for(const d of r.due||[]){if(delivered.current.has(d.reminderId))continue;delivered.current.add(d.reminderId);const href=d.billId?`/bear/bills/${d.billId}?reminder=${d.reminderId}`:`/bear/brain/${d.taskId}`;
   apiSend('/api/bear/reminders/delivered',{reminderId:d.reminderId,via:'in_app'}).catch(()=>{});showLocalReminder(d.reminderId,d.message,href).then(ok=>{if(ok)apiSend('/api/bear/reminders/delivered',{reminderId:d.reminderId,via:'local'}).catch(()=>{});}).catch(()=>{});}
 }).catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{queueMicrotask(()=>setHour(new Date().getHours()));load();},[load]);
 const say:Say=useCallback(text=>{if(timer.current)clearTimeout(timer.current);setToast(text);timer.current=setTimeout(()=>setToast(null),4000);},[]);
 // Photos and PDFs go to Bear's reader (five at a time), which turns them into responsibilities the same way. Everything Bear
 // filed is listed back, so the person can see at a glance that nothing on the page was missed.
 async function files(list:File[]){
  setFilesBusy(true);setAck(null);setAllShown(false);setCount(list.length);
  const got:Got[]=[];let unclear=0;
  const one=list.length===1?'that':'those';
  try{let fam:FamilyMember[]=[];try{fam=(await apiGet<{profile:{family?:FamilyMember[]}}>('/api/bear/profile')).profile.family||[];}catch{/* read without family names */}
   for(let i=0;i<list.length;i+=5){
    const req=await buildTriageRequest({files:list.slice(i,i+5)},fam);const r=await apiSend<TriageReply>('/api/bear/triage',req);
    // A shopping list shows what is on it, so no line is hidden inside a task.
    for(const c of r.cards||[]){const buy=c.execution_payload?.shopping_list?.filter(Boolean)||[];const inside=buy.length?`includes ${buy.join(', ')}`:null;
     got.push(c.linkedFrom?{title:c.linkedFrom,note:`added to “${c.card_headline}”`}:{title:c.card_headline,note:[c.already?'already with Bear':null,inside].filter(Boolean).join(' · ')||null});}
    unclear+=r.items?.unclear||0;
    // Lines read but not filed in time go through the ordinary typed route now.
    if(r.unplaced?.length){const d=await apiSend<{added:{title:string}[];already:{title:string}[]}>('/api/bear/board/dump',{text:r.unplaced.join('\n'),via:'text'});
     for(const x of d.added)got.push({title:x.title,note:null});for(const x of d.already)got.push({title:x.title,note:'already with Bear'});}
   }
   const n=got.length;
   setAck({text:n?`I’ve read ${one} and found ${n===1?'one thing':`${n} things`} to do${unclear?`. ${unclear===1?'One line was':`${unclear} lines were`} hard to read, so I’ve asked you to check ${unclear===1?'it':'them'}`:''}. Here’s everything I caught:`:'I read it, but didn’t find anything that needs doing.',tip:null,items:got});
  }catch(e){
   const why=(e as Error).message||'Bear couldn’t read that just now.';
   // Bear's own refusals happen before anything is filed. A timeout or a lost connection might not have: say so.
   const status=(e as {status?:number}).status||0;const unsure=!status||status>=500&&!(e as {body?:{code?:string}}).body?.code;
   setAck(got.length?{text:`${why} Before that, I filed ${got.length===1?'one thing':`${got.length} things`}:`,tip:null,items:got}
    :{text:unsure?`${why} Some of it may have been saved: check Bear Brain before you send it again.`:`${why} Nothing from ${one} was saved, so it’s safe to try again.`,tip:null});
  }
  finally{setFilesBusy(false);}
 }
 async function give(taskId:string){setGiving(true);try{await apiSend(`/api/bear/rre/${taskId}/give`,{});router.push(`/bear/brain/${taskId}`);}catch(e){say((e as Error).message);setGiving(false);}}
 if(error&&name===null)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/><p className="small" style={{marginTop:14}}>Meanwhile: <Link href="/bear/brain" className="link-btn">Bear Brain</Link> · <Link href="/bear/calendar" className="link-btn">Calendar</Link></p></main>;
 if(name===null)return <main id="main" className="bear-screen"><Skeleton/></main>;
 return <main id="main" className="bear-screen v2-screen v2-fill">
  <AppHeader/>
  <header className={`v2-hero stacked${working||ack?' small':''}`}>
   <MamaBear/>
   <div className="v2-hero-text"><h1 className="v2-hello">{greetingV2(hour,name)}</h1>{!working&&!ack&&<p className="v2-ask hand"><span>What’s on your mind?</span></p>}</div>
  </header>
  {!online&&<p className="note" style={{marginTop:12}} role="status">You’re offline. Bear will take it when you’re back.</p>}
  {working&&<Working kind={working} count={count}/>}
  <div className="v2-drop-wrap" hidden={!!working||!!ack}>
  <BrainDumpInput card say={say} onBusy={setTyping} placeholder="Drop it here. I’ll sort it, plan it and get it moving." onFiles={files} filesBusy={filesBusy}
   onUnloaded={r=>{const n=r.added.length;setAllShown(false);setAck({text:n?`I’ve got ${WORDS[n]||`those ${n} things`}. I’ll work out what needs attention and what I can help with.`:r.already.length?'That’s already with Bear.':'Bear couldn’t find anything to do in that. Your words are kept.',tip:r.tip||null,items:n>1||r.already.length?[...r.added.map(x=>({title:x.title,note:null})),...r.already.map(x=>({title:x.title,note:'already with Bear'}))]:undefined});}}/>
  </div>
  {ack&&<section className="v2-ack v2-result" role="status" aria-live="polite">
   <h2 className="v2-result-title">Done</h2>
   <p>{ack.text}</p>
   {!!ack.items?.length&&<ul className="v2-ack-list">{(allShown?ack.items:ack.items.slice(0,SHOW)).map((g,i)=><li key={i}>{g.title}{g.note&&<span className="faint"> · {g.note}</span>}</li>)}</ul>}
   {(ack.items?.length||0)>SHOW&&!allShown&&<button type="button" className="link-btn small" onClick={()=>setAllShown(true)}>Show all {ack.items!.length}</button>}
   {ack.tip&&<><p className="v2-tip">{ack.tip.text}</p><button type="button" className="btn coral sm" disabled={giving} onClick={()=>give(ack.tip!.taskId)}>{giving?'One moment…':'Give it to Bear'}</button></>}
   <div className="v2-result-actions">
    <button type="button" className="btn coral wide" onClick={fresh}>Back to Drop Bear</button>
    <Link href="/bear/brain" className="btn ghost wide">See it in Bear Brain</Link>
   </div>
  </section>}
  {due.map(d=><Link key={d.reminderId} href={d.billId?`/bear/bills/${d.billId}?reminder=${d.reminderId}`:`/bear/brain/${d.taskId}`} className="note teal" role="status" style={{display:'block',marginTop:12}}>🔔 {d.message}</Link>)}
  {notices.map(n=><p key={n.id} className="note teal" role="status" style={{marginTop:12}}>{n.text} {n.delegationId?<Link href={`/bear/brain/${n.taskId}`} className="link-btn" onClick={()=>apiSend(`/api/bear/share-bear/${n.delegationId}`,{action:'seen'}).catch(()=>{})}>See</Link>:<Link href="/bear/shared" className="link-btn" onClick={()=>apiSend('/api/bear/shares/seen',{}).catch(()=>{})}>See</Link>}</p>)}
  {toast&&<div className="undo-toast glass-strong" role="status"><span>{toast}</span></div>}
 </main>;
}
