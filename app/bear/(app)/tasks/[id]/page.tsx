'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU,formatWhen,relativeDay,todayISO} from '@/lib/bear/domain/dates';
import {areaLabels} from '@/lib/bear/domain/labels';
import type {Project,Reminder,Task} from '@/lib/bear/domain/types';
import type {PlanRecommendation} from '@/lib/bear/services/reminder-planning';
import {RoundBadge} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,Sheet,Skeleton,Toast,TopBar} from '@/components/bear/ui';

type Loaded={task:Task;project:Project|null;reminders:Reminder[];steps:Task[];plan:PlanRecommendation|null;documentUrl:string|null;redirect?:string};
const kindLabel:Record<string,string>={appointment:'Appointment',school:'School',form:'Form',errand:'Errand',shopping:'Shopping',message:'From a message',note:'Note',event:'Event',custom:'Task'};
export default function TaskPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const router=useRouter();const search=useSearchParams();
 const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [custom,setCustom]=useState('');const [followUp,setFollowUp]=useState(true);const [showPlan,setShowPlan]=useState(search.get('plan')==='1');
 const reminderId=search.get('reminder');
 const load=useCallback(()=>apiGet<Loaded>(`/api/bear/tasks/${id}`).then(d=>{if(d.redirect){router.replace(d.redirect);return;}setData(d);setError(null);if(d.plan)setShowPlan(true);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[id,router]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'opened'}).catch(()=>{});},[reminderId]);
 if(error&&!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><ErrorCard message={error} retry={load}/></main>;
 if(!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><Skeleton/></main>;
 const {task,project,reminders,steps,plan}=data;const today=todayISO();const done=task.status==='done';const dropped=task.status==='dropped';
 const active=reminders.filter(r=>['scheduled','snoozed'].includes(r.status));
 async function acceptPlan(key:string,when:string|null,label:string,rationale:string){if(!when){setToast('Pick a time first.');return;}setBusy(true);
  try{await apiSend(`/api/bear/tasks/${id}/plan`,{when:new Date(when).toISOString(),label,rationale,key,followUpIfUnpaid:followUp});setShowPlan(false);setToast("Bear's got it. You can stop thinking about this one.");await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function markDone(){setBusy(true);try{const res=await apiSend<{win:{detail:string}}>(`/api/bear/tasks/${task.id}/complete`,{method:null,expectNext:false});if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'helped'}).catch(()=>{});router.replace(`/bear/wins?just=${encodeURIComponent(task.title+' · '+res.win.detail)}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function stepDone(s:Task){try{await apiSend(`/api/bear/tasks/${s.id}/complete`,{method:null,expectNext:false});setToast('Step done.');await load();}catch(e){setError((e as Error).message);}}
 async function drop(){if(!confirm('Tell Bear this is not important anymore? Reminders will stop.'))return;setBusy(true);try{await apiSend(`/api/bear/tasks/${task.id}/drop`,{});router.replace('/bear/home');}catch(e){setError((e as Error).message);setBusy(false);}}
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}} right={task.isDemo?<span className="demo-tag">Example</span>:null}/>
   <div className="card">
    <p className="eyebrow">{kindLabel[task.kind]||'Task'}{project&&<span className="pill" style={{marginLeft:8}}>{areaLabels[project.areaKey]}</span>}{done&&<span className="pill teal" style={{marginLeft:8}}>Done</span>}{dropped&&<span className="pill" style={{marginLeft:8}}>Let go</span>}</p>
    <h2 style={{marginTop:6}}>{task.title}</h2>
    <p className="muted" style={{marginTop:6}}>{task.dueAt?`${formatAU(task.dueAt)}${task.dueTime?' · '+task.dueTime:''}${/^(today|tomorrow|yesterday|[A-Z])/.test(relativeDay(task.dueAt,today))?' · '+relativeDay(task.dueAt,today):''}`:'No date'}</p>
    {task.forPerson&&<span className="pill" style={{marginTop:10,marginRight:6}}>For {task.forPerson}</span>}{task.location&&<span className="pill" style={{marginTop:10}}>{task.location}</span>}
    {task.notes&&<p className="small muted" style={{marginTop:12}}>{task.notes}</p>}
   </div>
   {!done&&!dropped&&<>
    {active.length>0&&!showPlan&&<div className="glass" style={{padding:16}}><p className="eyebrow teal">Bear&rsquo;s handling it</p><p><strong>Bringing it back {formatWhen(active[0].scheduledFor)}</strong></p><p className="small muted" style={{marginTop:4}}>{active[0].plan.rationale}</p><button type="button" className="btn quiet sm" style={{marginTop:8}} onClick={()=>setShowPlan(true)}>Change the plan</button></div>}
    {steps.length>0&&<div className="section"><p className="eyebrow">Steps</p><div className="card">{steps.map(s=><div key={s.id} className="row"><button type="button" className="icon-dot" aria-label={s.status==='done'?'Done':'Mark step done'} disabled={s.status==='done'} onClick={()=>stepDone(s)} style={{background:s.status==='done'?'var(--teal-tint)':'rgba(16,42,67,.06)'}}>{s.status==='done'?'✓':''}</button><span className="grow" style={{textDecoration:s.status==='done'?'line-through':'none',color:s.status==='done'?'var(--ink-3)':undefined}}>{s.title}</span></div>)}</div></div>}
    <div className="btn-stack" style={{marginTop:24}}><Button variant="coral" onClick={markDone} disabled={busy}>Done, it&rsquo;s sorted</Button><Button variant="quiet" onClick={drop} disabled={busy}>Not important anymore</Button></div>
   </>}
   {done&&<div className="glass" style={{padding:18,textAlign:'center'}}><RoundBadge size={120}/><BearSays>That&rsquo;s sorted.</BearSays><div className="btn-stack"><Button href="/bear/wins" variant="ghost">See it in My Wins</Button></div></div>}
   {data.documentUrl&&<p style={{marginTop:16}}><a className="pill" href={data.documentUrl} target="_blank" rel="noreferrer">Original</a></p>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {showPlan&&plan&&<Sheet onClose={()=>setShowPlan(false)} label="When should Bear bring this back?">
    <h2>When should I bring this back?</h2>
    <div className="glass" style={{padding:16,marginTop:14,background:'var(--teal-tint)'}}><p className="eyebrow teal" style={{marginBottom:4}}>Bear suggests</p><p style={{fontWeight:700,fontSize:19}}>{plan.suggested.label}</p><p className="small muted" style={{marginTop:4}}>&ldquo;{plan.suggested.rationale}&rdquo;</p><Button variant="primary" className="wide" style={{marginTop:12}} disabled={busy} onClick={()=>acceptPlan('bear',plan.suggested.when,plan.suggested.label,plan.suggested.rationale)}>Sounds good</Button></div>
    <div className="chips" style={{marginTop:14}}>{plan.alternatives.filter(a=>a.key!=='custom').map(a=><button key={a.key} type="button" className="chip" disabled={busy} onClick={()=>acceptPlan(a.key,a.when,a.label,a.rationale)}>{a.label}</button>)}</div>
    <div className="field"><label htmlFor="custom-when">Choose a time</label><div style={{display:'flex',gap:8}}><input id="custom-when" type="datetime-local" value={custom} onChange={e=>setCustom(e.target.value)}/><Button variant="ghost" disabled={!custom||busy} onClick={()=>acceptPlan('custom',custom,new Date(custom).toLocaleString('en-AU',{weekday:'long',hour:'numeric',minute:'2-digit'}),'You chose this time.')}>Set</Button></div></div>
    <label style={{display:'flex',gap:10,alignItems:'center',marginTop:16}}><input type="checkbox" checked={followUp} onChange={e=>setFollowUp(e.target.checked)} style={{width:22,height:22}}/> Remind me again if it isn&rsquo;t done.</label>
    <div className="btn-stack"><Button variant="quiet" onClick={()=>setShowPlan(false)}>No reminder, just hold it</Button></div>
   </Sheet>}
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
