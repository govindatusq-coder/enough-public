'use client';
// Her household for Share Bear. Anyone she shares with is added here automatically; email and phone are optional and only
// fill in her own Mail or Messages app when she sends a link.
import {useEffect,useState} from 'react';
import {apiGet,apiSend} from '@/lib/bear/client';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';
type Person={id:string;name:string;email:string|null;phone:string|null;joined?:boolean};
export default function Household(){
 const [rows,setRows]=useState<Person[]|null>(null);const [err,setErr]=useState<string|null>(null);const [note,setNote]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 useEffect(()=>{apiGet<{people:Person[]}>('/api/bear/board/household').then(r=>setRows(r.people)).catch(e=>setErr((e as Error).message));},[]);
 if(err&&!rows)return <main id="main" className="bear-screen"><ErrorCard message={err}/></main>;
 if(!rows)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const set=(i:number,p:Partial<Person>)=>{setNote(null);setRows(r=>r!.map((x,j)=>j===i?{...x,...p}:x));};
 async function save(){setBusy(true);setErr(null);try{const r=await apiSend<{people:Person[]}>('/api/bear/board/household',{people:rows!.filter(p=>p.name.trim()).map(p=>({id:p.id,name:p.name.trim(),email:p.email?.trim()||'',phone:p.phone?.trim()||''}))},'PUT');setRows(r.people);setNote('Saved.');}catch(e){setErr((e as Error).message==='Check the details and try again.'?'Check the email addresses and phone numbers, then save again.':(e as Error).message);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen">
  <TopBar back={{href:'/bear/me',label:'Settings'}}/>
  <h1>Your household</h1>
  <p className="small muted" style={{marginTop:6}}>The people you share things with. Anyone you share with is added here for you. Email and phone are optional: they only fill in your own Mail or Messages when you send a link. A ✓ means they’ve said yes to something, so they have Load Bear.</p>
  {rows.length===0&&<p className="faint" style={{marginTop:16}}>Nobody yet. Add someone, or just share something from a task’s ••• menu.</p>}
  <ul className="share-list" style={{marginTop:16}}>{rows.map((p,i)=><li key={p.id+i} className="share-card glass" style={{display:'grid',gap:8}}>
   <div style={{display:'flex',gap:8,alignItems:'center'}}><input className="b-edit" value={p.name} onChange={e=>set(i,{name:e.target.value})} maxLength={60} aria-label="Name" style={{flex:1}}/>{p.joined&&<span className="b-tag" title="Has Load Bear">✓ Load Bear</span>}<button type="button" className="b-more" aria-label={`Remove ${p.name}`} onClick={()=>setRows(r=>r!.filter((_,j)=>j!==i))}>✕</button></div>
   <div className="fam-row"><label className="ce-field">Email (optional)<input type="email" inputMode="email" value={p.email||''} onChange={e=>set(i,{email:e.target.value})} maxLength={200}/></label><label className="ce-field">Mobile (optional)<input type="tel" inputMode="tel" value={p.phone||''} onChange={e=>set(i,{phone:e.target.value})} maxLength={22}/></label></div>
  </li>)}</ul>
  <button type="button" className="btn ghost sm" style={{marginTop:12}} disabled={rows.length>=30} onClick={()=>setRows(r=>[...r!,{id:'new',name:'',email:null,phone:null}])}>Add someone</button>
  <div className="btn-row" style={{marginTop:18}}><button type="button" className="btn coral" disabled={busy} onClick={save}>{busy?'Saving…':'Save'}</button></div>
  {note&&<p className="note teal" role="status" style={{marginTop:12}}>{note}</p>}
  {err&&rows&&<div style={{marginTop:12}}><ErrorCard message={err}/></div>}
 </main>;
}
