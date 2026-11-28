'use client';
// Three places only: Drop Bear, Bear Boost, Bear Brain. Settings is in each screen's header.
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Icon} from '@/components/bear/v2';
const tabs=[
 {href:'/bear/home',label:'Drop Bear',icon:Icon.dropBear(26),match:/^\/bear\/home/},
 {href:'/bear/moment',label:'Bear Boost',icon:Icon.zap(26),match:/^\/bear\/moment/},
 {href:'/bear/brain',label:'Bear Brain',icon:Icon.brain(26),match:/^\/bear\/(brain|tasks|help|helps|shared|calendar|overview|areas|ideas|wins|bills|wishlist)/},
];
export function BottomNav(){
 const path=usePathname();
 return <nav className="bear-nav" aria-label="Main"><div className="bar glass-strong three"><Link href="/bear/home" className="nav-brand" aria-label="Load Bear home"><span className="display">Load Bear</span><span className="hand">Less on your mind.</span></Link>
  {tabs.map(t=><Link key={t.href} href={t.href} aria-current={t.match.test(path)?'page':undefined}>{t.icon}<span>{t.label}</span></Link>)}</div></nav>;
}
