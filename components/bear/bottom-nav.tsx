'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const icon=(d:string)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
// Four places, nothing more: Home (Brain Dump and My Lists), Shared, Bear Helps, Settings.
const tabs=[
 {href:'/bear/home',label:'Home',icon:icon('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')},
 {href:'/bear/shared',label:'Shared',icon:icon('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75')},
 {href:'/bear/helps',label:'Bear Helps',icon:icon('M12 3l1.9 5.8L20 10l-5 3.6 1.8 6.4L12 16.3 7.2 20l1.8-6.4L4 10l6.1-1.2z')},
 {href:'/bear/me',label:'Settings',icon:icon('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z')},
];
export function BottomNav(){
 const path=usePathname();
 const active=(href:string)=>path.startsWith(href)||(href==='/bear/home'&&/^\/bear\/(help\/|overview|areas|tasks|calendar|ideas|wins|bills|wishlist)/.test(path))||(href==='/bear/shared'&&path.startsWith('/bear/shared'));
 return <nav className="bear-nav" aria-label="Main"><div className="bar glass-strong four">{tabs.map(t=><Link key={t.href} href={t.href} aria-current={active(t.href)?'page':undefined}>{t.icon}<span>{t.label}</span></Link>)}</div></nav>;
}
