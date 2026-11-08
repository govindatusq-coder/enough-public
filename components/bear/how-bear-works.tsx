'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiSend} from '@/lib/bear/client';
import {Button} from './ui';

// "How Bear works": a short tour, five screens, in Bear's own artwork and voice. Shown once on My Bear
// (after the setup questions), skippable at any point, and replayable from Settings. Swipe, tap Next, or
// use the arrow keys; Escape skips.
const base='/bear/art/';
const SLIDES=[
 {art:'capture-bear',title:'Give it to Bear',body:'Anything on your mind: a bill, a school note, a to-do. Tap + Bear and type it, say it, or snap a photo. You can also share straight from other apps.'},
 {art:'ob-hand-steps',title:'Bear sorts it out',body:'Bear works out what’s needed and by when, keeps the details together, and plans the reminders. Nothing to set up.'},
 {art:'home-calm',title:'Only what needs you',body:'My Bear stays calm. A red number means something needs you. Bear’s handling shows everything Bear is carrying for you.'},
 {art:'empty-ideas',title:'Ideas that save a thought',body:'Bear Ideas has a few suggestions to take things off your mind. Say yes, not now, or not relevant, and Bear learns.'},
 {art:'empty-wins',title:'Tell Bear when it’s done',body:'One tap when you’ve done your part. My Wins shows what Bear carried for you. Bear never pays, sends or signs anything for you.'},
];
export function HowBearWorks({onDone,replay=false}:{onDone:(next:'home'|'capture')=>void;replay?:boolean}){
 const [i,setI]=useState(0);const startX=useRef<number|null>(null);const first=useRef<HTMLButtonElement>(null);
 const last=i===SLIDES.length-1;const s=SLIDES[i];
 async function finish(next:'home'|'capture'){if(!replay){try{await apiSend('/api/bear/profile',{tourSeenAt:new Date().toISOString()},'PUT');}catch{/* shows again next time; harmless */}}onDone(next);}
 useEffect(()=>{first.current?.focus();},[i]);
 // The tour has the whole screen: the navigation bar steps aside while it's open.
 useEffect(()=>{document.documentElement.classList.add('tour-open');return()=>document.documentElement.classList.remove('tour-open');},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='ArrowRight')setI(x=>Math.min(SLIDES.length-1,x+1));if(e.key==='ArrowLeft')setI(x=>Math.max(0,x-1));if(e.key==='Escape')finish('home');};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 return <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title"
  onTouchStart={e=>{startX.current=e.touches[0].clientX;}} onTouchEnd={e=>{if(startX.current===null)return;const dx=e.changedTouches[0].clientX-startX.current;startX.current=null;if(dx<-50)setI(x=>Math.min(SLIDES.length-1,x+1));if(dx>50)setI(x=>Math.max(0,x-1));}}>
  <div className="tour-top"><span className="small muted">{i+1} of {SLIDES.length}</span>{!last&&<button type="button" className="one-thing-link" onClick={()=>finish('home')}>Skip</button>}</div>
  <div className="tour-body" key={i}>
   {/* eslint-disable-next-line @next/next/no-img-element -- static artwork, same as the rest of Load Bear */}
   <img src={`${base}${s.art}.webp`} alt="" className="tour-art"/>
   <h1 id="tour-title" className="tour-title">{s.title}</h1>
   <p className="tour-text">{s.body}</p>
  </div>
  <div className="tour-dots" aria-hidden="true">{SLIDES.map((_,k)=><span key={k} className={k===i?'on':''}/>)}</div>
  <div className="tour-actions">
   {last?<>
    {!replay&&<Button variant="coral" className="wide" onClick={()=>finish('capture')}>Give Bear something</Button>}
    <Button variant={replay?'coral':'quiet'} className="wide" onClick={()=>finish('home')}>{replay?'Done':'Go to My Bear'}</Button>
   </>:<>
    <button ref={first} type="button" className="btn coral wide" onClick={()=>setI(i+1)}>Next</button>
    {i>0&&<Button variant="quiet" className="wide" onClick={()=>setI(i-1)}>Back</Button>}
   </>}
  </div>
 </div>;
}
// The tour on My Bear: shows once, then gets out of the way.
export function FirstTimeTour({show}:{show:boolean}){
 const router=useRouter();const [dismissed,setDismissed]=useState(false);
 if(!show||dismissed)return null;
 return <HowBearWorks onDone={next=>{setDismissed(true);if(next==='capture')router.push('/bear/capture');}}/>;
}
