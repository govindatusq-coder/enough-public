'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {areaLabels} from '@/lib/bear/domain/labels';
import type {WishlistView} from '@/lib/bear/services/task-edit';
import {Button,ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

export default function WishlistPage(){
 const router=useRouter();const [data,setData]=useState<WishlistView|null>(null);const [error,setError]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<WishlistView>('/api/bear/wishlist').then(d=>{setData(d);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}}/>
   <h1>Wishlist</h1><p className="muted" style={{marginTop:6}}>Bigger things you want to buy when the time is right. They stay off your main screen, and Bear checks back when you ask it to.</p>
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {!data&&!error&&<div className="section"><Skeleton/></div>}
   {data&&<section className="section">{data.items.length===0?<div className="card"><p className="muted">Nothing on your wishlist. When Bear asks about a bigger spend, choose &ldquo;I&rsquo;m not sure yet&rdquo; and it will wait here.</p><div className="btn-row"><Button href="/bear/home" className="sm" variant="ghost">Back to My Bear</Button></div></div>:<div className="card">{data.items.map(i=><Link key={i.taskId} href={`/bear/tasks/${i.taskId}`} className="row" style={{textDecoration:'none',color:'inherit'}}><span className="grow"><span className="title">{i.title}</span><br/><span className="faint">{[i.estimate?`about ${i.estimate}`:null,i.checkBackAt?`Check back ${formatAU(i.checkBackAt,'long')}`:'No date set',i.areaKey?areaLabels[i.areaKey]:null].filter(Boolean).join(' · ')}</span></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{color:'var(--ink-3)'}}><path d="M9 6l6 6-6 6"/></svg></Link>)}</div>}</section>}
  </main>
 );
}
