'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import type {Instrument} from '@/lib/bear/study/instruments';
import {Button,ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

// The study survey: one short section at a time. Every question can be skipped.
type Status={available:boolean;enrolled?:boolean;due?:{phase:'baseline'|'weekly'|'end';week:number;label:string}|null;instruments?:Instrument[]};
export default function Study(){
 const router=useRouter();const [s,setS]=useState<Status|null>(null);const [ans,setAns]=useState<Record<string,number>>({});const [err,setErr]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 const load=useCallback(()=>apiGet<Status>('/api/bear/study').then(r=>{setS(r);setAns({});}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setErr(e.message);}),[router]);
 useEffect(()=>{load();},[load]);
 const inst=s?.instruments?.[0];
 // The trust question only makes sense at the end of the study.
 const items=inst?.items.filter(i=>!(i.id==='trust_bear'&&s?.due?.phase==='baseline'))||[];
 async function submit(){if(!inst||!s?.due)return;setBusy(true);setErr(null);
  try{if(Object.keys(ans).length)await apiSend('/api/bear/study',{action:'respond',phase:s.due.phase,week:s.due.week,instrument:inst.id,answers:ans});
   const next=await apiGet<Status>('/api/bear/study');if(next.due&&next.instruments?.length&&Object.keys(ans).length){setS(next);setAns({});window.scrollTo(0,0);}else setDone(true);}
  catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/me'}}/>
  {err&&<ErrorCard message={err} retry={load}/>}
  {!s&&!err&&<Skeleton/>}
  {s&&(done||!s.due||!inst)&&<div className="card" style={{textAlign:'center'}}><p style={{fontWeight:700,fontSize:19}}>{done?'Thank you.':'Nothing to answer right now.'}</p><p className="small muted" style={{marginTop:6}}>{done?'That really helps. Bear will let you know when the next one is due.':'Bear will let you know when the next check-in is due.'}</p><div className="btn-row" style={{justifyContent:'center'}}><Button className="sm" variant="primary" href="/bear/home">Back to My Bear</Button></div></div>}
  {s&&!done&&s.due&&inst&&<>
   <p className="eyebrow">{s.due.label}</p><h1 style={{fontSize:24}}>{inst.name}</h1><p className="small muted" style={{marginTop:4}}>Skip anything you’d rather not answer.</p>
   <div className="section">{items.map(i=><div key={i.id} className="card study-item">
    <label htmlFor={`q-${i.id}`} style={{fontWeight:600,display:'block'}}>{i.text}</label>
    {i.kind==='number'?<input id={`q-${i.id}`} type="number" inputMode="numeric" min={i.min} max={i.max} step={i.step||1} value={ans[i.id]??''} onChange={e=>{const v=e.target.value;setAns(a=>{const n={...a};if(v==='')delete n[i.id];else n[i.id]=Math.max(i.min,Math.min(i.max,Number(v)));return n;});}} style={{marginTop:8}}/>
    :i.max-i.min<=10?<div className="chips" role="radiogroup" aria-labelledby={`q-${i.id}`} style={{marginTop:8}}>{Array.from({length:i.max-i.min+1},(_,k)=>i.min+k).map(v=><button key={v} type="button" className="chip" role="radio" aria-checked={ans[i.id]===v} onClick={()=>setAns(a=>({...a,[i.id]:v}))}>{v}</button>)}</div>
    :<input id={`q-${i.id}`} type="range" min={i.min} max={i.max} step={i.step||1} value={ans[i.id]??Math.round((i.min+i.max)/2)} onChange={e=>setAns(a=>({...a,[i.id]:Number(e.target.value)}))} style={{width:'100%',marginTop:10}} aria-valuetext={ans[i.id]===undefined?'Not answered':String(ans[i.id])}/>}
    {(i.low||i.high)&&<div className="study-ends small muted"><span>{i.low}</span><span>{i.high}</span></div>}
    {i.kind==='scale'&&i.max-i.min>10&&ans[i.id]===undefined&&<p className="small muted" style={{marginTop:4}}>Not answered yet. Move the slider to answer.</p>}
   </div>)}</div>
   <div className="btn-stack"><Button variant="coral" disabled={busy} onClick={submit}>{Object.keys(ans).length?'Next':'Skip this section'}</Button></div>
   <p className="small faint" style={{marginTop:10}}>{inst.source}</p>
  </>}
 </main>;
}
