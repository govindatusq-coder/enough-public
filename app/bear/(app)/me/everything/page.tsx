'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import type {EverythingView} from '@/lib/bear/services/everything';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';
// The PARA view in plain words: Area → Project (one per thing you gave Bear) → steps.
export default function Everything(){
 const router=useRouter();const [data,setData]=useState<EverythingView|null>(null);const [error,setError]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<EverythingView>('/api/bear/everything').then(d=>{setData(d);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/me'}}/>
   <h1>Everything Bear is holding</h1><p className="muted" style={{marginTop:6}}>Grouped by the part of life it belongs to. Tap anything to open it.</p>
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {!data&&!error&&<div className="section"><Skeleton/></div>}
   {data&&data.areas.length===0&&<div className="card section"><p style={{fontWeight:600}}>Nothing here yet.</p><p className="muted small">Give Bear something and it will file it here.</p></div>}
   {data?.areas.map(a=><section key={a.key} className="section"><p className="eyebrow">{a.label}</p><div className="card">{a.projects.length===0&&<p className="muted small">Nothing open.</p>}{a.projects.map(p=><Link key={p.id} href={p.billId?`/bear/bills/${p.billId}`:p.taskId?`/bear/tasks/${p.taskId}`:'#'} className="row"><span className="grow"><span className="title">{p.title}</span><br/><span className="faint">{p.dueAt?formatAU(p.dueAt,'short'):'No date'}{p.openSteps?` · ${p.openSteps} ${p.openSteps===1?'step':'steps'}`:''}{p.hasResource?' · original kept':''}</span></span><span className="faint">›</span></Link>)}</div></section>)}
   {data&&data.archived>0&&<p className="faint" style={{marginTop:20}}>{data.archived} finished {data.archived===1?'thing is':'things are'} in My Wins.</p>}
  </main>
 );
}
