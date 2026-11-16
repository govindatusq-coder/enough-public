'use client';
// What Bear has learned about how she likes to do things: each one with where it came from, and a way to remove it.
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';
interface Pref{id:string;text:string;source:'explicit'|'inferred'|'observed';evidenceCount:number;dimension:string;value:string}
const where={explicit:'You told Bear',inferred:'Bear noticed this a few times',observed:'Bear noticed this once (not a rule yet)'};
export default function Learned(){
 const [prefs,setPrefs]=useState<Pref[]|null>(null);const [err,setErr]=useState<string|null>(null);
 useEffect(()=>{apiGet<{preferences:Pref[]}>('/api/bear/rre/preferences').then(r=>setPrefs(r.preferences)).catch(e=>setErr((e as Error).message));},[]);
 async function remove(id:string){try{setPrefs((await apiSend<{preferences:Pref[]}>('/api/bear/rre/preferences',{id},'DELETE')).preferences);}catch(e){setErr((e as Error).message);}}
 async function set(value:'online'|'in_person'){try{setPrefs((await apiSend<{preferences:Pref[]}>('/api/bear/rre/preferences',{dimension:'purchase_method',value},'PUT')).preferences);}catch(e){setErr((e as Error).message);}}
 if(err&&!prefs)return <main id="main" className="bear-screen"><ErrorCard message={err}/></main>;
 if(!prefs)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const buy=prefs.find(p=>p.dimension==='purchase_method');
 return <main id="main" className="bear-screen">
  <TopBar back={{href:'/bear/me',label:'Settings'}}/>
  <h1>What Bear has learned</h1>
  <p className="small muted" style={{marginTop:6}}>Bear learns only from what you do: the ways you choose to get things done, and where you put things. Nothing here is a rule unless you say so.</p>
  <ul className="share-list" style={{marginTop:16}}>{prefs.map(p=><li key={p.id} className="share-card glass" style={{display:'flex',gap:10,alignItems:'center'}}><div style={{flex:1}}><strong>{p.text}</strong><p className="tiny muted">{where[p.source]}</p></div><button type="button" className="btn ghost sm" onClick={()=>remove(p.id)} aria-label={`Forget: ${p.text}`}>Forget</button></li>)}</ul>
  {prefs.length===0&&<p className="faint" style={{marginTop:16}}>Nothing yet.</p>}
  <section className="section"><p className="eyebrow">Buying things</p><div className="chips" role="radiogroup" aria-label="When something needs buying" style={{gap:8}}>
   <button type="button" className="chip" role="radio" aria-checked={buy?.source==='explicit'&&buy.value==='online'} onClick={()=>set('online')}>Order online when it saves a trip</button>
   <button type="button" className="chip" role="radio" aria-checked={buy?.source==='explicit'&&buy.value==='in_person'} onClick={()=>set('in_person')}>I like to buy in person</button>
  </div></section>
  {err&&<div style={{marginTop:12}}><ErrorCard message={err}/></div>}
 </main>;
}
