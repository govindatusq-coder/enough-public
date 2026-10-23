'use client';
import {useEffect} from 'react';
// Registers the Load Bear service worker (push receipt + notification clicks). Nothing else
// runs in the background; reminders are decided server-side.
export function BearRuntime(){
 useEffect(()=>{if('serviceWorker' in navigator)navigator.serviceWorker.register('/bear/sw.js',{scope:'/bear/'}).catch(()=>{/* unsupported: in-app reminders still work */});},[]);
 return null;
}
// Show a local notification for a reminder that is due while the app is open, once.
export async function showLocalReminder(reminderId:string,message:string,url:string){
 if(typeof Notification==='undefined'||Notification.permission!=='granted')return false;
 try{const reg=await navigator.serviceWorker?.getRegistration('/bear/');if(reg){await reg.showNotification('Load Bear',{body:message,tag:reminderId,data:{url},icon:'/bear/icon-192.png',badge:'/bear/badge.png'});return true;}new Notification('Load Bear',{body:message,tag:reminderId});return true;}catch{return false;}
}
