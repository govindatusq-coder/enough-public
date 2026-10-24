'use client';
import {useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {Profile} from '@/lib/bear/domain/types';
import {BearHead} from '@/components/bear/art';
import {Wordmark,Tagline} from '@/components/bear/brand';
import {Button,ErrorCard,Skeleton,Toast} from '@/components/bear/ui';
import {areaLabels} from '@/lib/bear/domain/labels';
type Loaded={profile:Profile;user:{email:string|null;name:string};aiAvailable:boolean;pushAvailable:boolean};
export default function Me(){
 const router=useRouter();const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [push,setPush]=useState<{available:boolean;publicKey:string|null;subscriptions:number}|null>(null);const perm=useSyncExternalStore(subscribePerm,()=>typeof Notification==='undefined'?'unknown':Notification.permission,()=>'unknown');const [permTick,setPermTick]=useState(0);
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
   <div style={{display:'flex',gap:14,alignItems:'center'}}><BearHead size={80}/><div><h1>{p.name||'You'}</h1><p className="muted small">{data.user.email}</p></div></div>
   <section className="section"><p className="eyebrow">Your Bear</p><div className="card">
    <div className="row"><span className="grow"><span className="title">What&rsquo;s in your life</span><br/><span className="faint">{p.areas.map(a=>areaLabels[a]).join(' · ')||'Nothing picked yet'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">People</span><br/><span className="faint">{p.people.map(x=>x.name||x.role).join(', ')||'Just you'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">Life rhythm</span><br/><span className="faint">{p.lifeRhythm.blocks.length} routines · running on empty: {p.emptyMoments.length?p.emptyMoments.join(', ').replace(/_/g,' '):'not set'}</span></span></div>
    <div className="row"><span className="grow"><span className="title">Tone</span><br/><span className="faint">{{warm:'Warm & encouraging',direct:'Straight to the point',cheeky:'A little cheeky'}[p.pins.preferences.tone]}</span></span></div>
    <div className="btn-row"><Button className="sm" variant="ghost" onClick={async()=>{await apiSend('/api/bear/profile',{onboardingStep:0},'PUT');router.push('/bear/onboarding');}}>Adjust these</Button></div>
   </div></section>
   <section className="section"><p className="eyebrow">Reminders</p><div className="card">
    <p className="small">Bear only gets in touch when it can make something easier. Reminders always show up on My Bear{perm==='granted'?', and as notifications on this device':''}.</p>
    <p className="small muted" style={{marginTop:8}}>Device notifications: <strong>{perm==='granted'?'on':perm==='denied'?'blocked in your browser settings':'off'}</strong> · Push when the app is closed: <strong>{push?.available?(push.subscriptions?'on':'not set up on this device'):'not connected yet'}</strong></p>
    {perm!=='granted'&&perm!=='denied'&&<div className="btn-row"><Button className="sm" onClick={enableNotifications}>Turn on notifications</Button></div>}
    {perm==='granted'&&push?.available&&!push.subscriptions&&<div className="btn-row"><Button className="sm" onClick={enableNotifications}>Set up push on this device</Button></div>}
   </div></section>
   <section className="section"><p className="eyebrow">Reading bills</p><div className="card"><p className="small">{data.aiAvailable?'Photos, screenshots and PDFs are read by the AI service on Bear’s server. Your bills are never used to train anything, and nothing is paid without you.':'The AI service is not connected, so pictures and PDFs are off. Pasted text and typed bills still work.'}</p></div></section>
   <section className="section"><p className="eyebrow">Privacy</p><div className="card"><p className="small">Only you can see your bills. Bear stores the biller, amount, dates and payment reference, never card numbers, CVVs or bank passwords. <Link href="/privacy" style={{textDecoration:'underline'}}>Privacy notice</Link></p>
    <div className="btn-row"><Button className="sm" variant="quiet" href="/signout">Sign out</Button></div></div></section>
   <div style={{marginTop:32,textAlign:'center'}}><Wordmark size={22}/><br/><Tagline size={20}/></div>
   <Toast message={toast} onDone={()=>setToast(null)}/>
   <span className="sr-only" data-tick={permTick}/>
  </main>
 );
}
const permListeners=new Set<()=>void>();function subscribePerm(cb:()=>void){permListeners.add(cb);return()=>{permListeners.delete(cb);};}
function urlBase64ToUint8Array(base64:string){const padding='='.repeat((4-base64.length%4)%4);const b64=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(b64);return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));}
