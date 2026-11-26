'use client';
// What Bear has learned from her choices, in four small stores she can see, correct or reset: where she puts things, which
// kinds of help she takes, when she tends to get things done, and what she asked Bear not to suggest. Plus her answers.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {AdaptiveLearning} from '@/lib/bear/adaptive/learning';
type View={temporal:{scoredAt:string}|null;lists:{id:string;title:string}[];learning:AdaptiveLearning|null};
const HELP:Record<string,string>={offload:'Bear getting things ready first',synchronise:'Doing things while places are open',match:'Small things that fit a moment',
 prioritise:'What’s needed soonest',adapt:'Things you can stop part-way',allocate:'Setting time aside',protect:'Taking a break instead'};
const nice=(s:string)=>s.replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase());
const hourText=(h:number)=>`${h%12||12} ${h<12?'am':'pm'}`;
export function AdaptiveLearned(){
 const [v,setV]=useState<View|null>(null);const [note,setNote]=useState<string|null>(null);
 const load=()=>apiGet<View>('/api/bear/adaptive').then(setV).catch(()=>{});
 useEffect(()=>{load();},[]);
 async function reset(what:'category'|'strategy'|'timing'|'feedback'|'profile',msg:string){await apiSend('/api/bear/adaptive/reset',{what}).catch(()=>{});setNote(msg);load();}
 async function allow(pattern:string,domain:string){await apiSend('/api/bear/adaptive/feedback',{pattern,domain},'DELETE').catch(()=>{});load();}
 if(!v)return null;const l=v.learning;const title=(id:string)=>v.lists.find(x=>x.id===id)?.title||id;
 const places=(l?.category||[]).filter(c=>c.explicit&&c.key.startsWith('d:')&&c.n>=2).sort((a,b)=>b.n-a.n).slice(0,6);
 const help=Object.entries(l?.strategy||{}).filter(([,c])=>c&&c.yes+c.no>=3).sort((a,b)=>(b[1]!.yes-b[1]!.no)-(a[1]!.yes-a[1]!.no));
 const t=l?.timing||[];const total=t.reduce((a,b)=>a+b,0);const hours=total>=8?t.map((n,h)=>({n,h})).filter(x=>x.n>=Math.max(2,total*.12)).sort((a,b)=>b.n-a.n).slice(0,3).map(x=>x.h):[];
 return <section className="section" aria-labelledby="al-h"><p className="eyebrow" id="al-h">From how you use Bear</p>
  <div className="card al">
   <div className="row"><span className="grow"><span className="title">Where you put things</span><br/>
    {places.length?<span className="faint">{places.map(p=>`${nice(p.key.slice(2))} → ${title(p.listId)}`).join(' · ')}</span>:<span className="faint">Nothing yet. When you move things into a list, Bear notices.</span>}</span>
    {!!l?.category.length&&<button type="button" className="btn quiet sm" onClick={()=>reset('category','Bear has forgotten where you put things. What you filed stays where it is.')}>Reset</button>}</div>
   <div className="row"><span className="grow"><span className="title">Kinds of help you take up</span><br/>
    {help.length?<span className="faint">{help.map(([k,c])=>`${HELP[k]||k}: ${c!.yes} yes, ${c!.no} not now`).join(' · ')}</span>:<span className="faint">Nothing yet.</span>}</span>
    {help.length>0&&<button type="button" className="btn quiet sm" onClick={()=>reset('strategy','Forgotten.')}>Reset</button>}</div>
   <div className="row"><span className="grow"><span className="title">When you usually get things done</span><br/>
    <span className="faint">{hours.length?`Often around ${hours.map(hourText).join(', ')}`:'Not enough to go on yet.'}</span></span>
    {total>0&&<button type="button" className="btn quiet sm" onClick={()=>reset('timing','Forgotten.')}>Reset</button>}</div>
   <div className="row"><span className="grow"><span className="title">Things you asked Bear not to suggest</span><br/>
    {l?.suppressed?.length?<span className="al-chips">{l.suppressed.map(x=><button key={x.pattern+x.domain} type="button" className="chip" onClick={()=>allow(x.pattern,x.domain)}>{nice(x.domain)} ({x.pattern}) · Allow again</button>)}</span>:<span className="faint">None.</span>}</span></div>
   <div className="row"><span className="grow"><span className="title">How your days work</span><br/><span className="faint">{v.temporal?'Bear uses your answers to choose how to help.':'Not answered yet.'}</span></span>
    <Link href="/bear/me/days" className="btn quiet sm">{v.temporal?'Change':'Answer'}</Link>
    {v.temporal&&<button type="button" className="btn quiet sm" onClick={()=>reset('profile','Bear has forgotten your answers and helps as it does for everyone.')}>Forget</button>}</div>
  </div>
  {note&&<p className="note teal" role="status" style={{marginTop:10}}>{note}</p>}
 </section>;
}
