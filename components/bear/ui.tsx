'use client';
import Link from 'next/link';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
export function Button({children,variant='primary',className='',href,...rest}:{children:React.ReactNode;variant?:'primary'|'coral'|'glass'|'ghost'|'quiet';className?:string;href?:string}&React.ButtonHTMLAttributes<HTMLButtonElement>){
 if(href)return <Link href={href} className={`btn ${variant} ${className}`} role="button">{children}</Link>;
 return <button type="button" className={`btn ${variant} ${className}`} {...rest}>{children}</button>;
}
export function Chip({label,selected,onToggle}:{label:string;selected:boolean;onToggle:()=>void}){return <button type="button" className="chip" aria-pressed={selected} onClick={onToggle}>{selected&&<Check/>}{label}</button>;}
export function Check({size=16}:{size?:number}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>;}
export function Tile({label,sub,selected,onToggle,art,compact,photo,tint}:{label:string;sub?:string;selected:boolean;onToggle:()=>void;art:React.ReactNode;compact?:boolean;photo?:boolean;tint?:string}){
 return <button type="button" className={`tile ${compact&&!photo?'compact':''} ${photo?'photo':''}`} style={tint?{['--tile' as string]:tint}:undefined} aria-pressed={selected} onClick={onToggle}><span className="art" aria-hidden="true">{art}</span><span className="check" aria-hidden="true"><Check size={15}/></span><span className="label">{label}</span>{sub&&<span className="sub">{sub}</span>}</button>;
}
export function Toast({message,kind='info',onDone}:{message:string|null;kind?:'info'|'error';onDone:()=>void}){
 useEffect(()=>{if(!message)return;const t=setTimeout(onDone,kind==='error'?5000:3200);return()=>clearTimeout(t);},[message,kind,onDone]);
 if(!message)return null;return <div className={`toast ${kind==='error'?'error':''}`} role={kind==='error'?'alert':'status'}>{message}</div>;
}
export function Progress({step,total}:{step:number;total:number}){return <div className="progress" aria-label={`Step ${step+1} of ${total}`}>{Array.from({length:total},(_,i)=><i key={i} className={i===step?'on':''}/>)}</div>;}
export function TopBar({back,title,right}:{back?:{href:string;label?:string}|{onClick:()=>void;label?:string};title?:string;right?:React.ReactNode}){
 const label=back&&'label' in back&&back.label?back.label:'Back';
 return <div className="topbar">{back?('href' in back?<Link href={back.href} className="back"><ChevronLeft/>{label}</Link>:<button type="button" className="back" onClick={back.onClick}><ChevronLeft/>{label}</button>):<span/>}{title&&<span className="small" style={{fontWeight:600}}>{title}</span>}<span>{right}</span></div>;
}
export function ChevronLeft(){return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>;}
export function Dots(){return <span className="dots" aria-hidden="true"><i/><i/><i/></span>;}
export function Skeleton({lines=3}:{lines?:number}){return <div aria-busy="true" aria-live="polite" style={{display:'grid',gap:12}}>{Array.from({length:lines},(_,i)=><div key={i} className="skeleton" style={{minHeight:i===0?90:60}}/>)}<span className="sr-only">Loading</span></div>;}
export function Sheet({children,onClose,label}:{children:React.ReactNode;onClose:()=>void;label:string}){
 const [mounted,setMounted]=useState(false);
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',onKey);document.body.style.overflow='hidden';const t=setTimeout(()=>setMounted(true),0);return()=>{clearTimeout(t);window.removeEventListener('keydown',onKey);document.body.style.overflow='';};},[onClose]);
 if(!mounted)return null;
 // Portalled to the Bear root so the sheet sits above the bottom navigation's stacking context.
 return createPortal(<><div className="sheet-backdrop" onClick={onClose} aria-hidden="true"/><div className="sheet glass-strong" role="dialog" aria-modal="true" aria-label={label}><div className="handle" aria-hidden="true"/>{children}</div></>,document.getElementById('bear-root')||document.body);
}
function subscribeOnline(cb:()=>void){window.addEventListener('online',cb);window.addEventListener('offline',cb);return()=>{window.removeEventListener('online',cb);window.removeEventListener('offline',cb);};}
export function useOnline(){return useSyncExternalStore(subscribeOnline,()=>navigator.onLine,()=>true);}
export function ErrorCard({message,retry}:{message:string;retry?:()=>void}){return <div className="note coral" role="alert"><span style={{fontSize:20}} aria-hidden="true">·</span><div style={{flex:1}}><p>{message}</p>{retry&&<button type="button" className="btn ghost sm" style={{marginTop:10}} onClick={retry}>Try again</button>}</div></div>;}
