'use client';
import {useEffect,useState} from 'react';
import {BearHead} from './art';
import {Dots} from './ui';
import {brand} from '@/lib/bear/domain/copy';
// Not a spinner: cycling microcopy and, once known, the extracted fields emerging from the source.
export function BearThinking({preview,fields}:{preview?:{kind:'image';url:string}|{kind:'text';text:string}|null;fields?:{label:string;value:string}[]}){
 const [i,setI]=useState(0);
 useEffect(()=>{const t=setInterval(()=>setI(x=>(x+1)%brand.thinking.length),1600);return()=>clearInterval(t);},[]);
 return (
  <div className="thinking-stage" aria-busy="true" aria-live="polite">
   <div style={{display:'grid',gap:16,width:'100%',justifyItems:'center'}}>
    <div style={{position:'relative',width:'100%',maxWidth:320}}>
     {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset */}
     {preview?.kind==='image'&&<img src={preview.url} alt="Your bill" style={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:18,filter:'saturate(.8)',opacity:.85}}/>}
     {preview?.kind==='text'&&<pre className="glass" style={{padding:14,maxHeight:160,overflow:'hidden',fontSize:13,whiteSpace:'pre-wrap',color:'var(--ink-2)',fontFamily:'inherit'}}>{preview.text.slice(0,400)}</pre>}
     {!preview&&<div style={{display:'grid',placeItems:'center'}}><BearHead size={140}/></div>}
    </div>
    {fields&&fields.length>0&&<div style={{display:'grid',gap:8,width:'100%',maxWidth:320}}>{fields.map((f,n)=><div key={f.label+n} className="thinking-field emerge"><span className="tiny faint" style={{letterSpacing:'.1em',textTransform:'uppercase',fontWeight:700}}>{f.label}</span><strong className={f.label==='Amount'?'amount sm':''} style={{fontSize:f.label==='Amount'?26:18}}>{f.value}</strong></div>)}</div>}
    <p className="thinking-copy"><strong>Bear&rsquo;s working this out</strong><Dots/><br/><span className="small">{brand.thinking[i]}</span></p>
   </div>
  </div>
 );
}
