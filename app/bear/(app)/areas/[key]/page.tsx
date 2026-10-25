'use client';
import {use,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import type {AreaDetail,AreaItem} from '@/lib/bear/services/areas';
import {Button,ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

const kindLabel:Record<string,string>={bill:'Bill',appointment:'Appointment',school:'School',form:'Form',errand:'Errand',shopping:'Shopping',message:'From a message',note:'Note',event:'Event',custom:'Task'};
function Row({item}:{item:AreaItem}){
 const href=item.billId?`/bear/bills/${item.billId}`:`/bear/tasks/${item.taskId}`;
 const bits=[kindLabel[item.kind]||'Task',item.part?`Part ${item.part}`:null,item.overdueDays>0?'__overdue__':item.dueLabel,item.amount,item.estimate,item.stepsLeft?`${item.stepsLeft} ${item.stepsLeft===1?'purchase':'purchases'} left`:item.itemsLeft?`${item.itemsLeft} to get`:null].filter(Boolean);
 return <Link href={href} className="row" style={{textDecoration:'none',color:'inherit'}}><span className="grow"><span className="title">{item.title}{item.isDemo&&<span className="demo-tag" style={{marginLeft:8}}>Example</span>}</span><br/><span className="faint">{bits.map((b,i)=><span key={i}>{i>0?' · ':''}{b==='__overdue__'?<b className="overdue-text">{item.dueLabel}</b>:b}</span>)}</span></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{color:'var(--ink-3)'}}><path d="M9 6l6 6-6 6"/></svg></Link>;
}
export default function AreaPage({params}:{params:Promise<{key:string}>}){
 const {key}=use(params);const router=useRouter();
 const [data,setData]=useState<AreaDetail|null>(null);const [error,setError]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<AreaDetail>(`/api/bear/areas/${key}`).then(d=>{setData(d);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[key,router]);
 useEffect(()=>{load();},[load]);
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}}/>
   {error&&<ErrorCard message={error} retry={load}/>}
   {!data&&!error&&<Skeleton/>}
   {data&&<>
    <h1>{data.label}</h1>
    <section className="section"><p className="eyebrow">Current{data.current.length?` · ${data.current.length}`:''}</p>
     {data.current.length===0?<div className="card"><p className="muted">Nothing current in {data.label}. Give Bear something and it will turn up here.</p><div className="btn-row"><Button href="/bear/capture" className="sm">Give it to Bear</Button></div></div>:<div className="card">{data.current.map(i=><Row key={i.taskId} item={i}/>)}</div>}
    </section>
    {data.done.length>0&&<section className="section"><p className="eyebrow">Done · tap one to change it or make it current again</p><div className="card">{data.done.map(i=><Row key={i.taskId} item={i}/>)}</div></section>}
   </>}
  </main>
 );
}
