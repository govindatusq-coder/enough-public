'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand,dayModeReply} from '@/lib/bear/domain/copy';
import type {DayMode} from '@/lib/bear/domain/types';
import type {HomeView,NeedsYouItem} from '@/lib/bear/services/home';
import {Art} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,Skeleton,Toast,useOnline} from '@/components/bear/ui';
import {showLocalReminder} from '@/components/bear/runtime';

const modes:{key:DayMode;label:string}[]=[{key:'good',label:'Good'},{key:'full',label:'Full'},{key:'wiped',label:'Wiped'},{key:'chaos',label:'Chaos'}];
export default function Home(){
 const router=useRouter();const online=useOnline();
 const [home,setHome]=useState<HomeView|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState<string|null>(null);const [aiAvailable,setAiAvailable]=useState(true);
 const delivered=useRef(new Set<string>());
 const load=useCallback(()=>apiGet<{home?:HomeView;onboarding?:boolean;aiAvailable?:boolean}>('/api/bear/home').then(res=>{if(res.onboarding){router.replace('/bear/onboarding');return;}setHome(res.home!);setAiAvailable(res.aiAvailable!==false);setError(null);
   for(const item of res.home!.needsYou){if(item.reminderId&&!delivered.current.has(item.reminderId)){delivered.current.add(item.reminderId);apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'in_app'}).catch(()=>{});showLocalReminder(item.reminderId,item.message||`${item.title} needs you.`,`/bear/bills/${item.billId}?reminder=${item.reminderId}`).then(ok=>{if(ok)apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'local'}).catch(()=>{});});}}
  }).catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{load();const onVis=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);},[load]);
 async function setMode(mode:DayMode){setBusy('mode');try{const res=await apiSend<{reply:string|null}>('/api/bear/day',{mode:home?.dayMode===mode?null:mode});setToast(res.reply||'Noted.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 async function act(item:NeedsYouItem,key:string){if(!item.reminderId){router.push(`/bear/bills/${item.billId}`);return;}
  if(key==='help'||key==='break_down'){router.push(`/bear/bills/${item.billId}?reminder=${item.reminderId}`);return;}
  setBusy(item.reminderId);
  try{if(key==='tonight')await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'snoozed',detail:'tonight'});
   else if(key==='another_time')await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'snoozed',detail:'tomorrow'});
   else if(key==='drop'){if(!confirm('Tell Bear this is not important anymore?'))return;await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'not_important'});}
   setToast(key==='drop'?'Let go. One less thing.':"No worries. Bear will find another time.");await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 async function demo(){setBusy('demo');try{const res=await apiSend<{capture:{id:string}}>('/api/bear/demo',{});router.push(`/bear/verify/${res.capture.id}`);}catch(e){setError((e as Error).message);setBusy(null);}}
 if(error&&!home)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/></main>;
 if(!home)return <main id="main" className="bear-screen"><div className="skeleton" style={{minHeight:40,maxWidth:220,marginBottom:16}}/><Skeleton/></main>;
 const needs=home.needsYou;
 return (
  <main id="main" className="bear-screen">
   <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
    <div><h1 style={{fontSize:28}}>{home.greeting}</h1><p className="muted" style={{marginTop:6}}>{home.coveredCount>0?`Bear's got ${home.coveredCount} ${home.coveredCount===1?'thing':'things'} covered.`:"Bear's ready when you are."}</p></div>
    <Link href="/bear/me" aria-label="Me"><Art file="home-head" width={96} alt="Mama Bear"/></Link>
   </header>
   {!online&&<p className="note" style={{marginTop:14}} role="status">You&rsquo;re offline. Showing what Bear last knew.</p>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   <section className="section" aria-labelledby="how">
    <div className="glass" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><span id="how" className="small" style={{fontWeight:600}}>How&rsquo;s today?</span><div className="chips" style={{gap:6}}>{modes.map(m=><button key={m.key} type="button" className="chip" style={{minHeight:38,padding:'0 12px',fontSize:14}} aria-pressed={home.dayMode===m.key} disabled={busy==='mode'} onClick={()=>setMode(m.key)}>{m.label}</button>)}</div></div>
    {home.dayMode&&<p className="hand" style={{fontSize:19,marginTop:8,color:'var(--ink-2)'}}>{dayModeReply[home.dayMode]}</p>}
   </section>
   <section className="section" aria-labelledby="needs">
    <p id="needs" className="eyebrow coral">Needs you{needs.length?` · ${needs.length} ${needs.length===1?'thing':'things'}`:''}</p>
    {needs.length===0&&<div className="card" style={{display:'flex',gap:14,alignItems:'center',paddingLeft:10}}><Art file="home-calm" width={110}/><div><p style={{fontWeight:600}}>{brand.emptyNeeds}</p><p className="muted small">{brand.emptyNeedsSub}</p></div></div>}
    {needs.map(item=><div key={item.taskId} className="card" style={{borderColor:item.essential?'rgba(255,81,71,.35)':undefined}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><p style={{fontWeight:700,fontSize:18}}>{item.title}</p><p className="muted small">{item.amount}{item.amount?' · ':''}{item.dueLabel} · ~{item.minutes} min</p></div>{item.isDemo&&<span className="demo-tag">Example</span>}</div>
     {item.message&&<p className="hand" style={{fontSize:20,marginTop:10}}>{item.message}</p>}
     <div className="btn-row">
      {item.actions.length?item.actions.map(a=><Button key={a.key} className="sm" variant={a.key==='help'?'coral':'ghost'} disabled={busy===item.reminderId} onClick={()=>act(item,a.key)}>{a.label}</Button>):<Button className="sm" variant="coral" href={`/bear/bills/${item.billId}`}>Sort it with Bear</Button>}
     </div>
    </div>)}
   </section>
   <section className="section" aria-labelledby="handling">
    <p id="handling" className="eyebrow teal">Bear&rsquo;s handling</p>
    <div className="card" style={home.handling.lines.length?undefined:{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,alignItems:'center'}}>{!home.handling.lines.length&&<Art file="home-bill" width={96}/>}{home.handling.lines.length?home.handling.lines.map(l=><div key={l} className="row"><span className="icon-dot" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg></span><span className="grow">{l}</span></div>):<p style={{fontWeight:600}}>{home.hasAnyBill?'Nothing being watched right now.':'Give Bear a bill and it starts watching.'}</p>}
     {home.demoAvailable&&<div style={{gridColumn:'1 / -1',marginTop:14,paddingTop:14,borderTop:'1px solid var(--line)'}}><p className="small">Want to see how it works first? Bear can walk you through an <strong>example</strong> electricity bill.</p><div className="btn-row"><Button className="sm" variant="ghost" disabled={busy==='demo'} onClick={demo}>Try the example bill</Button><Button className="sm" variant="coral" href="/bear/capture">Give Bear a real one</Button></div></div>}
    </div>
   </section>
   <section className="section" aria-labelledby="notyet">
    <p id="notyet" className="eyebrow">Not yet</p>
    <div className="card"><p style={{fontWeight:600}}>{brand.notYet}</p><p className="muted small">{brand.notYetSub}</p></div>
   </section>
   <section className="section" aria-label="Health, wealth and happiness">
    <div className="ledgers">
     <div className="ledger health"><Art file="ledger-health" className="ledger-icon"/><span className="k">Health</span><span className="v">{home.ledgers.health.headline}</span>{home.ledgers.health.lines.map(l=><span key={l} className="l">{l}</span>)}{!home.ledgers.health.lines.length&&<span className="l">Things you do for yourself will show up here.</span>}</div>
     <div className="ledger wealth"><Art file="ledger-wealth" className="ledger-icon"/><span className="k">Wealth</span><span className="v">{home.ledgers.wealth.headline||'Nothing to count yet'}</span>{home.ledgers.wealth.lines.map(l=><span key={l} className="l">{l}</span>)}{!home.ledgers.wealth.lines.length&&<span className="l">Late fees avoided and discounts kept are counted here, only when the bill states them.</span>}</div>
     <div className="ledger happiness"><Art file="ledger-happiness" className="ledger-icon"/><span className="k">Happiness</span><span className="v">{home.ledgers.happiness.headline||'Nothing protected yet'}</span>{home.ledgers.happiness.lines.map(l=><span key={l} className="l">{l}</span>)}{!home.ledgers.happiness.lines.length&&<span className="l">Time Bear helps you protect will show up here.</span>}</div>
    </div>
   </section>
   {home.ideasCount>0&&<section className="section"><Link href="/bear/ideas" className="glass" style={{display:'flex',padding:'14px 16px',alignItems:'center',gap:12}}><span className="icon-dot mustard" aria-hidden="true">✦</span><span className="grow"><strong>Bear noticed {home.ideasCount===1?'something':`${home.ideasCount} things`}.</strong><br/><span className="faint">Have a look when you have a minute.</span></span></Link></section>}
   {!aiAvailable&&<p className="faint" style={{marginTop:20}}>Photo and PDF reading is off until the AI service is connected. Pasted and typed bills work.</p>}
   <BearSays size={20}>{brand.gotYou}</BearSays>
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
