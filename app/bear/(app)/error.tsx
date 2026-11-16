'use client';
// If a screen ever fails to draw, she gets a plain message and a way out, never a blank or stuck screen.
import {useEffect} from 'react';
import Link from 'next/link';
export default function ScreenError({error,reset}:{error:Error&{digest?:string};reset:()=>void}){
 useEffect(()=>{console.error('[bear] screen error',error);},[error]);
 return <main id="main" className="bear-screen">
  <h1 style={{fontSize:24}}>This screen didn’t load</h1>
  <p className="small muted" style={{marginTop:8}}>Nothing you gave Bear has been lost. Try again, or open one of the other screens.</p>
  <div className="btn-row" style={{marginTop:16}}>
   <button type="button" className="btn coral" onClick={()=>reset()}>Try again</button>
   <button type="button" className="btn ghost" onClick={()=>window.location.reload()}>Reload the app</button>
  </div>
  <p className="small" style={{marginTop:18}}><Link href="/bear/overview" className="link-btn">Your areas</Link> · <Link href="/bear/calendar" className="link-btn">Calendar</Link> · <Link href="/bear/capture" className="link-btn">Talk to Bear</Link></p>
  <p className="tiny faint" style={{marginTop:18}}>Details for support: {error.message?.slice(0,200)||'unknown'}{error.digest?` (${error.digest})`:''}</p>
 </main>;
}
