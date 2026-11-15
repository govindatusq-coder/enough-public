'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {daysBetween,formatAU} from '@/lib/bear/domain/dates';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

// Load Bear's own calendar: everything Bear is holding that has a date, day by day. Tap one to open it. Things can be added here
// directly; they become ordinary tasks, reminded like anything else.
type Entry={taskId:string;title:string;date:string;time:string|null;location:string|null;area:string;light:'red'|'amber'|'green';web:boolean};
type View={today:string;overdue:Entry[];days:{date:string;items:Entry[]}[];undated:number};
const AREA:Record<string,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
function dayLabel(date:string,today:string){const n=daysBetween(today,date)??0;if(n===0)return 'Today';if(n===1)return 'Tomorrow';return formatAU(date,n<7?'weekday':'long');}
function Row({e}:{e:Entry}){
 return <li className={`cal-row ${e.light}`} data-area={e.area}>
  <span className="cal-time">{e.time?e.time:'All day'}</span>
  <Link href={`/bear/tasks/${e.taskId}`} className="cal-title">{e.title}<span className="cal-sub">{AREA[e.area]||e.area}{e.location?` · ${e.location}`:''}{e.web?' · found online':''}</span></Link>
 </li>;
}
export default function CalendarPage(){
 const [v,setV]=useState<View|null>(null);const [err,setErr]=useState<string|null>(null);
 const load=()=>apiGet<View>('/api/bear/calendar-view').then(r=>{setV(r);
  // Opened from a card: go to that day.
  setTimeout(()=>{const id=location.hash.slice(1);if(id)document.getElementById(id)?.scrollIntoView({block:'start'});},50);}).catch(e=>setErr((e as Error).message));
 useEffect(()=>{void load();},[]);
 const [adding,setAdding]=useState(false);const [title,setTitle]=useState('');const [date,setDate]=useState('');const [time,setTime]=useState('');const [busy,setBusy]=useState(false);
 async function add(){setBusy(true);setErr(null);try{await apiSend('/api/bear/calendar-view',{title:title.trim(),date,time:time||null});setTitle('');setDate('');setTime('');setAdding(false);await load();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 return <main id="main" className="bear-screen flow">
  <TopBar back={{href:'/bear/home',label:'My Bear'}}/>
  <h1>Calendar</h1>
  {!adding&&<div className="btn-row"><button type="button" className="btn coral sm" onClick={()=>setAdding(true)}>Add to calendar</button></div>}
  {adding&&<form className="card cal-addform" onSubmit={e=>{e.preventDefault();void add();}}>
   <label className="ce-field">What<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ava’s swimming carnival" maxLength={120} autoFocus/></label>
   <span className="fam-row"><label className="ce-field">Day<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="ce-field">Time (optional)<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label></span>
   <div className="btn-row"><button type="submit" className="btn coral sm" disabled={busy||title.trim().length<2||!date}>Add</button><button type="button" className="btn quiet sm" onClick={()=>setAdding(false)}>Cancel</button></div>
  </form>}
  {err&&<ErrorCard message={err}/>}{!v&&!err&&<Skeleton/>}
  {v&&<>
   {v.overdue.length>0&&<section className="section"><p className="eyebrow" style={{color:'#B42318'}}>Past its date</p><ul className="cal-list">{v.overdue.map(e=><Row key={e.taskId} e={e}/>)}</ul></section>}
   {v.days.map(d=><section key={d.date} id={`d-${d.date}`} className="section"><p className="eyebrow">{dayLabel(d.date,v.today)}{(daysBetween(v.today,d.date)??0)>1&&(daysBetween(v.today,d.date)??0)<7?` · ${formatAU(d.date,'short')}`:''}</p><ul className="cal-list">{d.items.map(e=><Row key={e.taskId} e={e}/>)}</ul></section>)}
   {!v.days.length&&!v.overdue.length&&<div className="card"><p className="muted">Nothing with a date yet. Anything you give Bear with a date shows here.</p><div className="btn-row"><Link href="/bear/capture" className="btn sm">Give it to Bear</Link></div></div>}
   {v.undated>0&&<p className="small muted" style={{marginTop:14}}>{v.undated} more {v.undated===1?'thing has':'things have'} no date. <Link href="/bear/me/everything" style={{textDecoration:'underline'}}>See them</Link></p>}
  </>}
 </main>;
}
