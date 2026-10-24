'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU} from '@/lib/bear/domain/dates';
import type {WinsView} from '@/lib/bear/services/wins';
import {EmptyArt,RoundBadge} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
export function WinsScreen(){
 const router=useRouter();const params=useSearchParams();const just=params.get('just');
 const [data,setData]=useState<WinsView|null>(null);const [error,setError]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<WinsView>('/api/bear/wins').then(d=>{setData(d);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 const minutes=data?.totals.timeMinutes||0;
 return (
  <main id="main" className="bear-screen">
   <h1>{brand.winsHeading}</h1><p className="muted" style={{marginTop:6}}>{brand.winsSub}</p>
   {just&&<div className="glass" style={{padding:16,marginTop:16,display:'flex',gap:12,alignItems:'center'}}><RoundBadge size={88}/><div><BearSays>{brand.oneLess}</BearSays><p className="small muted">{just}</p></div></div>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {!data&&!error&&<div className="section"><Skeleton/></div>}
   {data&&<>
    <div className="totals section" aria-label="Totals">
     <div className="t"><b>{data.totals.handled}</b><span>Things handled</span></div>
     <div className="t"><b>{data.totals.moneyCents?formatAUD(data.totals.moneyCents):'—'}</b><span>Money protected</span></div>
     <div className="t"><b>{minutes?`${Math.floor(minutes/60)}h ${minutes%60}m`:'—'}</b><span>Time protected</span></div>
     <div className="t"><b>{data.totals.forMe||'—'}</b><span>Things for me</span></div>
    </div>
    <div className="section">
     {data.cards.length===0&&<div className="card" style={{textAlign:'center'}}><EmptyArt file="empty-wins"/><p style={{fontWeight:700,fontSize:19}}>{brand.winsEmpty}</p><p className="muted small" style={{marginTop:4}}>{brand.winsSub}</p><BearSays size={22}>{brand.oneLess}</BearSays></div>}
     {data.cards.some(c=>c.isDemo)&&<p className="faint" style={{marginBottom:10}}>Example bills show here so you can see how it works, but they never count towards your totals.</p>}
     {data.cards.map(c=><div key={c.id} className="receipt"><div style={{display:'flex',justifyContent:'space-between',gap:10}}><p><span className="tick" aria-hidden="true">✓</span><strong>{c.title}</strong></p>{c.isDemo&&<span className="demo-tag">Example</span>}</div><p className="small muted" style={{marginTop:4,paddingLeft:22}}>{c.detail}</p><p className="tiny faint" style={{marginTop:4,paddingLeft:22}}>{formatAU(c.when.slice(0,10),'short')}</p></div>)}
     {data.reinforcement&&<BearSays size={22}>{data.reinforcement}</BearSays>}
    </div>
   </>}
  </main>
 );
}
