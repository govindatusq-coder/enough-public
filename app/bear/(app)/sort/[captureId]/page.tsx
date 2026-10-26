'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {ProjectPriority} from '@/lib/bear/domain/types';
import {todayISO} from '@/lib/bear/domain/dates';
import {CaptureBear} from '@/components/bear/art';
import {Button,Chip,ErrorCard,Skeleton,Toast,TopBar} from '@/components/bear/ui';

// After a brain dump: every heading is now a project with its to-dos. One light question
// per project, how soon, and nothing else. Skipping leaves everything quietly held.
type Dump={areaKey:string;projects:{id:string;title:string;priority:ProjectPriority|null;dueAt:string|null;tasks:{id:string;title:string}[]}[]};
const choices:{value:ProjectPriority;label:string}[]=[{value:'now',label:'This week'},{value:'soon',label:'This month'},{value:'later',label:'Later'},{value:'none',label:'No rush'}];

export default function SortDump({params}:{params:Promise<{captureId:string}>}){
 const {captureId}=use(params);const router=useRouter();
 const [data,setData]=useState<Dump|null>(null);const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [picks,setPicks]=useState<Record<string,{priority:ProjectPriority;dueAt:string|null}>>({});const [open,setOpen]=useState<string|null>(null);const [dating,setDating]=useState<string|null>(null);
 const load=useCallback(()=>apiGet<Dump>(`/api/bear/dump/${captureId}`).then(d=>{setData(d);setPicks(Object.fromEntries(d.projects.filter(p=>p.priority).map(p=>[p.id,{priority:p.priority!,dueAt:p.dueAt}])));}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[captureId,router]);
 useEffect(()=>{load();},[load]);
 async function save(all?:ProjectPriority){if(!data)return;setBusy(true);
  const projects=data.projects.map(p=>({id:p.id,...(all?{priority:all,dueAt:null}:picks[p.id]||{priority:'none' as ProjectPriority,dueAt:null})}));
  try{await apiSend(`/api/bear/dump/${captureId}`,{projects});router.replace(`/bear/areas/${data.areaKey}?sorted=1`);}catch(e){setError((e as Error).message);setBusy(false);}}
 if(error&&!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><ErrorCard message={error} retry={load}/></main>;
 if(!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><Skeleton/></main>;
 const total=data.projects.reduce((n,p)=>n+p.tasks.length,0);
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}}/>
   <div style={{display:'flex',gap:10,alignItems:'center'}}><CaptureBear width={110}/><div><h1>Got it all.</h1><p className="muted" style={{marginTop:6}}>{data.projects.length} projects, {total} things. They&rsquo;re filed and safe.</p></div></div>
   <p style={{marginTop:16,fontWeight:700,fontSize:18}}>How should I line them up?</p>
   <p className="small muted" style={{marginTop:4}}>Pick how soon for each project. Bear brings back only the next thing in each, never the whole list.</p>
   {data.projects.map(p=>{const pick=picks[p.id];return <section key={p.id} className="card sort-card" style={{marginTop:12}}>
    <button type="button" className="sort-head" aria-expanded={open===p.id} onClick={()=>setOpen(open===p.id?null:p.id)}><span className="title">{p.title}</span><span className="faint small">{p.tasks.length} {p.tasks.length===1?'thing':'things'} ›</span></button>
    {open===p.id&&<ul className="sort-tasks">{p.tasks.map(t=><li key={t.id} className="small">{t.title}</li>)}</ul>}
    <div className="chips" style={{marginTop:10}} role="group" aria-label={`How soon for ${p.title}`}>{choices.map(c=><Chip key={c.value} label={c.label} selected={pick?.priority===c.value&&!pick?.dueAt} onToggle={()=>{setDating(null);setPicks(x=>({...x,[p.id]:{priority:c.value,dueAt:null}}));}}/>)}<Chip label={pick?.dueAt?`By ${pick.dueAt.split('-').reverse().slice(0,2).join('/')}`:'By a date'} selected={!!pick?.dueAt||dating===p.id} onToggle={()=>setDating(dating===p.id?null:p.id)}/></div>
    {dating===p.id&&<div style={{display:'flex',gap:8,marginTop:8}}><input aria-label={`Date for ${p.title}`} type="date" min={todayISO()} value={pick?.dueAt||''} onChange={e=>setPicks(x=>({...x,[p.id]:{priority:'now',dueAt:e.target.value||null}}))}/></div>}
   </section>;})}
   <div className="btn-stack"><Button variant="coral" disabled={busy} onClick={()=>save()}>{busy?'Lining them up…':'That’s the order'}</Button><Button variant="quiet" disabled={busy} onClick={()=>save('none')}>Ask me later (all no rush)</Button></div>
   <Toast message={error} kind="error" onDone={()=>setError(null)}/>
  </main>
 );
}
