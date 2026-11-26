'use client';
// Shared: what she has handed to others (and how it's going), and what others have handed to her.
import {SmartBack} from '@/components/bear/smart-back';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import type {Share} from '@/lib/bear/board/shares';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
const modeLabel={info:'For their info',action:'Asked to do it',transfer:'Handed over'} as const;
const statusLabel=(s:Share,mine:boolean)=>({invited:mine?'Waiting for them to open the link':'Waiting for your answer',accepted:s.mode==='transfer'?(mine?'Theirs now':'Yours now'):s.mode==='action'?'Said yes':'Seen',discussing:'Wants to talk',declined:'Said no',done:'Done',revoked:'Taken back'} as const)[s.status];
export default function Shared(){
 const [d,setD]=useState<{sent:Share[];received:Share[]}|null>(null);const [err,setErr]=useState<string|null>(null);const [reply,setReply]=useState<Record<string,string>>({});
 const load=()=>apiGet<{sent:Share[];received:Share[]}>('/api/bear/shares').then(r=>{setD(r);setErr(null);if(r.sent.some(s=>!s.senderSeen))apiSend('/api/bear/shares/seen',{}).catch(()=>{});}).catch(e=>setErr((e as Error).message));
 useEffect(()=>{load();},[]);
 if(err&&!d)return <main id="main" className="bear-screen"><SmartBack fallback={{href:'/bear/brain',label:'Bear Brain'}}/><h1>Shared</h1><div style={{marginTop:14}}><ErrorCard message={err} retry={load}/></div></main>;
 if(!d)return <main id="main" className="bear-screen"><SmartBack fallback={{href:'/bear/brain',label:'Bear Brain'}}/><Skeleton/></main>;
 async function act(path:string,body:unknown){try{await apiSend(path,body);load();}catch(e){setErr((e as Error).message);}}
 const card=(s:Share,mine:boolean)=><li key={s.id} className="share-card glass">
  <div className="b-meta"><span className="b-tag">{modeLabel[s.mode]}</span><span>{mine?`to ${s.toName}`:`from ${s.senderName}`}</span>{s.dueAt&&<span>by {formatAU(s.dueAt,'short')}</span>}</div>
  <strong style={{display:'block',marginTop:6}}>{s.title}</strong>
  <p className="small" style={{marginTop:4,color:s.status==='declined'||s.status==='discussing'?'var(--coral)':'var(--ink-2)'}}>{statusLabel(s,mine)}</p>
  {s.messages.map((m,i)=><p key={i} className="small" style={{marginTop:4}}><em>{m.from==='sender'?(mine?'You':s.senderName):(mine?s.toName:'You')}:</em> {m.text}</p>)}
  {mine&&s.status==='discussing'&&<div className="fam-row" style={{marginTop:8}}><input className="b-edit" value={reply[s.id]||''} onChange={e=>setReply(r=>({...r,[s.id]:e.target.value}))} placeholder="Reply" maxLength={500} aria-label="Reply"/><button type="button" className="btn ghost sm" disabled={!reply[s.id]?.trim()} onClick={()=>{act(`/api/bear/shares/${s.id}/reply`,{message:reply[s.id]});setReply(r=>({...r,[s.id]:''}));}}>Send</button></div>}
  {mine&&!['revoked','done','declined'].includes(s.status)&&<button type="button" className="link-btn small" style={{marginTop:8}} onClick={()=>act(`/api/bear/shares/${s.id}/revoke`,{})}>Take it back</button>}
  {!mine&&s.recipientTaskId&&s.status==='accepted'&&<Link href={`/bear/help/${s.recipientTaskId}`} className="link-btn small" style={{display:'inline-block',marginTop:8}}>Open it</Link>}
 </li>;
 const live=(a:Share[])=>a.filter(s=>s.status!=='revoked');
 return <main id="main" className="bear-screen"><SmartBack fallback={{href:'/bear/brain',label:'Bear Brain'}}/>
  <h1>Shared</h1>
  <p className="small muted" style={{marginTop:6}}>Share Bear from any task’s ••• menu. Only the one thing you share is seen. Everything else stays private.</p>
  {err&&<div style={{marginTop:12}}><ErrorCard message={err}/></div>}
  <section className="section"><p className="eyebrow">You shared</p>{live(d.sent).length?<ul className="share-list">{live(d.sent).map(s=>card(s,true))}</ul>:<p className="faint">Nothing yet.</p>}</section>
  <section className="section"><p className="eyebrow">Shared with you</p>{live(d.received).length?<ul className="share-list">{live(d.received).map(s=>card(s,false))}</ul>:<p className="faint">Nothing yet.</p>}</section>
 </main>;
}
