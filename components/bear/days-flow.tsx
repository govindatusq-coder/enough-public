'use client';
// "How your days work": one question per screen, big options, every question skippable, about a minute in all. Used for
// onboarding and again from Settings. Bear scores the answers on the server (no AI) and suggests lists that suit; she can
// keep them, pick another style, edit them, or keep what she has. Nothing is switched on (like notifications) from these.
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {Art} from './art';
import {HowBearWorks} from './how-bear-works';

type One={key:string;label:string};
type Q={id:'control'|'howDone'|'barriers'|'assist'|'helpers'|'comms'|'country';q:string;sub?:string;multi?:boolean;options:One[];art:string};
const QUESTIONS:Q[]=[
 {id:'control',art:'ob-q-control',q:'How much control do you usually have over your day?',options:[{key:'plan_own',label:'I can usually plan my own time.'},{key:'fixed_routine',label:'My day follows a fairly fixed routine.'},{key:'flexible_changing',label:'I have flexibility, but things change constantly.'},{key:'depends_others',label:'My time mostly depends on other people.'},{key:'depends_day',label:'It really depends on the day.'}]},
 {id:'howDone',art:'ob-q-how-done',q:'When you get something done, how does it usually happen?',options:[{key:'in_advance',label:'I make time for it in advance.'},{key:'routine',label:'I fit it into my usual routine.'},{key:'grab_moment',label:'I grab a moment when I can.'},{key:'when_urgent',label:'Usually when it becomes urgent.'},{key:'someone_helps',label:'Someone else helps me get it done.'}]},
 {id:'barriers',art:'ob-q-barriers',q:'What tends to get in your way?',sub:'Pick as many as you like.',multi:true,options:[{key:'competing',label:'Too many things competing for my attention.'},{key:'not_enough_time',label:'Not enough time.'},{key:'interruptions',label:'Constant interruptions.'},{key:'exhausted',label:'Feeling mentally exhausted.'},{key:'depend_on_others',label:'Having to depend on other people.'},{key:'remembering',label:'Remembering everything that needs doing.'},{key:'getting_started',label:'Getting started.'},{key:'following_up',label:'Having to follow things up.'}]},
 {id:'assist',art:'ob-q-assist',q:'What would you most like Bear to help you with?',sub:'Pick as many as you like.',multi:true,options:[{key:'organise',label:'Organise everything on my mind.'},{key:'what_needs_attention',label:'Help me work out what needs attention.'},{key:'find_moments',label:'Find things I can do when I have a moment.'},{key:'prepare',label:'Prepare things so I can just finish them.'},{key:'share',label:'Help me share responsibilities with others.'},{key:'take_off_plate',label:'Take things off my plate.'}]},
 {id:'helpers',art:'ob-q-helpers',q:'Can other people help with some of your responsibilities?',options:[{key:'regularly',label:'Yes, regularly.'},{key:'sometimes_if_organised',label:'Sometimes, if I organise it.'},{key:'rarely',label:'Rarely.'},{key:'independent',label:'I’d rather work independently.'},{key:'depends',label:'It depends on the responsibility.'}]},
 {id:'comms',art:'ob-q-comms',q:'How would you like Bear to help you throughout the day?',sub:'You can change this any time. Notifications stay off until you turn them on.',options:[{key:'only_when_open',label:'Only when I open the app.'},{key:'daily_checkin',label:'A gentle daily check-in.'},{key:'important_only',label:'When something important needs attention.'},{key:'as_i_go',label:'Help me decide as I go.'}]},
 {id:'country',art:'ob-q-country',q:'Where do you live?',sub:'For dates, money and holidays.',options:[{key:'AU',label:'Australia'},{key:'CA',label:'Canada'},{key:'US',label:'United States'},{key:'Other',label:'Somewhere else'}]},
];
type Answers=Partial<Record<Q['id'],string|string[]|null>>;
type View={temporal:unknown;explanation:string|null;recommended:string;style:string|null;country:string|null;lists:{id:string;title:string;icon:string}[];
 sets:{style:string;name:string;line:string;lists:{id:string;title:string;icon:string}[]}[]};
