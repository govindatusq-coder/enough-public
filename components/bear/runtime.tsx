'use client';
import {useCallback,useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {payloadToInbox,type BearInbox,type NativeSharePayload} from '@/lib/bear/client-share';
// The iPhone app calls window.__bearShare when something was shared to Load Bear from another app.
declare global{interface Window{__bearShare?:(payload:NativeSharePayload)=>boolean;__bearInbox?:BearInbox}}
// Registers the Load Bear service worker (push receipt + notification clicks) and watches for
// a newer deployment, offering a one-tap refresh. Nothing else runs in the background.
export const CURRENT_BUILD=process.env.NEXT_PUBLIC_BEAR_BUILD||'dev';
export async function fetchVersion():Promise<{build:string;liveHost:string|null}|null>{
 try{const res=await fetch('/api/bear/version',{cache:'no-store'});if(!res.ok)return null;const j=await res.json();return {build:String(j.build||''),liveHost:typeof j.liveHost==='string'?j.liveHost:null};}catch{return null;}
}
export async function checkForUpdate():Promise<'current'|'update'|'unknown'>{
 const v=await fetchVersion();if(!v)return 'unknown';return v.build&&v.build!==CURRENT_BUILD?'update':'current';
}
export async function applyUpdate(){
 try{const regs=await navigator.serviceWorker?.getRegistrations();for(const r of regs||[])await r.update();if('caches' in window){for(const k of await caches.keys())await caches.delete(k);}}catch{/* best effort */}
 window.location.reload();
}
export function BearRuntime(){
 const [update,setUpdate]=useState(false);
 const router=useRouter();const path=usePathname();
 const [oldLink,setOldLink]=useState<string|null>(null);
 // A newer version is applied by itself when the app comes back to the front, unless something is being typed
 // or a sheet is open (then the banner waits). It tries once per version so it can never loop.
 const check=useCallback(()=>{fetchVersion().then(v=>{if(!v)return;
  if(v.build&&v.build!==CURRENT_BUILD){const busy=!!document.querySelector('textarea:focus,input:focus,[role="dialog"]');let tried=false;try{tried=!!sessionStorage.getItem('bear-auto-'+v.build);}catch{/* no storage */}
   if(!busy&&!tried){try{sessionStorage.setItem('bear-auto-'+v.build,'1');}catch{/* no storage */}applyUpdate();return;}
   setUpdate(true);}
  const host=window.location.host;setOldLink(v.liveHost&&host!==v.liveHost&&!/^(localhost|127\.)/.test(host)?`https://${v.liveHost}${window.location.pathname}`:null);
 });},[]);
 // Accept what the iPhone Share Extension saved: keep it for the capture screen, which gives it to Bear straight away.
 useEffect(()=>{
  window.__bearShare=(payload)=>{const inbox=payloadToInbox(payload);if(!inbox.text&&!inbox.files.length)return false;window.__bearInbox=inbox;window.dispatchEvent(new Event('bear-share'));if(!path.startsWith('/bear/capture'))router.push('/bear/capture?native=1');return true;};
  return()=>{delete window.__bearShare;};
 },[path,router]);
 useEffect(()=>{
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/bear/sw.js',{scope:'/bear/'}).catch(()=>{/* unsupported: in-app reminders still work */});
  // Keep Bear on the phone's clock: tell the server the device's time zone once per session
  // (and again if the phone moves to a new one), so reminders are planned for local time.
  try{const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&sessionStorage.getItem('bear-tz')!==tz){fetch('/api/bear/timezone',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeZone:tz})}).then(r=>{if(r.ok)sessionStorage.setItem('bear-tz',tz);}).catch(()=>{});}}catch{/* private mode or no Intl: the saved zone stands */}
  check();const onVis=()=>{if(document.visibilityState==='visible')check();};document.addEventListener('visibilitychange',onVis);
  const t=setInterval(check,10*60*1000);return()=>{document.removeEventListener('visibilitychange',onVis);clearInterval(t);};
 },[check]);
 if(oldLink)return <div className="update-banner glass-strong" role="alert"><span>This is an old link to Load Bear.</span><a className="btn coral sm" href={oldLink}>Open the live app</a></div>;
 if(!update)return null;
 return <div className="update-banner glass-strong" role="status"><span>A newer Bear is ready.</span><button type="button" className="btn primary sm" onClick={applyUpdate}>Update now</button></div>;
}
// Show a local notification for a reminder that is due while the app is open, once.
export async function showLocalReminder(reminderId:string,message:string,url:string){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return false;
 try{const reg=await navigator.serviceWorker?.getRegistration('/bear/');if(reg){await reg.showNotification('Load Bear',{body:message,tag:reminderId,data:{url},icon:'/bear/icon-192.png',badge:'/bear/badge.png'});return true;}new Notification('Load Bear',{body:message,tag:reminderId});return true;}catch{return false;}
}
