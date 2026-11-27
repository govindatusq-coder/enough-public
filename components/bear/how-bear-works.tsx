'use client';
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiSend} from '@/lib/bear/client';
import {Button} from './ui';

// "How Bear works": three short screens (the problem, what Bear does, the payoff), about 30 words in all. Shown first to a new
// user (and on My Bear for anyone who hasn't seen it), skippable at any point, and replayable from Settings. Swipe, tap Next, or use the arrow keys; Escape skips.
const base='/bear/art/';
const SLIDES=[
 {art:'tour-drop-bear',title:'Too much on your mind?',body:'Tell Bear what’s on your mind. No organising needed.'},
 {art:'ob-q-assist',title:'Bear does the thinking.',body:'Bear sorts, plans and helps get things ready.'},
 {art:'ob-done',title:'Less on your mind. More of your life.',body:'Get things done, share the load or take a break.'},
];
export function HowBearWorks({onDone,replay=false,onboarding=false}:{onDone:(next:'home'|'capture')=>void;replay?:boolean;onboarding?:boolean}){
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
   {last&&onboarding?<Button variant="coral" className="wide" onClick={()=>finish('home')}>Let’s get started</Button>:last?<>
    {!replay&&<Button variant="coral" className="wide" onClick={()=>finish('capture')}>Give it to Bear</Button>}
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