const guessCountry=()=>{try{const r=(navigator.language||'').split('-')[1]?.toUpperCase();return r==='AU'||r==='CA'||r==='US'?r:null;}catch{return null;}};

export function DaysFlow({mode}:{mode:'onboarding'|'settings'}){
 const router=useRouter();
 // -2: the three-screen "How Bear works" (first time only); -1: the welcome; 0+: one question per screen.
 const [step,setStep]=useState(mode==='onboarding'?-1:0);const [a,setA]=useState<Answers>({});const [name,setName]=useState('');const [hadName,setHadName]=useState(false);
 const [view,setView]=useState<View|null>(null);const [pick,setPick]=useState<string|null>(null);const [choosing,setChoosing]=useState(false);
 const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 useEffect(()=>{apiGet<{profile:{name:string;tourSeenAt?:string|null;temporal?:{answers:Answers}|null;country?:string|null};user?:{name?:string|null}}>('/api/bear/profile').then(({profile,user})=>{const n=profile.name?.trim()||user?.name?.trim()||'';setName(n);setHadName(!!n);
  if(mode==='onboarding'&&!profile.tourSeenAt)setStep(-2);
  setA({...(profile.temporal?.answers||{}),country:profile.temporal?.answers?.country??profile.country??guessCountry()});}).catch(e=>{if((e as {status?:number}).status===401)router.replace('/bear/signin');});},[router,mode]);
 const q=step>=0&&step<QUESTIONS.length?QUESTIONS[step]:null;
 async function submit(){setBusy(true);setErr(null);
  try{const answers=Object.fromEntries(Object.entries(a).filter(([,v])=>v!==undefined));
   const v=await apiSend<View>('/api/bear/adaptive',{answers,...(mode==='onboarding'&&!hadName&&name.trim()?{name:name.trim()}:{})});setView(v);setPick(v.recommended);setStep(QUESTIONS.length);window.scrollTo({top:0});}
  catch(e){setErr((e as Error).message||'That didn’t save. Try again.');}finally{setBusy(false);}}
 const next=()=>{if(step+1>=QUESTIONS.length)submit();else{setStep(step+1);window.scrollTo({top:0});}};
 function choose(k:string){if(!q)return;if(q.multi){const cur=(a[q.id] as string[]|undefined)||[];setA({...a,[q.id]:cur.includes(k)?cur.filter(x=>x!==k):[...cur,k]});return;}
  setA({...a,[q.id]:k});setTimeout(()=>{if(step+1>=QUESTIONS.length)submit();else{setStep(s=>s+1);window.scrollTo({top:0});}},180);}
 async function finish(style:string|null,then:'start'|'edit'){setBusy(true);setErr(null);
  try{if(style&&!(style==='classic'&&!view?.style))await apiSend('/api/bear/adaptive/lists',{style});
   if(mode==='onboarding')await apiSend('/api/bear/profile',{onboardingComplete:true},'PUT');
   router.replace(then==='edit'?'/bear/me/lists':mode==='onboarding'?'/bear/capture?first=1':'/bear/brain');}
  catch(e){setErr((e as Error).message||'That didn’t save. Try again.');setBusy(false);}}
 const total=QUESTIONS.length;
 const set=view?.sets.find(s=>s.style===pick)||null;

 if(step===-2)return <HowBearWorks onboarding onDone={()=>setStep(-1)}/>;
 return <main id="main" className="bear-screen v2-screen ob">
  {step>=0&&step<total&&<div className="ob-top">
   <button type="button" className="ob-back" onClick={()=>step>0?setStep(step-1):mode==='onboarding'?setStep(-1):router.back()} aria-label="Back">‹ Back</button>
   <div className="ob-dots" aria-label={`Question ${step+1} of ${total}`}>{QUESTIONS.map((_,i)=><i key={i} className={i<=step?'on':''}/>)}</div>
   <button type="button" className="ob-skip" disabled={busy} onClick={next}>Skip</button>
  </div>}
  {step===-1&&<section className="ob-intro">
   <Art file="ob-welcome" className="ob-art ob-hero"/>
   <h1 className="ob-h">Your life doesn’t always go to plan. That’s okay.</h1>
   <p className="ob-p">Tell Bear a little about how your days work, so she can help in a way that works for you.</p>
   {/* Her name comes from signing up; only asked here if Bear doesn't have it. */}
   {!hadName&&<label className="ob-name">What should Bear call you? <span>(optional)</span><input value={name} onChange={e=>setName(e.target.value)} maxLength={40} autoComplete="given-name" placeholder="Your first name"/></label>}
   <button type="button" className="btn coral wide ob-go" onClick={()=>setStep(0)}>Let’s start</button>
   <p className="ob-small">About a minute. Skip anything.</p>
  </section>}
  {q&&<section className="ob-q" aria-live="polite" key={q.id}>
   <Art file={q.art} className="ob-art"/>
   <h1 className="ob-h">{q.q}</h1>{q.sub&&<p className="ob-p">{q.sub}</p>}
   <ul className="ob-options" role={q.multi?'group':'radiogroup'} aria-label={q.q}>
    {q.options.map(o=>{const on=q.multi?((a[q.id] as string[]|undefined)||[]).includes(o.key):a[q.id]===o.key;
     return <li key={o.key}><button type="button" role={q.multi?'checkbox':'radio'} aria-checked={on} className={`ob-opt${on?' on':''}`} disabled={busy} onClick={()=>choose(o.key)}><span className="ob-tick" aria-hidden="true"/>{o.label}</button></li>;})}
   </ul>
   {q.multi&&<button type="button" className="btn coral wide ob-go" disabled={busy} onClick={next}>{busy?'One moment…':'Next'}</button>}
   {err&&<p className="note coral" role="alert">{err}</p>}
  </section>}
  {step===total&&view&&<section className="ob-done" aria-live="polite">
   <Art file="ob-done" className="ob-art ob-hero"/>
   <h1 className="ob-h">{name.trim()?`Thanks, ${name.trim()}.`:'Thanks.'}</h1>
   {view.explanation&&<p className="ob-explain">{view.explanation}</p>}
   {!choosing&&set&&<>
    <p className="ob-p">{pick==='classic'?'Bear will keep things in these lists:':'Here are some lists that might suit you:'}</p>
    <ul className="ob-lists">{set.lists.map(l=><li key={l.id}><span aria-hidden="true">{l.icon}</span>{l.title}</li>)}</ul>
    <div className="gm-actions">
     <button type="button" className="btn coral wide" disabled={busy} onClick={()=>finish(pick,'start')}>{busy?'One moment…':'Keep these lists'}</button>
     <button type="button" className="btn ghost wide" disabled={busy} onClick={()=>setChoosing(true)}>Choose a different style</button>
     <button type="button" className="btn quiet wide" disabled={busy} onClick={()=>finish(pick,'edit')}>Edit the lists</button>
    </div>
    {mode==='settings'&&view.style&&<p className="ob-small">Things in lists that change aren’t deleted. They go back to My Brain Dump, and Bear suggests a new place.</p>}
    {mode==='onboarding'&&<button type="button" className="ob-skip ob-later" disabled={busy} onClick={()=>finish(null,'start')}>Skip for now, keep Bear’s originals</button>}
   </>}
   {choosing&&<>
    <p className="ob-p">Choose how you’d like Bear Brain organised. You can rename, reorder or mix them later.</p>
    <ul className="ob-styles">{view.sets.map(s=><li key={s.style}><button type="button" className={`ob-style${pick===s.style?' on':''}`} aria-pressed={pick===s.style} onClick={()=>setPick(s.style)}>
     <strong>{s.name}{s.style===view.recommended?<em> · suggested</em>:null}</strong><span>{s.line}</span><span className="ob-style-lists">{s.lists.map(l=>`${l.icon} ${l.title}`).join(' · ')}</span></button></li>)}</ul>
    <button type="button" className="btn coral wide ob-go" disabled={busy} onClick={()=>setChoosing(false)}>Use these lists</button>
   </>}
   {err&&<p className="note coral" role="alert">{err}</p>}
  </section>}
 </main>;
}
