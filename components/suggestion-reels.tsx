"use client";
import {IdeaTags} from '@/components/idea-tags';
import {useEffect,useRef,useState,type WheelEvent} from 'react';
import {ArrowLeft,ArrowDown,ArrowUp,Bookmark,Footprints,Info,Sparkles,Wallet,Wind} from 'lucide-react';
import {IdeaPhoto,type IdeaPhotoState} from '@/components/idea-photo';
import {swipeDirection} from '@/lib/suggestion-reels';
import type {Idea} from '@/lib/ideas';

type Props={
 idea:Idea|null;photo:IdeaPhotoState;position:number;total:number;personal:boolean;
 saved:boolean;planned:boolean;saving:string;reason:string;
 onBack:()=>void;onNext:(direction:number)=>void;onSave:()=>void;onAccept:()=>void;
 onWhy:()=>void;onDetails:()=>void;onTune:()=>void;onGenerate:()=>void;
 aiAvailable:boolean;aiBusy:boolean;aiDisabled:boolean;aiError:string;
};

export function SuggestionReels({idea,photo,position,total,personal,saved,planned,saving,reason,onBack,onNext,onSave,onAccept,onWhy,onDetails,onTune,onGenerate,aiAvailable,aiBusy,aiDisabled,aiError}:Props){
 const page=useRef<HTMLElement>(null),touch=useRef<{x:number;y:number}|null>(null);
 const [scrollable,setScrollable]=useState(false);
 const wheel=useRef({distance:0,last:0,lockedUntil:0});
 useEffect(()=>{page.current?.focus({preventScroll:true})},[]);
 useEffect(()=>{
  const details=page.current?.querySelector<HTMLElement>('.reel-copy');
  if(!details){setScrollable(false);return}
  details.scrollTop=0;
  const measure=()=>setScrollable(details.scrollHeight>details.clientHeight+1);
  measure();const observer=new ResizeObserver(measure);observer.observe(details);
  for(const child of details.children)observer.observe(child);
  return()=>observer.disconnect();
 },[idea?.id]);
 const onWheel=(event:WheelEvent<HTMLElement>)=>{
  if(event.ctrlKey||Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  const target=event.target as HTMLElement;
  const copy=target.closest('.reel-copy');
  // Long descriptions and larger reading text scroll normally inside the card.
  if(copy&&copy.scrollHeight>copy.clientHeight+1)return;
  const now=Date.now(),previous=wheel.current;
  if(now<previous.lockedUntil)return;
  const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?page.current?.clientHeight||600:1);
  if(now-previous.last>180||Math.sign(delta)!==Math.sign(previous.distance))previous.distance=0;
  previous.distance+=delta;previous.last=now;
  if(Math.abs(previous.distance)>=65){onNext(previous.distance>0?1:-1);previous.distance=0;previous.lockedUntil=now+650}
 };
 return <section ref={page} className="suggestion-reels" aria-label="Suggestions, one at a time" tabIndex={-1}
  onKeyDown={event=>{
   if((event.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]'))return;
   if(event.key==='Escape'){event.preventDefault();onBack()}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();onNext(event.key==='ArrowDown'?1:-1)}
  }} onWheel={onWheel}
  onTouchStart={event=>{
   touch.current=null;
   const target=event.target as HTMLElement,copy=target.closest('.reel-copy');
   if(event.touches.length!==1||target.closest('button,a')||copy&&copy.scrollHeight>copy.clientHeight+1)return;
   touch.current={x:event.touches[0].clientX,y:event.touches[0].clientY};
  }} onTouchCancel={()=>touch.current=null} onTouchEnd={event=>{
   const start=touch.current;touch.current=null;
   if(!start||!event.changedTouches.length)return;
   const direction=swipeDirection(event.changedTouches[0].clientX-start.x,event.changedTouches[0].clientY-start.y);
   if(direction)onNext(direction);
  }}>
  <div className="reel-stage">
   {idea&&<div key={idea.id} className="reel-picture"><IdeaPhoto idea={idea} photo={photo}/></div>}
   <header className="reel-header"><button onClick={onBack}><ArrowLeft size={20}/><span>All ideas</span></button><span className="reel-brand">ENOUGH</span><span className="reel-count">{total?`${position+1} / ${total}`:'My Moves'}</span></header>
   {idea?<>
    <div className="reel-actions"><button onClick={onSave} aria-label={saved?'Remove saved idea':'Save this idea'} aria-pressed={saved}><span><Bookmark size={23} fill={saved?'currentColor':'none'}/></span>{saved?'Saved':'Save'}</button><button onClick={onWhy}><span><Info size={23}/></span>Why this?</button></div>
    <div key={idea.id} className="reel-content">
     <div className="reel-copy" data-scrollable={scrollable}>
      <span className="reel-fit">{personal?'MATCHED TO YOUR PINS':'AN IDEA TO EXPLORE'}</span>
      <h1>{idea.title}</h1><p className="reel-description">{idea.body}</p><IdeaTags idea={idea}/>
      <div className="reel-returns"><span><Footprints size={18}/><strong>{idea.minutes} min</strong><small>Movement · estimate</small></span><span><Wallet size={18}/><strong>{saving}</strong><small>Saved · estimate</small></span><span><Wind size={18}/><strong>{idea.extraMin>0?`+${idea.extraMin} min`:idea.extraMin<0?`${-idea.extraMin} min reclaimed`:'No extra time'}</strong><small>Fits your day</small></span></div>
      {reason&&<p className="reel-reason">{reason}</p>}
      <div className="reel-meta"><span>{idea.source==='ai'?'AI-generated idea':'From your idea library'}</span><button onClick={onDetails}>Full details</button></div>
     </div>
     <button className="primary reel-accept" onClick={onAccept}>{planned?'View my experience':'Sounds good'}</button>
    </div>
   </>:<div className="reel-empty"><h1>Your needs come first.</h1><p>No ideas in this selection currently match your needs. Explore another collection or review your settings.</p><button className="secondary" onClick={onBack}>Back to all ideas</button><button className="text-button" onClick={onTune}>Review idea settings</button></div>}
   <footer className="reel-footer"><span className="reel-swipe"><ArrowUp size={15}/>{position<total-1?'Swipe up for another':'You’ve explored this selection'}</span>{aiAvailable&&<button className="reel-generate" disabled={aiBusy||aiDisabled} onClick={onGenerate}><Sparkles size={16}/>{aiBusy?'Preparing suggestions…':'More suggestions'}</button>}</footer>
   {aiError&&<p className="reel-error" role="alert">{aiError}</p>}
   <p className="sr-only" aria-live="polite" aria-atomic="true">{idea?`${idea.title}. Idea ${position+1} of ${total}.`: 'No matching suggestions.'}</p>
  </div>
  <nav className="reel-navigation" aria-label="Suggestion navigation"><button aria-label="Previous suggestion" disabled={position<=0} onClick={()=>onNext(-1)}><ArrowUp/></button><button aria-label="Next suggestion" disabled={position>=total-1} onClick={()=>onNext(1)}><ArrowDown/></button></nav>
 </section>;
}
