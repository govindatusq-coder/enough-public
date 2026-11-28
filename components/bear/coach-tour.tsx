'use client';
import {useCallback,useEffect,useLayoutEffect,useState} from 'react';

// After onboarding: a short spotlight tour of the three main places, pointing at each one in the navigation bar.
// Shown once, straight after onboarding (?tour=1); skippable at any point.
const STEPS=[
 {href:'/bear/home',title:'Drop Bear',text:'Tell Bear anything on your mind. Type it, say it or snap a photo.'},
 {href:'/bear/moment',title:'Lighten Load',text:'Got a few minutes? Bear finds one thing that fits, or helps you share the load or take a break.'},
 {href:'/bear/brain',title:'Bear Brain',text:'Everything Bear is holding, sorted, with what’s next and who’s doing it.'},
];
type Box={top:number;left:number;width:number;height:number};

export function CoachTour(){
 const [on,setOn]=useState(false);const [i,setI]=useState(0);const [box,setBox]=useState<Box|null>(null);
 useEffect(()=>{if(new URLSearchParams(window.location.search).get('tour')==='1')queueMicrotask(()=>setOn(true));},[]);
 const measure=useCallback(()=>{const el=document.querySelector<HTMLElement>(`.bear-nav a[href="${STEPS[i].href}"]:not(.nav-brand)`);
  if(!el){setBox(null);return;}const r=el.getBoundingClientRect();const pad=6;setBox({top:r.top-pad,left:r.left-pad,width:r.width+pad*2,height:r.height+pad*2});},[i]);
 useLayoutEffect(()=>{if(!on)return;const raf=requestAnimationFrame(measure);window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
  return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};},[on,measure]);
 const close=()=>{setOn(false);try{const u=new URL(window.location.href);u.searchParams.delete('tour');window.history.replaceState(null,'',u.pathname+u.search);}catch{/* fine */}};
 useEffect(()=>{if(!on)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);});
 if(!on)return null;
 const s=STEPS[i];const last=i===STEPS.length-1;
 // The note sits above the spotlight when the place is in the lower half of the screen (the phone's bottom bar), below it otherwise.
 const vh=typeof window!=='undefined'?window.innerHeight:800;const above=!!box&&box.top>vh/2;
 const note:React.CSSProperties=box?(above?{bottom:vh-box.top+14}:{top:box.top+box.height+14}):{top:'40%'};
 return <div className="coach" role="dialog" aria-modal="true" aria-labelledby="coach-title">
  {box?<div className="coach-spot" style={{top:box.top,left:box.left,width:box.width,height:box.height}}/>:<div className="coach-dim"/>}
  <div className="coach-note" style={note}>
   <p className="coach-count small muted">{i+1} of {STEPS.length}</p>
   <h2 id="coach-title" className="coach-title">{s.title}</h2>
   <p className="coach-text">{s.text}</p>
   <div className="coach-actions">
    {!last&&<button type="button" className="one-thing-link" onClick={close}>Skip</button>}
    <button type="button" className="btn coral sm" autoFocus onClick={()=>last?close():setI(i+1)}>{last?'Got it':'Next'}</button>
   </div>
  </div>
 </div>;
}
