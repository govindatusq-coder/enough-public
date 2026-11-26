'use client';
// Her lists, her way: rename, add, remove, reorder, change icons. Removing a list never removes what's in it.
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {BearList} from '@/lib/bear/board/logic';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
import {SmartBack} from '@/components/bear/smart-back';
type Row={id:string;title:string;icon:string};
export default function Lists(){
 const [rows,setRows]=useState<Row[]|null>(null);const [icons,setIcons]=useState<string[]>([]);const [err,setErr]=useState<string|null>(null);const [note,setNote]=useState<string|null>(null);const [picking,setPicking]=useState<number|null>(null);const [busy,setBusy]=useState(false);
 // Lists from Bear's suggested sets she can mix in (Bear knows what belongs in these, so it can suggest a place for things).
 const [suggested,setSuggested]=useState<Row[]>([]);
 useEffect(()=>{apiGet<{sets:{lists:Row[]}[]}>('/api/bear/adaptive').then(v=>{const seen=new Set<string>();setSuggested(v.sets.flatMap(s=>s.lists).filter(l=>!seen.has(l.id)&&seen.add(l.id)));}).catch(()=>{});},[]);
 useEffect(()=>{apiGet<{lists:BearList[];icons:string[]}>('/api/bear/board/lists').then(r=>{setRows(r.lists.map(({id,title,icon})=>({id,title,icon})));setIcons(r.icons);}).catch(e=>setErr((e as Error).message));},[]);
 if(err&&!rows)return <main id="main" className="bear-screen"><ErrorCard message={err}/></main>;
 if(!rows)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const set=(i:number,p:Partial<Row>)=>setRows(r=>r!.map((x,j)=>j===i?{...x,...p}:x));
 const swap=(i:number,j:number)=>setRows(r=>{const a=[...r!];[a[i],a[j]]=[a[j],a[i]];return a;});
 async function save(){setBusy(true);setErr(null);try{const r=await apiSend<{lists:BearList[];returned:number}>('/api/bear/board/lists',{lists:rows!.filter(x=>x.title.trim()).map(x=>({...x,title:x.title.trim()}))},'PUT');setRows(r.lists.map(({id,title,icon})=>({id,title,icon})));setNote(r.returned?`Saved. ${r.returned} ${r.returned===1?'thing':'things'} from a removed list went back to My Brain Dump.`:'Saved.');}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen">
  <SmartBack fallback={{href:'/bear/me',label:'Settings'}}/>
  <h1>My Lists</h1>
  <p className="small muted" style={{marginTop:6}}>Make them yours. If you remove a list, anything in it goes back to My Brain Dump. Nothing is deleted.</p>
  <ul className="b-list glass" style={{marginTop:16,padding:'4px 8px'}}>
   {rows.map((r,i)=><li key={r.id+i} className="b-row" style={{flexWrap:'wrap'}}>
    <button type="button" className="list-icon-btn" aria-label={`Icon for ${r.title}: ${r.icon}. Change`} onClick={()=>setPicking(picking===i?null:i)}>{r.icon}</button>
    <input className="b-edit" value={r.title} onChange={e=>set(i,{title:e.target.value})} maxLength={40} aria-label="List name" style={{flex:1}}/>
    <button type="button" className="b-more" aria-label="Move up" disabled={i===0} onClick={()=>swap(i,i-1)}>↑</button>
    <button type="button" className="b-more" aria-label="Move down" disabled={i===rows.length-1} onClick={()=>swap(i,i+1)}>↓</button>
    <button type="button" className="b-more" aria-label={`Remove ${r.title}`} onClick={()=>setRows(x=>x!.filter((_,j)=>j!==i))}>✕</button>
    {picking===i&&<div className="chips" style={{width:'100%',gap:6,padding:'6px 0'}}>{icons.map(ic=><button type="button" key={ic} className="chip" aria-pressed={r.icon===ic} onClick={()=>{set(i,{icon:ic});setPicking(null);}}>{ic}</button>)}</div>}
   </li>)}
  </ul>
  <button type="button" className="btn ghost sm" style={{marginTop:12}} disabled={rows.length>=20} onClick={()=>setRows(r=>[...r!,{id:'new',title:'New list',icon:'⭐'}])}>Add a list</button>
  {suggested.some(x=>!rows.some(r=>r.id===x.id))&&<div className="lists-suggested"><p className="small muted">Or add one of Bear’s lists:</p>
   <div className="chips" style={{gap:6}}>{suggested.filter(x=>!rows.some(r=>r.id===x.id)).map(x=><button type="button" key={x.id} className="chip" disabled={rows.length>=20} onClick={()=>setRows(r=>[...r!,{...x}])}>{x.icon} {x.title}</button>)}</div></div>}
  <p className="small" style={{marginTop:14}}><Link href="/bear/me/days">Lists that suit how your days work</Link></p>
  <div className="btn-row" style={{marginTop:18}}><button type="button" className="btn coral" disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button></div>
  {note&&<p className="note teal" role="status" style={{marginTop:12}}>{note}</p>}
  {err&&<div style={{marginTop:12}}><ErrorCard message={err}/></div>}
 </main>;
}
