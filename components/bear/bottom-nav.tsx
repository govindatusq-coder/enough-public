'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const icon=(d:string)=><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
const tabs=[
 {href:'/bear/home',label:'My Bear',icon:icon('M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z')},
 {href:'/bear/ideas',label:'Bear Ideas',icon:icon('M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.6 1 1.3 1 2.5h6c0-1.2.3-1.9 1-2.5A6 6 0 0 0 12 3z')},
];
const tabs2=[
 {href:'/bear/wins',label:'My Wins',icon:icon('M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a2 2 0 0 0 2 4M17 6h3a2 2 0 0 1-2 4')},
 {href:'/bear/me',label:'Me',icon:icon('M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z')},
];
export function BottomNav(){
 const path=usePathname();
 const item=(t:{href:string;label:string;icon:React.ReactNode})=><Link key={t.href} href={t.href} aria-current={path.startsWith(t.href)?'page':undefined}>{t.icon}<span>{t.label}</span></Link>;
 return <nav className="bear-nav" aria-label="Main"><div className="bar glass-strong">{tabs.map(item)}<Link href="/bear/capture" className="plus-wrap" aria-label="Give it to Bear"><span className="plus" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>+ Bear</span></Link>{tabs2.map(item)}</div></nav>;
}
