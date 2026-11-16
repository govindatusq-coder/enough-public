'use client';
// Home: the Brain Dump Board. Designed for interrupted lives, not perfectly planned days.
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {greetingFor} from '@/lib/bear/board/logic';
import type {BoardView} from '@/lib/bear/board/service';
import {Art} from '@/components/bear/art';
import {ErrorCard,Skeleton,useOnline} from '@/components/bear/ui';
import {showLocalReminder} from '@/components/bear/runtime';
import {AddRow,BrainDumpInput,MomentPicker,TaskRow,useBoardActions,type Say} from '@/components/bear/board';

export default function Home(){
 const router=useRouter();const online=useOnline();
 const [board,setBoard]=useState<BoardView|null>(null);const [error,setError]=useState<string|null>(null);
 const [notices,setNotices]=useState<{id:string;text:string}[]>([]);const [hour,setHour]=useState(12);
 const [toast,setToast]=useState<{text:string;undo?:()=>void;key:number}|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [open,setOpen]=useState<Record<string,boolean>>({});const [cards,setCards]=useState<{dump:boolean;moment:boolean}>({dump:false,moment:false});const [fresh,setFresh]=useState<Set<string>>(new Set());
 const [due,setDue]=useState<{reminderId:string;taskId:string;billId:string|null;message:string}[]>([]);const delivered=useRef(new Set<string>());
 const load=useCallback(()=>Promise.race([apiGet<{onboarding?:boolean;board?:BoardView;notices?:{id:string;text:string}[];due?:{reminderId:string;taskId:string;billId:string|null;message:string}[]}>('/api/bear/board'),new Promise<never>((_,no)=>setTimeout(()=>no(new Error('Bear is taking too long to answer. Check your connection and try again.')),20000))]).then(r=>{if(r.onboarding){router.replace('/bear/onboarding');return;}setBoard(r.board!);setNotices(r.notices||[]);setDue(r.due||[]);setError(null);
  // A due reminder is marked as seen in the app, and also shown as a phone notification where allowed (as the old home did).
  for(const d of r.due||[]){if(delivered.current.has(d.reminderId))continue;delivered.current.add(d.reminderId);const href=d.billId?`/bear/bills/${d.billId}?reminder=${d.reminderId}`:`/bear/help/${d.taskId}`;
   apiSend('/api/bear/reminders/delivered',{reminderId:d.reminderId,via:'in_app'}).catch(()=>{});showLocalReminder(d.reminderId,d.message,href).then(ok=>{if(ok)apiSend('/api/bear/reminders/delivered',{reminderId:d.reminderId,via:'local'}).catch(()=>{});}).catch(()=>{});}
 })
  .catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{queueMicrotask(()=>{setHour(new Date().getHours());try{setOpen(JSON.parse(localStorage.getItem('bear-lists-open')||'{}'));setCards(c=>({...c,...JSON.parse(localStorage.getItem('bear-home-open')||'{}')}));}catch{/* no storage */}});load();const onVis=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);},[load]);
 const say:Say=useCallback((text,undo)=>{if(timer.current)clearTimeout(timer.current);setToast({text,undo,key:Date.now()});timer.current=setTimeout(()=>setToast(null),undo?6000:3500);},[]);
 const {actions,dragging}=useBoardActions(board,setBoard,load,say);
 function card(k:'dump'|'moment',v?:boolean){setCards(c=>{const n={...c,[k]:v??!c[k]};try{localStorage.setItem('bear-home-open',JSON.stringify(n));}catch{/* no storage */}return n;});}
 function toggle(id:string){setOpen(o=>{const n={...o,[id]:!(o[id]??false)};try{localStorage.setItem('bear-lists-open',JSON.stringify(n));}catch{/* no storage */}return n;});}
 if(error&&!board)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/><p className="small" style={{marginTop:14}}>Meanwhile: <Link href="/bear/overview" className="link-btn">Your areas</Link> · <Link href="/bear/calendar" className="link-btn">Calendar</Link> · <Link href="/bear/capture" className="link-btn">Talk to Bear</Link></p></main>;
 if(!board)return <main id="main" className="bear-screen"><div className="skeleton" style={{minHeight:40,maxWidth:220,marginBottom:16}}/><Skeleton/></main>;
 const count=(id:string)=>board.byList[id]?.length||0;
 const items=board.inbox.length;
 return <main id="main" className="bear-screen board-screen">
  <div className="board-top"><span className="board-word">LOAD BEAR</span><Link href="/bear/me" className="board-me" aria-label="Settings"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3.4"/><path d="M5.8 18.6c1.5-2.2 3.6-3.2 6.2-3.2s4.7 1 6.2 3.2"/></svg></Link></div>
  <header className="board-hero2">
   <div className="board-hero-art" aria-hidden="true"><Art file="hero-bear-cut" className="board-hero-img"/></div>
   <div className="board-hero-text">
    <h1 className="board-hello">{greetingFor(hour,board.name)}</h1>
    <p className="board-ask hand"><span>What’s on your mind?</span></p>
   </div>
  </header>
  <p className="board-sub">Big things, little things, half-formed thoughts. I’ll help you sort them out.</p>
  {!online&&<p className="note" style={{marginTop:12}} role="status">You’re offline. Showing what Bear last knew.</p>}
  <BrainDumpInput say={say} onUnloaded={r=>{setFresh(new Set(r.added.map(a=>a.id)));card('dump',true);load();say(r.added.length?`Got ${r.added.length===1?'it':`all ${r.added.length}`}. ${r.already.length?`${r.already.length} ${r.already.length===1?'was':'were'} already here.`:'They’re safe in My Brain Dump.'}`:r.already.length?'That’s already on your list.':'Bear couldn’t find a task in that. Your words are kept.');}}/>
  <Link href="/bear/capture" className="dump-more tiny">Add a photo, PDF or email instead</Link>
  {due.map(d=><Link key={d.reminderId} href={d.billId?`/bear/bills/${d.billId}?reminder=${d.reminderId}`:`/bear/help/${d.taskId}`} className="note teal" role="status" style={{display:'block',marginTop:12}}>🔔 {d.message}</Link>)}
  {notices.map(n=><p key={n.id} className="note teal" role="status" style={{marginTop:12}}>{n.text} <Link href="/bear/shared" className="link-btn" onClick={()=>apiSend('/api/bear/shares/seen',{}).catch(()=>{})}>See</Link></p>)}
  {board.resume&&<Link href={`/bear/help/${board.resume.taskId}`} className="resume home-card"><span className="eyebrow teal">Pick up where you left off</span><strong>{board.resume.title}</strong>{board.resume.next&&<span className="small muted">Next: {board.resume.next}</span>}</Link>}
  <div className="board-cols">
   <div className="board-col">
    <section className="home-card dump-card" aria-labelledby="bd-h" data-drop="inbox">
     <button type="button" className="home-card-head" aria-expanded={cards.dump} onClick={()=>card('dump')}>
      <span className="home-card-icon dump-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 12.5l2.8 2.8L16.5 9"/></svg></span>
      <span className="home-card-text"><strong id="bd-h">My Brain Dump</strong><span>{items===0?'Nothing yet':items===1?'1 item':`${items} items`}</span></span>
      <span className={`home-chev${cards.dump?' up':''}`} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
     </button>
     {cards.dump&&<ul className="b-list">
      {board.inbox.map((t,i)=><TaskRow key={t.id} task={t} index={i} count={board.inbox.length} lists={board.lists} actions={actions} dragging={dragging===t.id} fresh={fresh.has(t.id)}/>)}
      <AddRow listId={null} onAdded={load} say={say}/>
     </ul>}
     {cards.dump&&items===0&&<p className="faint" style={{padding:'0 4px 10px'}}>Anything you unload lands here first. Leave it here as long as you like.</p>}
    </section>
    <MomentPicker open={cards.moment} onToggle={()=>card('moment')} onDone={(id,title)=>actions.complete({id,title} as never)}/>
   </div>
   <section className="board-col" aria-labelledby="ml-h">
    <div className="board-h-row"><h2 id="ml-h" className="board-h">My Lists</h2><Link href="/bear/me/lists" className="link-btn small">Edit lists</Link></div>
    {board.lists.map(l=>{const isOpen=open[l.id]??false;return <div key={l.id} className="list-block home-card" data-drop={l.id}>
     <button type="button" className="list-head" aria-expanded={isOpen} onClick={()=>toggle(l.id)}><span className="list-icon" aria-hidden="true">{l.icon}</span><span className="list-title">{l.title}</span><span className="faint">{count(l.id)||''}</span><span className={`home-chev${isOpen?' up':''}`} aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></span></button>
     {isOpen&&<ul className="b-list">{board.byList[l.id].map((t,i)=><TaskRow key={t.id} task={t} index={i} count={board.byList[l.id].length} lists={board.lists} actions={actions} dragging={dragging===t.id}/>)}<AddRow listId={l.id} onAdded={load} say={say}/></ul>}
    </div>;})}
    {board.doneToday.length>0&&<details className="done-today"><summary className="faint">Done lately · {board.doneToday.length}</summary><ul>{board.doneToday.map(d=><li key={d.id} className="faint"><s>{d.title}</s></li>)}</ul></details>}
    <p className="board-links small"><Link href="/bear/calendar">Calendar</Link> · <Link href="/bear/overview">Your areas</Link> · <Link href="/bear/ideas">Bear Ideas</Link></p>
   </section>
  </div>
  {toast&&<div key={toast.key} className="undo-toast glass-strong" role="status"><span>{toast.text}</span>{toast.undo&&<button type="button" onClick={()=>{toast.undo!();setToast(null);}}>Undo</button>}</div>}
 </main>;
}
