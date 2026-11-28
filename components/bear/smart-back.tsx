'use client';
// A back button that returns to where she came from: Bear Brain's links add ?from=brain, so these pages lead back there;
// otherwise the page's usual parent. (Read after load, so the page stays fast and needs no extra wrapping.)
import {useEffect,useState} from 'react';
import {TopBar} from './ui';
const FROM:Record<string,{href:string;label:string}>={brain:{href:'/bear/brain',label:'Bear Brain'},moment:{href:'/bear/moment',label:'Bear Boost'},me:{href:'/bear/me',label:'Settings'}};
export function SmartBack({fallback}:{fallback:{href:string;label:string}}){
 const [back,setBack]=useState(fallback);
 useEffect(()=>{queueMicrotask(()=>{try{const f=new URLSearchParams(window.location.search).get('from');if(f&&FROM[f])setBack(FROM[f]);}catch{/* fallback */}});},[]);
 return <TopBar back={back}/>;
}
