'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU} from '@/lib/bear/domain/dates';
import type {WinsView} from '@/lib/bear/services/wins';
import {Art,EmptyArt,RoundBadge} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,Sheet,Skeleton,Toast} from '@/components/bear/ui';
export function WinsScreen(){
 const router=useRouter();const params=useSearchParams();const just=params.get('just');
 const [data,setData]=useState<WinsView|null>(null);const [error,setError]=useState<string|null>(null);
 const [metric,setMetric]=useState<null|'handled'|'money'|'time'|'forMe'>(null);
 const [editing,setEditing]=useState<WinsView['cards'][number]|null>(null);const [saved,setSaved]=useState('');const [why,setWhy]=useState('early_discount_used');const [busy,setBusy]=useState(false);const [toast,setToast]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<WinsView>('/api/bear/wins').then(d=>{setData(d);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);

 function openEdit(c:WinsView['cards'][number]){const mine=c.counted.find(x=>x.mine);setSaved(mine?(mine.cents/100).toFixed(2):'');setWhy('early_discount_used');setEditing(c);}
 async function saveSaving(){if(!editing)return;const cents=saved.trim()?Math.round(Number(saved.replace(/[^0-9.]/g,''))*100):0;if(!Number.isFinite(cents)){setToast('Type the amount as numbers, like 15.00.');return;}
  setBusy(true);try{await apiSend(`/api/bear/wins/${editing.id}/saving`,{cents,reason:why});setEditing(null);setToast(cents>0?'Saving counted.':'Saving removed.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function makeCurrent(){if(!editing?.taskId)return;setBusy(true);try{await apiSend(`/api/bear/tasks/${editing.taskId}/reopen`,{});router.push(editing.billId?`/bear/bills/${editing.billId}`:`/bear/tasks/${editing.taskId}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 const minutes=data?.totals.timeMinutes||0;
 return (
  <main id="main" className="bear-screen">
   <h1>{brand.winsHeading}</h1><p className="muted" style={{marginTop:6}}>{brand.winsSub}</p>
   {just&&<div className="glass" style={{padding:16,marginTop:16,display:'flex',gap:12,alignItems:'center'}}><RoundBadge size={88}/><div><BearSays>{brand.oneLess}</BearSays><p className="small muted">{just}</p></div></div>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {!data&&!error&&<div className="section"><Skeleton/></div>}
   {data&&<>
    <div className="metrics section" aria-label="Totals">
     <button type="button" className="metric" onClick={()=>setMetric('handled')} aria-label={`Things handled: ${data.totals.handled}. See what they were.`}><Art file="badge-round" className="metric-img" alt="" style={{width:58,height:58,borderRadius:'50%',objectFit:'cover',mixBlendMode:'normal'}}/><b>{data.totals.handled}</b><span>Things handled</span><i aria-hidden="true">See what</i></button>
     <button type="button" className="metric" onClick={()=>setMetric('money')} aria-label="Money protected. See how."><Art file="ledger-wealth" className="metric-img" alt=""/><b>{data.totals.moneyCents?formatAUD(data.totals.moneyCents):'—'}</b><span>Money protected</span><i aria-hidden="true">See how</i></button>
     <button type="button" className="metric" onClick={()=>setMetric('time')} aria-label="Time protected. See how."><Art file="ledger-happiness" className="metric-img" alt=""/><b>{minutes?`${Math.floor(minutes/60)}h ${minutes%60}m`:'—'}</b><span>Time protected</span><i aria-hidden="true">See how</i></button>
     <button type="button" className="metric" onClick={()=>setMetric('forMe')} aria-label="Things for me. See what."><Art file="ledger-health" className="metric-img" alt=""/><b>{data.totals.forMe||'—'}</b><span>Things for me</span><i aria-hidden="true">See what</i></button>
    </div>
    <div className="section">
     {data.cards.length===0&&<div className="card" style={{textAlign:'center'}}><EmptyArt file="empty-wins"/><p style={{fontWeight:700,fontSize:19}}>{brand.winsEmpty}</p><p className="muted small" style={{marginTop:4}}>{brand.winsSub}</p><BearSays size={22}>{brand.oneLess}</BearSays></div>}
     {data.cards.some(c=>c.isDemo)&&<p className="faint" style={{marginBottom:10}}>Example bills show here so you can see how it works, but they never count towards your totals.</p>}
     {data.cards.map(c=><div key={c.id} className="receipt" data-area={c.areaKey}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start'}}><p><span className="tick" aria-hidden="true">✓</span><strong>{c.title}</strong></p><span style={{display:'flex',gap:6,alignItems:'center',flex:'none'}}>{c.isDemo&&<span className="demo-tag">Example</span>}<span className="area-pill">{c.areaLabel}</span></span></div><p className="small muted" style={{marginTop:4,paddingLeft:22}}>{c.detail}</p><p className="tiny faint" style={{marginTop:4,paddingLeft:22}}>{formatAU(c.when.slice(0,10),'short')}</p>{!c.isDemo&&c.taskId&&<div className="btn-row" style={{paddingLeft:22,marginTop:6}}><Button className="sm" variant="ghost" onClick={()=>openEdit(c)}>Edit</Button></div>}</div>)}
     {data.reinforcement&&<BearSays size={22}>{data.reinforcement}</BearSays>}
    </div>
   </>}
   {metric&&<Sheet onClose={()=>setMetric(null)} label="Details">
    {metric==='handled'&&<><h2>Things handled</h2><p className="muted small" style={{marginTop:6}}>Everything you and Bear have finished. Examples never count.</p><div className="metric-list">{data!.cards.filter(c=>!c.isDemo).length===0?<p className="muted">Nothing finished yet. When you mark something done, it lands here.</p>:data!.cards.filter(c=>!c.isDemo).map(c=><div key={c.id} className="metric-row" data-area={c.areaKey}><span><strong>{c.title}</strong><br/><span className="small muted">{c.detail}</span></span><span className="area-pill">{c.areaLabel}</span></div>)}</div></>}
    {metric==='money'&&<><h2>Money protected</h2><p className="muted small" style={{marginTop:6}}>Counted only when a bill states a late fee or discount you earned, or when you told Bear about a saving. Bear never guesses an amount.</p><div className="metric-list">{data!.breakdown.money.length===0?<p className="muted">Nothing counted yet. Pay a bill with a stated fee or discount in time, or tell Bear about a saving from My Wins, and it appears here.</p>:data!.breakdown.money.map((m,i)=><div key={i} className="metric-row"><span><strong>{m.reason}</strong>{m.mine?' (you told Bear)':''}<br/><span className="small muted">{m.label} · {formatAU(m.when.slice(0,10),'short')}</span></span><b>{formatAUD(m.cents)}</b></div>)}{data!.breakdown.money.length>0&&<div className="metric-row total"><span><strong>Total</strong></span><b>{formatAUD(data!.totals.moneyCents)}</b></div>}</div></>}
    {metric==='time'&&<><h2>Time protected</h2><p className="muted small" style={{marginTop:6}}>Time is only counted when Bear can measure it. It never makes up a number.</p><div className="metric-list">{data!.breakdown.time.length===0?<p className="muted">Nothing counted yet. This fills in as Bear learns how long things really take you.</p>:data!.breakdown.time.map((m,i)=><div key={i} className="metric-row"><span><strong>{m.label}</strong><br/><span className="small muted">{formatAU(m.when.slice(0,10),'short')}</span></span><b>{m.minutes} min</b></div>)}</div></>}
    {metric==='forMe'&&<><h2>Things for me</h2><p className="muted small" style={{marginTop:6}}>Things you did for yourself, like your own appointments.</p><div className="metric-list">{data!.breakdown.forMe.length===0?<p className="muted">Nothing yet. When you finish something that is just for you, it is counted here.</p>:data!.breakdown.forMe.map((m,i)=><div key={i} className="metric-row"><span><strong>{m.title}</strong><br/><span className="small muted">{formatAU(m.when.slice(0,10),'short')}</span></span></div>)}</div></>}
    <div className="btn-stack"><Button variant="quiet" onClick={()=>setMetric(null)}>Close</Button></div>
   </Sheet>}
   {editing&&<Sheet onClose={()=>setEditing(null)} label="Edit this win">
    <h2>{editing.title}</h2><p className="muted small" style={{marginTop:6}}>{editing.detail}</p>
    {editing.counted.length>0&&<div className="note plain" style={{marginTop:12}}><div><p style={{fontWeight:600}}>Counted so far</p><ul style={{margin:'6px 0 0 18px',padding:0}}>{editing.counted.map((x,i)=><li key={i} className="small">{formatAUD(x.cents)} · {x.label}{x.mine?' (you told Bear)':''}</li>)}</ul></div></div>}
    <div className="field" style={{marginTop:14}}><label htmlFor="w-saved">Did this save you money?</label><input id="w-saved" inputMode="decimal" placeholder="Amount saved, like 15.00" value={saved} onChange={e=>setSaved(e.target.value)}/><select aria-label="How you saved" value={why} onChange={e=>setWhy(e.target.value)} style={{marginTop:8}}><option value="early_discount_used">Paid early for a discount</option><option value="late_fee_avoided">Avoided a late fee</option><option value="discount_used">A discount or rebate</option><option value="better_price">A better price</option></select><span className="hint">Only if you know the amount. Bear never guesses. It counts as something you told it, and replaces any amount you told it before. Leave it empty to remove it.</span></div>
    <div className="btn-stack"><Button variant="coral" disabled={busy} onClick={saveSaving}>Save</Button>{editing.taskId&&<Link className="btn ghost" href={editing.billId?`/bear/bills/${editing.billId}`:`/bear/tasks/${editing.taskId}`}>Open details to edit</Link>}<Button variant="quiet" disabled={busy} onClick={makeCurrent}>Make this current again</Button></div>
   </Sheet>}
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
