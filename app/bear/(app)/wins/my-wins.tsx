'use client';
// My Wins: a little celebration. What she has got done, the time and money Bear estimates it saved her, and the latest
// things crossed off, on a confetti-strewn floor. No streaks, targets or badges; nothing to keep up.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import type {MyWins} from '@/lib/bear/services/my-wins';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
import {SmartBack} from '@/components/bear/smart-back';
import {confetti} from '@/components/bear/celebrate';
import {formatAUD} from '@/lib/bear/domain/money';

const hours=(m:number)=>m<60?`${m} min`:`${Math.floor(m/60)} h${m%60?` ${m%60} min`:''}`;
const when=(iso:string)=>new Date(iso).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
export function MyWinsScreen(){
 const router=useRouter();const just=useSearchParams().get('just');
 const [d,setD]=useState<MyWins|null>(null);const [err,setErr]=useState<string|null>(null);
 const load=()=>apiGet<MyWins>('/api/bear/wins/summary').then(x=>{setD(x);setErr(null);if(x.total>0)setTimeout(()=>confetti(document.querySelector('.mw-count')),250);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setErr(e.message);});
 useEffect(()=>{load();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 return <main id="main" className="bear-screen v2-screen mw mw-party">
  <SmartBack fallback={{href:'/bear/brain',label:'Bear Brain'}}/>
  <h1 className="mw-title"><span aria-hidden="true">🎉 </span>My Wins</h1>
  {just&&<p className="note teal" role="status">One less thing to carry. {just}</p>}
  {err&&<ErrorCard message={err} retry={load}/>}
  {!d&&!err&&<Skeleton/>}
  {d&&<>
   <section className="v2-card mw-count" aria-label="Things done">
    <b>{d.total}</b><span>{d.total===1?'thing done':'things done'}</span>
    <p>This week {d.week} · This month {d.month}</p>
   </section>
   <div className="mw-saved">
    <section className="v2-card mw-tile" aria-label="Time saved, estimated"><span className="mw-emoji" aria-hidden="true">⏱️</span>{d.timeMinutes?<b>{hours(d.timeMinutes)}</b>:<b className="mw-none">None yet</b>}<span>time saved</span></section>
    <section className="v2-card mw-tile" aria-label="Money saved, estimated"><span className="mw-emoji" aria-hidden="true">💰</span>{d.moneyCents?<b>{formatAUD(d.moneyCents)}</b>:<b className="mw-none">None yet</b>}<span>money saved</span></section>
   </div>
   <p className="mw-est">Estimates. Time is what Bear’s own preparation saved you; money is only savings Bear can show, like a late fee avoided.</p>
   {d.recent.length?<section className="v2-card mw-recent" aria-labelledby="mw-h"><h2 id="mw-h" className="v2-h3">Recently done</h2>
    <ul>{d.recent.map(r=><li key={r.taskId}><span className="mw-tick" aria-hidden="true">✓</span><span className="mw-done">{r.title}</span><time dateTime={r.at}>{when(r.at)}</time></li>)}</ul></section>
   :<p className="muted mw-empty">When you tick something off, it’ll show up here.</p>}
   <p className="mw-more"><Link href="/bear/wins/more">Money and time Bear protected</Link></p>
  </>}
 </main>;
}
