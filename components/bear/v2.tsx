'use client';
// Load Bear v2: pieces shared by the three screens (Drop Bear, Lighten Load, Bear Brain).
import Link from 'next/link';
import {Art} from '@/components/bear/art';

const svg=(d:React.ReactNode,size=24,stroke=1.9)=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
export const Icon={
 dropBear:(s=24)=>svg(<><path d="M7 17.5a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.8 8a4 4 0 0 1-.3 8"/><path d="M12 11v9M8.8 16.8 12 20l3.2-3.2"/></>,s),
 zap:(s=24)=>svg(<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,s),
 chat:(s=24)=>svg(<><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth="2.8"/></>,s),
 clock:(s=24)=>svg(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></>,s),
 brain:(s=24)=>svg(<><path d="M9.5 3.5A3 3 0 0 0 6.6 6 3 3 0 0 0 4.5 9a3 3 0 0 0 .6 4.9 3.2 3.2 0 0 0 2.6 4.6A3 3 0 0 0 12 19.5V5a2.5 2.5 0 0 0-2.5-1.5z"/><path d="M14.5 3.5A3 3 0 0 1 17.4 6a3 3 0 0 1 2.1 3 3 3 0 0 1-.6 4.9 3.2 3.2 0 0 1-2.6 4.6A3 3 0 0 1 12 19.5"/></>,s),
 gear:(s=24)=>svg(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></>,s),
 search:(s=22)=>svg(<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,s,2.1),
 sliders:(s=22)=>svg(<><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></>,s,2),
 chevron:(s=18)=>svg(<path d="m9 6 6 6-6 6"/>,s,2.4),
 down:(s=18)=>svg(<path d="m6 9 6 6 6-6"/>,s,2.4),
};
// Header on Drop Bear and Lighten Load: the Load Bear name, Mama Bear, and Settings (the only way to Settings).
export function AppHeader(){
 return <div className="v2-top">
  <Link href="/bear/home" className="v2-logo" aria-label="Load Bear"><Art file="logo-header" alt="Load Bear" className="v2-logo-img"/></Link>
  <Link href="/bear/me" className="v2-gear" aria-label="Settings">{Icon.gear(26)}</Link>
 </div>;
}
// Mama Bear: the flexing bear in her blue shirt, cut out so she sits on the page.
export function MamaBear({className='v2-bear'}:{className?:string}){return <div className={className} aria-hidden="true"><Art file="hero-bear-cut" className="v2-bear-img"/></div>;}
const labelTone:Record<string,string>={'Deadline approaching':'urgent','Opportunity closing':'amber','Ready for approval':'teal','Saves time later':'amber','Worth doing now':'amber','Quick win':'teal','Fits your time':'teal'};
export function LabelChip({label}:{label:string}){return <span className={`v2-label ${labelTone[label]||'teal'}`}>{label}</span>;}
export const greetingV2=(hour:number,name:string)=>`${hour<12?'Morning':hour<17?'Afternoon':'Evening'}${name?`, ${name}`:''}.`;
