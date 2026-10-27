'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState} from 'react';
const icon=(d:string)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const tabs=[
 {href:'/bear/home',label:'My Bear',icon:icon('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')},
 {href:'/bear/ideas',label:'Bear Ideas',icon:icon('M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3z')},
];
const tabs2=[
 {href:'/bear/wins',label:'My Wins',icon:icon('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a2 2 0 0 0 2 4M17 6h3a2 2 0 0 1-2 4')},
 {href:'/bear/me',label:'Settings',icon:icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z')},
];
export function BottomNav(){
 const path=usePathname();
 // Bear Ideas shows how many ideas the page would show right now. It refreshes on every screen change,
 // after anything changes (a task done, an idea answered, something given to Bear) and when the app
 // comes back to the front. Pages that already know the number share it straight away.
 const [ideas,setIdeas]=useState(0);
 useEffect(()=>{
  let timer:ReturnType<typeof setTimeout>|null=null;let alive=true;
  const fetchCount=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{fetch('/api/bear/ideas/count',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(j=>{if(!alive||!j||typeof j.count!=='number')return;setIdeas(j.count);try{sessionStorage.setItem('bear-ideas',String(j.count));}catch{/* no storage */}}).catch(()=>{});},400);};
  const shared=()=>{try{setIdeas(Number(sessionStorage.getItem('bear-ideas'))||0);}catch{/* no storage */}};
  const onVis=()=>{if(document.visibilityState==='visible')fetchCount();};
  shared();fetchCount();window.addEventListener('bear-changed',fetchCount);window.addEventListener('bear-ideas',shared);document.addEventListener('visibilitychange',onVis);window.addEventListener('focus',fetchCount);
  return()=>{alive=false;if(timer)clearTimeout(timer);window.removeEventListener('bear-changed',fetchCount);window.removeEventListener('bear-ideas',shared);document.removeEventListener('visibilitychange',onVis);window.removeEventListener('focus',fetchCount);};
 },[path]);
 const item=(t:{href:string;label:string;icon:React.ReactNode})=><Link key={t.href} href={t.href} aria-current={path.startsWith(t.href)?'page':undefined}>{t.icon}<span>{t.label}</span>{t.href==='/bear/ideas'&&ideas>0&&<i className="nav-badge" aria-label={`${ideas} new`}>{ideas}</i>}</Link>;
 return <nav className="bear-nav" aria-label="Main"><div className="bar glass-strong">{tabs.map(item)}<Link href="/bear/capture" className="plus-wrap" aria-label="Give it to Bear"><span className="plus" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>+ Bear</span></Link>{tabs2.map(item)}</div></nav>;
}
