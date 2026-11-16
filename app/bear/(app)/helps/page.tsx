'use client';
// Bear Helps: things Bear can get ready for her. Started ones come first so she can pick up where she left off.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
const kindLabel:Record<string,string>={email:'Email drafted',message:'Message drafted',followup:'Follow-up drafted',call:'Call notes',bill:'Bill details',form:'Form prepared',steps:'Small steps'};
interface Item{id:string;title:string;kind:string;readiness:string;savedAt:string|null;dueAt:string|null}
export default function Helps(){
 const [items,setItems]=useState<Item[]|null>(null);const [err,setErr]=useState<string|null>(null);
 const load=()=>apiGet<{items:Item[]}>('/api/bear/board/helps').then(r=>setItems(r.items)).catch(e=>setErr((e as Error).message));
 useEffect(()=>{load();},[]);
 if(err)return <main id="main" className="bear-screen"><ErrorCard message={err} retry={load}/></main>;
 if(!items)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const started=items.filter(i=>i.readiness==='in_progress');const rest=items.filter(i=>i.readiness!=='in_progress');
 const row=(i:Item)=><li key={i.id}><Link href={`/bear/help/${i.id}`} className="b-row link"><div className="b-main"><span className="b-title">{i.title}</span><div className="b-meta"><span className="b-tag">{kindLabel[i.kind]||'Help'}</span>{i.dueAt&&<span>by {formatAU(i.dueAt,'short')}</span>}</div></div><span className="chev" aria-hidden="true">›</span></Link></li>;
 return <main id="main" className="bear-screen">
  <h1>Bear Helps</h1>
  <p className="small muted" style={{marginTop:6}}>Bear gets the work ready: drafts, call notes, small steps. You check it and decide. Bear never sends, pays or submits anything for you.</p>
  {started.length>0&&<section className="section"><p className="eyebrow teal">Pick up where you left off</p><ul className="b-list glass">{started.map(row)}</ul></section>}
  <section className="section">{rest.length?<ul className="b-list glass">{rest.map(row)}</ul>:<p className="faint">{started.length?'':'Nothing here yet. Things like emails, calls, follow-ups and bills show up here once you unload them.'}</p>}</section>
 </main>;
}
