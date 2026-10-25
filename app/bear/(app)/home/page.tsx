'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand,dayModeReply} from '@/lib/bear/domain/copy';
import type {DayMode} from '@/lib/bear/domain/types';
import type {HomeView,NeedsYouItem} from '@/lib/bear/services/home';
import {Art,TileImage} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,Skeleton,Toast,useOnline} from '@/components/bear/ui';
import {showLocalReminder} from '@/components/bear/runtime';

const modes:{key:DayMode;label:string}[]=[{key:'good',label:'Good'},{key:'full',label:'Full'},{key:'wiped',label:'Wiped'},{key:'chaos',label:'Chaos'}];
export default function Home(){
 const router=useRouter();const online=useOnline();
 const [home,setHome]=useState<HomeView|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState<string|null>(null);const [aiAvailable,setAiAvailable]=useState(true);
 const delivered=useRef(new Set<string>());const [needsName,setNeedsName]=useState(false);const [nameInput,setNameInput]=useState('');
 const load=useCallback(()=>apiGet<{home?:HomeView;onboarding?:boolean;aiAvailable?:boolean;needsName?:boolean}>('/api/bear/home').then(res=>{if(res.onboarding){router.replace('/bear/onboarding');return;}setHome(res.home!);setNeedsName(!!res.needsName);setAiAvailable(res.aiAvailable!==false);setError(null);
   for(const item of res.home!.needsYou){if(item.reminderId&&!delivered.current.has(item.reminderId)){delivered.current.add(item.reminderId);apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'in_app'}).catch(()=>{});showLocalReminder(item.reminderId,item.message||`${item.title} needs you.`,`/bear/bills/${item.billId}?reminder=${item.reminderId}`).then(ok=>{if(ok)apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'local'}).catch(()=>{});});}}
  }).catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{load();const onVis=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);},[load]);
 async function setMode(mode:DayMode){setBusy('mode');try{const res=await apiSend<{reply:string|null}>('/api/bear/day',{mode:home?.dayMode===mode?null:mode});setToast(res.reply||'Noted.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 const linkFor=(item:NeedsYouItem)=>item.billId?`/bear/bills/${item.billId}`:`/bear/tasks/${item.taskId}`;
 async function act(item:NeedsYouItem,key:string){if(!item.reminderId){router.push(linkFor(item));return;}
  if(key==='help'||key==='break_down'){router.push(`${linkFor(item)}?reminder=${item.reminderId}`);return;}
  setBusy(item.reminderId);
  try{if(key==='tonight')await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'snoozed',detail:'tonight'});
   else if(key==='another_time')await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'snoozed',detail:'tomorrow'});
   else if(key==='drop'){if(!confirm('Tell Bear this is not important anymore?'))return;await apiSend('/api/bear/reminders/interact',{reminderId:item.reminderId,action:'not_important'});}
   setToast(key==='drop'?'Let go. One less thing.':"No worries. Bear will find another time.");await load();}
  catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 async function saveName(){const name=nameInput.trim();if(!name)return;try{await apiSend('/api/bear/profile',{name},'PUT');setNeedsName(false);await load();}catch(e){setError((e as Error).message);}}
 async function demo(){setBusy('demo');try{const res=await apiSend<{capture:{id:string}}>('/api/bear/demo',{});router.push(`/bear/verify/${res.capture.id}`);}catch(e){setError((e as Error).message);setBusy(null);}}
 if(error&&!home)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/></main>;
 if(!home)return <main id="main" className="bear-screen"><div className="skeleton" style={{minHeight:40,maxWidth:220,marginBottom:16}}/><Skeleton/></main>;
 const needs=home.needsYou;
 return (
  <main id="main" className="bear-screen">
   <header className="hero-banner">
    <div className="hero-text">
     <p className="eyebrow coral" style={{marginBottom:6}}>Your Bear</p>
     <h1 className="hero-greeting">{home.greeting}</h1>
     <p className="hero-sub">{home.coveredCount>0?`Bear's got ${home.coveredCount} ${home.coveredCount===1?'thing':'things'} covered.`:"Bear's ready when you are."}</p>
     {needsName&&<form className="hero-name" onSubmit={e=>{e.preventDefault();saveName();}}><label htmlFor="hero-name-input" className="small">What should Bear call you?</label><div style={{display:'flex',gap:8,marginTop:6}}><input id="hero-name-input" value={nameInput} maxLength={40} placeholder="Your first name" onChange={e=>setNameInput(e.target.value)}/><Button className="sm" variant="primary" type="submit" disabled={!nameInput.trim()}>Save</Button></div></form>}
    </div>
    <Art file="hero-bear" className="hero-bear" alt="Mama Bear" width={190}/>
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
      {item.actions.length?item.actions.map(a=><Button key={a.key} className="sm" variant={a.key==='help'?'coral':'ghost'} disabled={busy===item.reminderId} onClick={()=>act(item,a.key)}>{a.label}</Button>):<Button className="sm" variant="coral" href={linkFor(item)}>Sort it with Bear</Button>}
     </div>
    </div>)}
   </section>
   {home.areas.length>0&&<section className="section" aria-labelledby="areas">
    <p id="areas" className="eyebrow">Your areas</p>
    <div className="area-grid">{home.areas.map(a=><Link key={a.key} href={`/bear/areas/${a.key}`} className="area-tile" aria-label={`${a.label}: ${a.open} current`}><span className="area-img"><TileImage file={`area-${a.key}`}/></span><span className="area-label">{a.label}</span><span className="small muted">{a.open===0?'Nothing current':`${a.open} current`}</span></Link>)}</div>
   </section>}
   <section className="section" aria-labelledby="handling">
    <p id="handling" className="eyebrow teal">Bear&rsquo;s handling</p>
    <div className="card" style={home.handling.lines.length?undefined:{display:'grid',gridTemplateColumns:'96px 1fr',gap:12,alignItems:'center'}}>{!home.handling.lines.length&&<Art file="home-bill" width={96}/>}{home.handling.lines.length?home.handling.lines.map(l=><div key={l} className="row"><span className="icon-dot" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg></span><span className="grow">{l}</span></div>):<p style={{fontWeight:600}}>{home.hasAnyBill?'Nothing being watched right now.':'Give Bear anything and it starts holding it.'}</p>}
     {home.demoAvailable&&<div style={{gridColumn:'1 / -1',marginTop:14,paddingTop:14,borderTop:'1px solid var(--line)'}}><p className="small">Bills, school notes, appointments, forms, lists. Want to see how it works first? Bear can walk you through an <strong>example</strong> electricity bill.</p><div className="btn-row"><Button className="sm" variant="ghost" disabled={busy==='demo'} onClick={demo}>Try the example bill</Button><Button className="sm" variant="coral" href="/bear/capture">Give Bear something real</Button></div></div>}
    </div>
   </section>
   {home.ideasCount>0&&<section className="section"><Link href="/bear/ideas" className="glass" style={{display:'flex',padding:'14px 16px',alignItems:'center',gap:12}}><span className="icon-dot mustard" aria-hidden="true">✦</span><span className="grow"><strong>Bear noticed {home.ideasCount===1?'something':`${home.ideasCount} things`}.</strong><br/><span className="faint">Have a look when you have a minute.</span></span></Link></section>}
   {!aiAvailable&&<p className="faint" style={{marginTop:20}}>Photo and PDF reading is off until the AI service is connected. Pasted, typed and spoken things work.</p>}
   <BearSays size={20}>{brand.gotYou}</BearSays>
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
