'use client';
// My Wins: how many things she has got done, and the latest ones crossed off. Just a count: no streaks, targets or badges,
// nothing to keep up. The money and time detail is one quiet link away.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import type {MyWins} from '@/lib/bear/services/my-wins';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

const when=(iso:string)=>new Date(iso).toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
export function MyWinsScreen(){
 const router=useRouter();const just=useSearchParams().get('just');
 const [d,setD]=useState<MyWins|null>(null);const [err,setErr]=useState<string|null>(null);
 const load=()=>apiGet<MyWins>('/api/bear/wins/summary').then(x=>{setD(x);setErr(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setErr(e.message);});
 useEffect(()=>{load();},[]);// eslint-disable-line react-hooks/exhaustive-deps
 return <main id="main" className="bear-screen v2-screen mw">
  <TopBar back={{href:'/bear/brain',label:'Bear Brain'}}/>
  <h1 className="mw-title">My Wins</h1>
  {just&&<p className="note teal" role="status">One less thing to carry. {just}</p>}
  {err&&<ErrorCard message={err} retry={load}/>}
  {!d&&!err&&<Skeleton/>}
  {d&&<>
   <section className="v2-card mw-count" aria-label="Things done">
    <b>{d.total}</b><span>{d.total===1?'thing done':'things done'}</span>
    <p>This week {d.week} · This month {d.month}</p>
   </section>
   {d.recent.length?<section className="v2-card mw-recent" aria-labelledby="mw-h"><h2 id="mw-h" className="v2-h3">Recently done</h2>
    <ul>{d.recent.map(r=><li key={r.taskId}><span className="mw-tick" aria-hidden="true">✓</span><span className="mw-done">{r.title}</span><time dateTime={r.at}>{when(r.at)}</time></li>)}</ul></section>
   :<p className="muted mw-empty">When you tick something off, it’ll show up here.</p>}
   <p className="mw-more"><Link href="/bear/wins/more">Money and time Bear protected</Link></p>
  </>}
 </main>;
}
