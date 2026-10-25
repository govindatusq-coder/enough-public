'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand,dayModeReply} from '@/lib/bear/domain/copy';
import {pickGreeting,type Greeting} from '@/lib/bear/domain/greetings';
import {formatAU} from '@/lib/bear/domain/dates';
import {overdueLabel} from '@/lib/bear/domain/overdue';
import type {DayMode} from '@/lib/bear/domain/types';
import type {HomeView} from '@/lib/bear/services/home';
import {Art} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,Skeleton,Toast,useOnline} from '@/components/bear/ui';
import {showLocalReminder} from '@/components/bear/runtime';

const modes:{key:DayMode;label:string}[]=[{key:'good',label:'Good'},{key:'full',label:'Full'},{key:'wiped',label:'Wiped'},{key:'chaos',label:'Chaos'}];
export default function Home(){
 const router=useRouter();const online=useOnline();
 const [home,setHome]=useState<HomeView|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState<string|null>(null);
 const delivered=useRef(new Set<string>());const [greet,setGreet]=useState<Greeting|null>(null);const greetKey=useRef('');
 const load=useCallback(()=>apiGet<{home?:HomeView;onboarding?:boolean;aiAvailable?:boolean}>('/api/bear/home').then(res=>{if(res.onboarding){router.replace('/bear/onboarding');return;}setHome(res.home!);{const hour=new Date().getHours();const key=`${hour<12?'m':hour<17?'a':'e'}:${res.home!.dayMode||''}`;if(key!==greetKey.current){greetKey.current=key;let last:string|null=null;try{last=localStorage.getItem('bear-greeting');}catch{/* no storage */}const g=pickGreeting({hour,mode:res.home!.dayMode,last});try{localStorage.setItem('bear-greeting',g.id);}catch{/* no storage */}setGreet(g);}}try{sessionStorage.setItem('bear-ideas',String(res.home!.ideasCount));window.dispatchEvent(new Event('bear-ideas'));}catch{/* no storage */}setError(null);
   for(const item of res.home!.needsYou){if(item.reminderId&&!delivered.current.has(item.reminderId)){delivered.current.add(item.reminderId);apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'in_app'}).catch(()=>{});showLocalReminder(item.reminderId,item.message||`${item.title} needs you.`,`/bear/bills/${item.billId}?reminder=${item.reminderId}`).then(ok=>{if(ok)apiSend('/api/bear/reminders/delivered',{reminderId:item.reminderId,via:'local'}).catch(()=>{});});}}
  }).catch(e=>{const err=e as {status?:number;message:string};if(err.status===401)router.replace('/bear/signin');else setError(err.message);}),[router]);
 useEffect(()=>{load();const onVis=()=>{if(document.visibilityState==='visible')load();};document.addEventListener('visibilitychange',onVis);return()=>document.removeEventListener('visibilitychange',onVis);},[load]);
 async function setMode(mode:DayMode){setBusy('mode');try{const res=await apiSend<{reply:string|null}>('/api/bear/day',{mode:home?.dayMode===mode?null:mode});setToast(res.reply||'Noted.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(null);}}
 async function demo(){setBusy('demo');try{const res=await apiSend<{capture:{id:string}}>('/api/bear/demo',{});router.push(`/bear/verify/${res.capture.id}`);}catch(e){setError((e as Error).message);setBusy(null);}}
 if(error&&!home)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/></main>;
 if(!home)return <main id="main" className="bear-screen"><div className="skeleton" style={{minHeight:40,maxWidth:220,marginBottom:16}}/><Skeleton/></main>;
 return (
  <main id="main" className="bear-screen home-screen">
   <header className="hero-banner">
    <div className="hero-text">
     <h1 className="hero-greeting">{home.greeting}</h1>
     <p className="hero-line hand">{greet?greet.line:brand.gotYou}</p>
     {home.overdue.length>0&&<p className="hero-alert" role="alert"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/></svg><span>{home.overdue.length} overdue. See the red numbers.</span></p>}
    </div>
    <div className="hero-art" aria-hidden="true"><Art file={greet?greet.art:'hero-bear'} className="hero-img" style={{objectPosition:greet?greet.focus:'60% 22%',...(greet?.zoom?{transform:`scale(${greet.zoom})`,transformOrigin:'25% 100%'}:{})}}/></div>
   </header>
   {!online&&<p className="note" style={{marginTop:14}} role="status">You&rsquo;re offline. Showing what Bear last knew.</p>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {/* Once today's level is rated the card goes away; the reply shows as a note, and it can be changed in Settings. */}
   {!home.dayMode&&<section className="section how-row" aria-labelledby="how">
    <div className="glass" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}><span id="how" className="small" style={{fontWeight:600}}>How&rsquo;s today?</span><div className="chips" style={{gap:6}}>{modes.map(m=><button key={m.key} type="button" className="chip" style={{minHeight:38,padding:'0 12px',fontSize:14}} aria-pressed={home.dayMode===m.key} disabled={busy==='mode'} onClick={()=>setMode(m.key)}>{m.label}</button>)}</div></div>
   </section>}
   <section className="home-tiles" aria-label="Your areas">
    <div className="area-grid six">{home.areas.map(a=><Link key={a.key} href={`/bear/areas/${a.key}`} className="area-tile" aria-label={`${a.label}: ${a.open} current${a.needs?`, ${a.needs} need you${a.overdue?`, ${a.overdue} overdue`:''}`:''}`}><span className="area-img"><Art file={`area-${a.key}`} className="area-photo"/>{a.needs>0&&<span className={`badge ${a.overdue>0?'late':'soon'}`} aria-hidden="true">{a.needs}</span>}{a.needs===0&&a.soft&&<span className="badge-dot" aria-hidden="true"/>}</span><span className="area-label">{a.label}</span><span className="area-sub">{a.open===0?'All clear':`${a.open} current`}</span></Link>)}</div>
    {home.wishlist.count>0&&<Link href="/bear/wishlist" className="wish-row" aria-label={`Wishlist: ${home.wishlist.count} waiting`}><span>Wishlist</span><span className="small muted">{home.wishlist.count} waiting{home.wishlist.next?` · back ${formatAU(home.wishlist.next,'short')}`:''}</span></Link>}
   </section>
   {home.demoAvailable&&<section className="section"><div className="glass" style={{padding:18}}><p className="eyebrow teal" style={{marginBottom:6}}>New here?</p><p className="small">Bills, school notes, to-dos, lists. Want to see how it works first? Bear can walk you through an <strong>example</strong> electricity bill.</p><div className="btn-row"><Button className="sm" variant="ghost" disabled={busy==='demo'} onClick={demo}>Try the example bill</Button><Button className="sm" variant="coral" href="/bear/capture">Give Bear something real</Button></div></div></section>}
   <section className="stats-banner" aria-labelledby="handling">
    <div className="stats-art" aria-hidden="true"><Art file="empty-rhythm" className="hero-img" style={{objectPosition:'50% 30%'}}/></div>
    <div className="stats-body">
     <p id="handling" className="hand stats-title">Bear&rsquo;s handling</p>
     <div className="stats-nums">
      <div><b>{home.handling.watching}</b><span>Bills watched</span></div>
      <div><b>{home.handling.held}</b><span>Things held</span></div>
      <div><b>{home.handling.remindersReady}</b><span>Reminders set</span></div>
     </div>
     {home.handling.watching+home.handling.held+home.handling.remindersReady===0&&<p className="stats-note">Give Bear anything and these start to grow.</p>}
    </div>
   </section>
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
