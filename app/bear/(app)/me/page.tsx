'use client';
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {Profile} from '@/lib/bear/domain/types';
import {Avatar} from '@/components/bear/art';
import {Tagline} from '@/components/bear/brand';
import {Art} from '@/components/bear/art';
import {applyUpdate,checkForUpdate,CURRENT_BUILD} from '@/components/bear/runtime';
import {Button,ErrorCard,Skeleton,Toast} from '@/components/bear/ui';
import {areaLabels} from '@/lib/bear/domain/labels';
type Loaded={profile:Profile;user:{email:string|null;name:string};aiAvailable:boolean;pushAvailable:boolean};
export default function Me(){
 const router=useRouter();const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [push,setPush]=useState<{available:boolean;publicKey:string|null;subscriptions:number}|null>(null);const [updateState,setUpdateState]=useState<'idle'|'checking'|'current'|'update'|'unknown'>('idle');const perm=useSyncExternalStore(subscribePerm,()=>typeof Notification==='undefined'?'unknown':Notification.permission,()=>'unknown');const [permTick,setPermTick]=useState(0);
 const [aiTest,setAiTest]=useState<'idle'|'running'|'done'>('idle');const [aiResult,setAiResult]=useState<string|null>(null);
 async function runAiTest(){setAiTest('running');setAiResult(null);try{const r=await apiSend<{ok:boolean;model?:string;latencyMs?:number;read?:{title:string|null;kind:string|null};stage?:string;kind?:string;message?:string}>('/api/bear/ai-check',{});setAiResult(r.ok?`Working. ${r.model} read the test picture as “${r.read?.title||r.read?.kind||'something'}” in ${Math.round((r.latencyMs||0)/100)/10}s.`:`Not working. Stage: ${r.stage}${r.kind?' / '+r.kind:''}. ${r.message}`);}catch(e){setAiResult(`Not working. ${(e as Error).message}`);}finally{setAiTest('done');}}
 const load=useCallback(()=>Promise.all([apiGet<Loaded>('/api/bear/profile'),apiGet<{available:boolean;publicKey:string|null;subscriptions:number}>('/api/bear/push')]).then(([d,p])=>{setData(d);setPush(p);setError(null);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 async function enableNotifications(){if(typeof Notification==='undefined'){setToast('This browser cannot show notifications.');return;}
  const result=await Notification.requestPermission();setPermTick(t=>t+1);permListeners.forEach(l=>l());
  await apiSend('/api/bear/profile',{notification:{...data!.profile.notification,permission:result==='granted'?'granted':result==='denied'?'denied':'unknown',pushEnabled:result==='granted'&&!!push?.available}},'PUT').catch(()=>{});
  if(result!=='granted'){setToast("No worries. Reminders will still show up here in the app.");return;}
  if(push?.available&&push.publicKey){try{const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(push.publicKey)});const j=sub.toJSON();await apiSend('/api/bear/push',{endpoint:j.endpoint,keys:j.keys});setToast('Push reminders are on.');}catch{setToast('Notifications are on in the app. Push could not be set up on this device.');}}
  else setToast('Notifications are on while the app is open. Push is not connected yet.');
  load();}
 if(error&&!data)return <main id="main" className="bear-screen"><ErrorCard message={error} retry={load}/></main>;
 if(!data)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const p=data.profile;
 return (
  <main id="main" className="bear-screen">
   <p className="eyebrow">Settings</p>
   <div style={{display:'flex',gap:14,alignItems:'center'}}><Avatar size={84}/><div><h1>{p.name||'You'}</h1><p className="muted small">{data.user.email}</p></div></div>
   <section className="section"><p className="eyebrow">Your Bear</p><div className="card">
    <div className="row"><span className="grow"><span className="title">What&rsquo;s in your life</span><br/><span className="faint">{p.areas.map(a=>areaLabels[a]).join(' · ')||'Nothing picked yet'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">People</span><br/><span className="faint">{p.people.map(x=>x.name||x.role).join(', ')||'Just you'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">Life rhythm</span><br/><span className="faint">{p.lifeRhythm.blocks.length} routines · running on empty: {p.emptyMoments.length?p.emptyMoments.join(', ').replace(/_/g,' '):'not set'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">Tone</span><br/><span className="faint">{{warm:'Warm & encouraging',direct:'Straight to the point',cheeky:'A little cheeky'}[p.pins.preferences.tone]}</span></span></div>
    <div className="row"><span className="grow"><span className="title">Set things up for me</span><br/><span className="faint">{p.pins.preferences.autoSetup===false?'Off: Bear checks each thing with you first':'On: Bear files, plans and reminds without asking, and you can change anything after. Bills are always checked with you.'}</span></span><Button className="sm" variant="ghost" onClick={async()=>{await apiSend('/api/bear/profile',{pins:{...p.pins,preferences:{...p.pins.preferences,autoSetup:p.pins.preferences.autoSetup===false}}},'PUT');await load();}}>{p.pins.preferences.autoSetup===false?'Turn on':'Turn off'}</Button></div>
    <div className="btn-row"><Button className="sm" variant="ghost" onClick={async()=>{await apiSend('/api/bear/profile',{onboardingStep:0},'PUT');router.push('/bear/onboarding');}}>Adjust these</Button><Button className="sm" variant="ghost" href="/bear/me/everything">Everything Bear is holding</Button></div>
   </div></section>
   <section className="section"><p className="eyebrow">Reminders</p><div className="card">
    <p className="small">Bear only gets in touch when it can make something easier. Reminders always show up on My Bear{perm==='granted'?', and as notifications on this device':''}.</p>
    <p className="small muted" style={{marginTop:8}}>Device notifications: <strong>{perm==='granted'?'on':perm==='denied'?'blocked in your browser settings':'off'}</strong> · Push when the app is closed: <strong>{push?.available?(push.subscriptions?'on':'not set up on this device'):'not connected yet'}</strong></p>
    {perm!=='granted'&&perm!=='denied'&&<div className="btn-row"><Button className="sm" onClick={enableNotifications}>Turn on notifications</Button></div>}
    {perm==='granted'&&push?.available&&!push.subscriptions&&<div className="btn-row"><Button className="sm" onClick={enableNotifications}>Set up push on this device</Button></div>}
   </div></section>
   <section className="section"><p className="eyebrow">Reading photos and documents</p><div className="card"><p className="small">{data.aiAvailable?'Photos, screenshots and PDFs of anything (bills, school notes, appointments, forms, messages) are read by the AI service on Bear\u2019s server. Nothing you give Bear is used to train anything, and nothing is paid without you.':'The AI service is not connected, so pictures and PDFs are off. Typed, pasted and spoken things still work.'}</p>{data.aiAvailable&&<div className="btn-row" style={{marginTop:10}}><Button className="sm" variant="ghost" disabled={aiTest==='running'} onClick={runAiTest}>{aiTest==='running'?'Testing…':'Test photo reading'}</Button></div>}{aiResult&&<p className="small" role="status" style={{marginTop:10,wordBreak:'break-word'}}>{aiResult}</p>}</div></section>
   <section className="section"><p className="eyebrow">Privacy</p><div className="card"><p className="small">Only you can see what you give Bear. For bills it keeps the biller, amount, dates and payment reference, never card numbers, CVVs or bank passwords. <Link href="/privacy" style={{textDecoration:'underline'}}>Privacy notice</Link></p>
    <div className="btn-row"><Button className="sm" variant="quiet" href="/signout">Sign out</Button></div></div></section>
   <section className="section"><p className="eyebrow">App</p><div className="card"><p className="small">Version <strong>{CURRENT_BUILD}</strong>. Bear checks for a newer version each time you open it.</p>
    <div className="btn-row">{updateState==='update'?<Button className="sm" variant="coral" onClick={applyUpdate}>Update now</Button>:<Button className="sm" variant="ghost" disabled={updateState==='checking'} onClick={async()=>{setUpdateState('checking');setUpdateState(await checkForUpdate());}}>{updateState==='checking'?'Checking…':'Check for updates'}</Button>}</div>
    {updateState==='current'&&<p className="faint" style={{marginTop:8}}>You&rsquo;re on the latest Bear.</p>}{updateState==='unknown'&&<p className="faint" style={{marginTop:8}}>Couldn&rsquo;t check right now. Try again when you&rsquo;re online.</p>}</div></section>
   <div style={{marginTop:32,textAlign:'center'}}><Art file="wordmark" className="wordmark-img" alt="Load Bear"/><Tagline size={20}/></div>
   <Toast message={toast} onDone={()=>setToast(null)}/>
   <span className="sr-only" data-tick={permTick}/>
  </main>
 );
}
const permListeners=new Set<()=>void>();function subscribePerm(cb:()=>void){permListeners.add(cb);return()=>{permListeners.delete(cb);};}
function urlBase64ToUint8Array(base64:string){const padding='='.repeat((4-base64.length%4)%4);const b64=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
