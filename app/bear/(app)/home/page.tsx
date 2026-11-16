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
import {AddRow,BrainDumpInput,MomentPicker,TaskRow,useBoardActions,type Say} from '@/components/bear/board';

export default function Home(){
 const router=useRouter();const online=useOnline();
 const [board,setBoard]=useState<BoardView|null>(null);const [error,setError]=useState<string|null>(null);
 const [notices,setNotices]=useState<{id:string;text:string}[]>([]);const [hour,setHour]=useState(12);
 const [toast,setToast]=useState<{text:string;undo?:()=>void;key:number}|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [open,setOpen]=useState<Record<string,boolean>>({});const [fresh,setFresh]=useState<Set<string>>(new Set());
 const load=useCallback(()=>apiGet<{onboarding?:boolean;board?:BoardView;notices?:{id:string;text:string}[]}>('/api/bear/board').then(r=>{if(r.onboarding){router.replace('/bear/onboarding');return;}setBoard(r.board!);setNotices(r.notices||[]);setError(null);})
  .catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{queueMicrotask(()=>{setHour(new Date().getHours());try{setOpen(JSON.parse(localStorage.getItem('bear-lists-open')||'{}'));}catch{/* no storage */}});load();const onVis=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);},[load]);
 const say:Say=useCallback((text,undo)=>{if(timer.current)clearTimeout(timer.current);setToast({text,undo,key:Date.now()});timer.current=setTimeout(()=>setToast(null),undo?6000:3500);},[]);
 const {actions,dragging}=useBoardActions(board,setBoard,load,say);
 function toggle(id:string){setOpen(o=>{const n={...o,[id]:!(o[id]??false)};try{localStorage.setItem('bear-lists-open',JSON.stringify(n));}catch{/* no storage */}return n;});}
 if(error&&!board)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/></main>;
 if(!board)return <main id="main" className="bear-screen"><div className="skeleton" style={{minHeight:40,maxWidth:220,marginBottom:16}}/><Skeleton/></main>;
 const count=(id:string)=>board.byList[id]?.length||0;
 return <main id="main" className="bear-screen board-screen">
  <header className="hero-banner board-hero">
   <div className="hero-text">
    <h1 className="hero-greeting">{greetingFor(hour,board.name)}<br/>What’s on your mind?</h1>
    <p className="hero-line small">Big things, little things, half-formed thoughts. I’ll help you sort them out.</p>
   </div>
   <div className="hero-art" aria-hidden="true"><Art file="hero-bear" className="hero-img" style={{objectPosition:'60% 22%'}}/></div>
  </header>
  {!online&&<p className="note" style={{marginTop:12}} role="status">You’re offline. Showing what Bear last knew.</p>}
  <BrainDumpInput say={say} onUnloaded={r=>{setFresh(new Set(r.added.map(a=>a.id)));load();say(r.added.length?`Got ${r.added.length===1?'it':`all ${r.added.length}`}. ${r.already.length?`${r.already.length} ${r.already.length===1?'was':'were'} already here.`:'They’re safe in My Brain Dump.'}`:r.already.length?'That’s already on your list.':'Bear couldn’t find a task in that. Your words are kept.');}}/>
  <Link href="/bear/capture" className="dump-more small link-btn">Add a photo, PDF or email instead</Link>
  {notices.map(n=><p key={n.id} className="note teal" role="status" style={{marginTop:12}}>{n.text} <Link href="/bear/shared" className="link-btn" onClick={()=>apiSend('/api/bear/shares/seen',{}).catch(()=>{})}>See</Link></p>)}
  {board.resume&&<Link href={`/bear/help/${board.resume.taskId}`} className="resume glass"><span className="eyebrow teal">Pick up where you left off</span><strong>{board.resume.title}</strong>{board.resume.next&&<span className="small muted">Next: {board.resume.next}</span>}</Link>}
  <MomentPicker onDone={(id,title)=>actions.complete({id,title} as never)}/>
  <div className="board-cols">
   <section className="board-col" aria-labelledby="bd-h" data-drop="inbox">
    <h2 id="bd-h" className="board-h">🧠 My Brain Dump{board.inbox.length>0&&<span className="faint"> {board.inbox.length}</span>}</h2>
    <ul className="b-list">
     {board.inbox.map((t,i)=><TaskRow key={t.id} task={t} index={i} count={board.inbox.length} lists={board.lists} actions={actions} dragging={dragging===t.id} fresh={fresh.has(t.id)}/>)}
     <AddRow listId={null} onAdded={load} say={say}/>
    </ul>
    {board.inbox.length===0&&<p className="faint" style={{padding:'4px 4px 0'}}>Anything you unload lands here first. Leave it here as long as you like.</p>}
   </section>
   <section className="board-col" aria-labelledby="ml-h">
    <div className="board-h-row"><h2 id="ml-h" className="board-h">My Lists</h2><Link href="/bear/me/lists" className="link-btn small">Edit lists</Link></div>
    {board.lists.map(l=>{const isOpen=open[l.id]??false;return <div key={l.id} className="list-block glass" data-drop={l.id}>
     <button type="button" className="list-head" aria-expanded={isOpen} onClick={()=>toggle(l.id)}><span className="list-icon" aria-hidden="true">{l.icon}</span><span className="list-title">{l.title}</span><span className="faint">{count(l.id)||''}</span><span className={`chev${isOpen?' up':''}`} aria-hidden="true">›</span></button>
     {isOpen&&<ul className="b-list">{board.byList[l.id].map((t,i)=><TaskRow key={t.id} task={t} index={i} count={board.byList[l.id].length} lists={board.lists} actions={actions} dragging={dragging===t.id}/>)}<AddRow listId={l.id} onAdded={load} say={say}/></ul>}
    </div>;})}
    {board.doneToday.length>0&&<details className="done-today"><summary className="faint">Done lately · {board.doneToday.length}</summary><ul>{board.doneToday.map(d=><li key={d.id} className="faint"><s>{d.title}</s></li>)}</ul></details>}
    <p className="board-links small"><Link href="/bear/calendar">Calendar</Link> · <Link href="/bear/overview">Your areas</Link> · <Link href="/bear/ideas">Bear Ideas</Link></p>
   </section>
  </div>
  {toast&&<div key={toast.key} className="undo-toast glass-strong" role="status"><span>{toast.text}</span>{toast.undo&&<button type="button" onClick={()=>{toast.undo!();setToast(null);}}>Undo</button>}</div>}
 </main>;
}
