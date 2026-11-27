'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {Art} from './art';
import {HowBearWorks} from './how-bear-works';

// First run: three short screens on what Bear does, one optional question, then straight to telling Bear what's on her mind.
// Nothing else is asked up front. Her name comes from signing up and her country from her phone's settings; how her days
// work, who can help and how Bear should reach her are asked later, where they matter (all still in Settings).
const FOCUS=[
 {key:'clear_head',icon:'🧠',label:'Clear my head',assist:['organise','what_needs_attention']},
 {key:'get_done',icon:'✓',label:'Get things done',assist:['find_moments','prepare']},
 {key:'moment',icon:'☕',label:'Find a moment for myself',assist:['take_off_plate']},
] as const;
const guessCountry=()=>{try{const r=(navigator.language||'').split('-')[1]?.toUpperCase();return r==='AU'||r==='CA'||r==='US'?r:null;}catch{return null;}};

export function FirstRun(){
 const router=useRouter();
 const [stage,setStage]=useState<'loading'|'tour'|'focus'>('loading');const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 useEffect(()=>{apiGet<{profile:{tourSeenAt?:string|null;onboardingComplete?:boolean}}>('/api/bear/profile')
  .then(({profile})=>{if(profile.onboardingComplete){router.replace('/bear/capture');return;}setStage(profile.tourSeenAt?'focus':'tour');})
  .catch(e=>{if((e as {status?:number}).status===401)router.replace('/bear/signin');else setStage('tour');});},[router]);
 async function done(focus:typeof FOCUS[number]|null){setBusy(true);setErr(null);
  try{await apiSend('/api/bear/adaptive',{answers:{...(focus?{assist:[...focus.assist]}:{}),country:guessCountry()},complete:true});
   router.replace('/bear/capture?first=1');}
  catch(e){setErr((e as Error).message||'That didn’t save. Try again.');setBusy(false);}}
 if(stage==='loading')return <main id="main" className="bear-screen v2-screen ob"/>;
 if(stage==='tour')return <HowBearWorks onboarding onDone={()=>setStage('focus')}/>;
 return <main id="main" className="bear-screen v2-screen ob">
  <div className="ob-top ob-top-solo"><span/><button type="button" className="ob-skip" disabled={busy} onClick={()=>done(null)}>Skip</button></div>
  <section className="ob-q" aria-live="polite">
   <Art file="ob-q-how-done" className="ob-art"/>
   <h1 className="ob-h">What would help most right now?</h1>
   <ul className="ob-options" role="radiogroup" aria-label="What would help most right now?">
    {FOCUS.map(f=><li key={f.key}><button type="button" role="radio" aria-checked={false} className="ob-opt ob-opt-icon" disabled={busy} onClick={()=>done(f)}><span className="ob-icon" aria-hidden="true">{f.icon}</span>{f.label}</button></li>)}
   </ul>
   {err&&<p className="note coral" role="alert">{err}</p>}
  </section>
 </main>;
}
