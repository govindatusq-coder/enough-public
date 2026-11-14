'use client';
import {useEffect,useRef,type ReactNode} from 'react';
// A fold that remembers whether this person left it open, on this device. Closed by default: the screen stays quiet.
export function Fold({id,summary,children,open,style}:{id:string;summary:ReactNode;children:ReactNode;open?:boolean;style?:React.CSSProperties}){
 const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{try{if(open||localStorage.getItem('bear-fold:'+id)==='1'){if(ref.current)ref.current.open=true;}}catch{/* no storage: stays closed */}},[id,open]);
 return <details ref={ref} className="home-more" style={style} onToggle={e=>{try{localStorage.setItem('bear-fold:'+id,(e.currentTarget as HTMLDetailsElement).open?'1':'0');}catch{/* no storage */}}}><summary>{summary}</summary>{children}</details>;
}
