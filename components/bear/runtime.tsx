'use client';
import {useCallback,useEffect,useState} from 'react';
// Registers the Load Bear service worker (push receipt + notification clicks) and watches for
// a newer deployment, offering a one-tap refresh. Nothing else runs in the background.
export const CURRENT_BUILD=process.env.NEXT_PUBLIC_BEAR_BUILD||'dev';
export async function checkForUpdate():Promise<'current'|'update'|'unknown'>{
 try{const res=await fetch('/api/bear/version',{cache:'no-store'});if(!res.ok)return 'unknown';const {build}=await res.json();return build&&build!==CURRENT_BUILD?'update':'current';}catch{return 'unknown';}
}
export async function applyUpdate(){
 try{const regs=await navigator.serviceWorker?.getRegistrations();for(const r of regs||[])await r.update();if('caches' in window){for(const k of await caches.keys())await caches.delete(k);}}catch{/* best effort */}
 window.location.reload();
}
export function BearRuntime(){
 const [update,setUpdate]=useState(false);
 const check=useCallback(()=>{checkForUpdate().then(r=>{if(r==='update')setUpdate(true);});},[]);
 useEffect(()=>{
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/bear/sw.js',{scope:'/bear/'}).catch(()=>{/* unsupported: in-app reminders still work */});
  // Keep Bear on the phone's clock: tell the server the device's time zone once per session
  // (and again if the phone moves to a new one), so reminders are planned for local time.
  try{const tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz&&sessionStorage.getItem('bear-tz')!==tz){fetch('/api/bear/timezone',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeZone:tz})}).then(r=>{if(r.ok)sessionStorage.setItem('bear-tz',tz);}).catch(()=>{});}}catch{/* private mode or no Intl: the saved zone stands */}
  check();const onVis=()=>{if(document.visibilityState==='visible')check();};document.addEventListener('visibilitychange',onVis);
  const t=setInterval(check,10*60*1000);return()=>{document.removeEventListener('visibilitychange',onVis);clearInterval(t);};
 },[check]);
 if(!update)return null;
 return <div className="update-banner glass-strong" role="status"><span>A newer Bear is ready.</span><button type="button" className="btn primary sm" onClick={applyUpdate}>Update now</button></div>;
}
// Show a local notification for a reminder that is due while the app is open, once.
export async function showLocalReminder(reminderId:string,message:string,url:string){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return false;
 try{const reg=await navigator.serviceWorker?.getRegistration('/bear/');if(reg){await reg.showNotification('Load Bear',{body:message,tag:reminderId,data:{url},icon:'/bear/icon-192.png',badge:'/bear/badge.png'});return true;}new Notification('Load Bear',{body:message,tag:reminderId});return true;}catch{return false;}
}
