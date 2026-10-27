'use client';
import {use,useCallback,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU,formatWhen,relativeDay,todayISO} from '@/lib/bear/domain/dates';
import {areaLabels} from '@/lib/bear/domain/labels';
import {formatAUD} from '@/lib/bear/domain/money';
import {BIG_SPEND_CENTS,formatItemLine,LARGE_PURCHASE_CENTS,parseItemLines} from '@/lib/bear/domain/items';
import type {Project,Reminder,ShoppingItem,Task} from '@/lib/bear/domain/types';
import type {PlanRecommendation} from '@/lib/bear/services/reminder-planning';
import {RoundBadge} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,Chip,ErrorCard,OverdueAlert,Sheet,Skeleton,Toast,TopBar} from '@/components/bear/ui';
import {overdueDays,overdueLabel} from '@/lib/bear/domain/overdue';
import type {LoadView} from '@/lib/bear/load/view';
import {LoadPanel} from '@/components/bear/load-panel';
import {WhyThisMatters,trafficLight,type PriorityView} from '@/components/bear/why-this-matters';

type Loaded={task:Task;project:Project|null;reminders:Reminder[];steps:Task[];plan:PlanRecommendation|null;documentUrl:string|null;redirect?:string;load:LoadView|null;priority?:PriorityView|null};
const kindLabel:Record<string,string>={appointment:'Appointment',school:'School',form:'Form',errand:'Errand',shopping:'Shopping',message:'From a message',note:'Note',event:'Event',custom:'Task'};
export default function TaskPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const router=useRouter();const search=useSearchParams();
 const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [custom,setCustom]=useState('');const [followUp,setFollowUp]=useState(true);const [showPlan,setShowPlan]=useState(search.get('plan')==='1');
 const reminderId=search.get('reminder');
 const [stepText,setStepText]=useState('');const [stepBusy,setStepBusy]=useState(false);
 const [nudgeStep,setNudgeStep]=useState<null|'every'|'day'>(null);const [nudgeDate,setNudgeDate]=useState('');const [readBusy,setReadBusy]=useState(false);
 const [affordStep,setAffordStep]=useState<'ask'|'date'|'unsure'>('ask');const [affordDate,setAffordDate]=useState('');
 const [showEdit,setShowEdit]=useState(false);const [showSplit,setShowSplit]=useState(false);const [edit,setEdit]=useState({title:'',dueAt:'',dueTime:'',forPerson:'',location:'',notes:'',list:'',importance:null as 'very'|'nice'|'not'|null});const [estimating,setEstimating]=useState(false);
 const load=useCallback(()=>apiGet<Loaded>(`/api/bear/tasks/${id}`).then(d=>{if(d.redirect){router.replace(d.redirect);return;}setData(d);setError(null);if(d.plan&&d.task.setupBy!=='bear')setShowPlan(true);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[id,router]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'opened'}).catch(()=>{});},[reminderId]);
 if(error&&!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><ErrorCard message={error} retry={load}/></main>;
 if(!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><Skeleton/></main>;
 const {task,project,reminders,steps,plan}=data;const today=todayISO();const done=task.status==='done';const dropped=task.status==='dropped';
 const active=reminders.filter(r=>['scheduled','snoozed'].includes(r.status));
 const items=task.items||[];const hasSteps=steps.length>0;const openItems=items.filter(i=>!i.done);const missingPrices=items.some(i=>i.estimatedCents===null);const cost=task.estimatedCents??null;
 const stepsDone=hasSteps&&steps.every(x=>x.status==='done');
 const onWishlist=!!task.wishlist&&task.status==='open';const askAfford=!done&&!dropped&&!task.wishlist&&task.buyWhen!=='now'&&(cost??0)>=BIG_SPEND_CENTS;
 async function acceptPlan(key:string,when:string|null,label:string,rationale:string){if(!when){setToast('Pick a time first.');return;}setBusy(true);
  try{await apiSend(`/api/bear/tasks/${id}/plan`,{when:new Date(when).toISOString(),label,rationale,key,followUpIfUnpaid:followUp});setShowPlan(false);setToast("Bear's got it. You can stop thinking about this one.");await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function markDone(){setBusy(true);try{const res=await apiSend<{win:{detail:string}}>(`/api/bear/tasks/${task.id}/complete`,{method:null,expectNext:false});if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'helped'}).catch(()=>{});router.replace(`/bear/wins?just=${encodeURIComponent(task.title+' · '+res.win.detail)}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function stepDone(s:Task){try{await apiSend(`/api/bear/tasks/${s.id}/complete`,{method:null,expectNext:false});setToast('Step done.');await load();}catch(e){setError((e as Error).message);}}
 async function drop(){if(!confirm('Tell Bear this is not important anymore? Reminders will stop.'))return;setBusy(true);try{await apiSend(`/api/bear/tasks/${task.id}/drop`,{});router.replace('/bear/home');}catch(e){setError((e as Error).message);setBusy(false);}}

 function openEdit(){setEdit({title:task.title,dueAt:task.dueAt||'',dueTime:task.dueTime||'',forPerson:task.forPerson||'',location:task.location||'',notes:task.notes||'',list:(task.items||[]).map(i=>formatItemLine(i)).join('\n'),importance:task.importance||null});setShowEdit(true);}
 async function saveEdit(){if(!edit.title.trim()){setToast('Give it a name first.');return;}setBusy(true);
  const before=new Map((task.items||[]).map(i=>[i.name.trim().toLowerCase(),i]));
  const items=parseItemLines(edit.list).map(i=>{const prev=before.get(i.name.trim().toLowerCase());return {id:prev?.id,name:i.name,quantity:i.quantity,estimatedCents:i.estimatedCents,done:prev?.done??false};});
  try{await apiSend(`/api/bear/tasks/${id}`,{title:edit.title.trim(),dueAt:edit.dueAt||null,dueTime:edit.dueTime||null,forPerson:edit.forPerson.trim()||null,location:edit.location.trim()||null,notes:edit.notes.trim()||null,...(edit.list.trim()||task.items?.length?{items}:{})},'PATCH');if((edit.importance||null)!==(task.importance||null))await apiSend(`/api/bear/tasks/${id}/importance`,{level:edit.importance});setShowEdit(false);setToast('Saved.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function deleteIt(){if(!confirm(done?'Delete this? It will also come out of My Wins.':'Delete this for good? Its steps and reminders go with it.'))return;setBusy(true);try{await apiSend(`/api/bear/tasks/${id}`,{},'DELETE');router.replace('/bear/home');}catch(e){setError((e as Error).message);setBusy(false);}}
 async function reopen(){setBusy(true);try{await apiSend(`/api/bear/tasks/${id}/reopen`,{});setToast('Back on your list.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function tick(item:ShoppingItem){try{const res=await apiSend<{completed:boolean;win:{detail:string}|null}>(`/api/bear/tasks/${id}/items`,{itemId:item.id,done:!item.done});if(res.completed){router.replace(`/bear/wins?just=${encodeURIComponent(task.title+' · '+(res.win?.detail||'Done'))}`);return;}await load();}catch(e){setError((e as Error).message);}}
 async function gotEverything(){setBusy(true);try{const res=await apiSend<{win:{detail:string}|null}>(`/api/bear/tasks/${id}/items`,{all:true});router.replace(`/bear/wins?just=${encodeURIComponent(task.title+' · '+(res.win?.detail||'Done'))}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function estimate(){setEstimating(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/estimate`,{});await load();setToast('Rough prices added. They are estimates, not quotes.');}catch(e){setError((e as Error).message);}finally{setEstimating(false);}}
 async function split(parts:number){setBusy(true);try{const res=await apiSend<{areaKey:string}>(`/api/bear/tasks/${id}/split`,{parts});setShowSplit(false);router.push(`/bear/areas/${res.areaKey}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function afford(body:{mode:'now'|'date'|'check_back'|'wishlist';date?:string;days?:number}){setBusy(true);try{await apiSend(`/api/bear/tasks/${id}/afford`,body);setToast(body.mode==='now'?"Good. Bear will plan it.":body.mode==='wishlist'?'On your wishlist. It will wait there.':'On your wishlist. Bear will check back.');setAffordStep('ask');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

 async function changeRead(body:{timing?:'time_sensitive'|'flexible';size?:'one_go'|'bigger'}){setReadBusy(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/read`,body);setNudgeStep(null);await load();}catch(e){setError((e as Error).message);}finally{setReadBusy(false);}}
 async function chooseNudge(body:{choice:'none'|'every'|'day';every?:'week'|'fortnight'|'month';date?:string}){setReadBusy(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/nudge`,body);setNudgeStep(null);setToast(body.choice==='none'?"No reminders. It will be here when you want it.":'Got it. Bear will keep it gentle.');await load();}catch(e){setError((e as Error).message);}finally{setReadBusy(false);}}
 async function breakItDown(){setReadBusy(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/breakdown`,{});setToast('Broken into small steps.');await load();}catch(e){setError((e as Error).message);}finally{setReadBusy(false);}}

 async function addMyStep(){const title=stepText.trim();if(!title)return;setStepBusy(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/steps`,{title});setStepText('');await load();document.getElementById('add-step')?.focus();}catch(e){setError((e as Error).message);}finally{setStepBusy(false);}}
 async function removeMyStep(stepId:string){setStepBusy(true);setError(null);try{await apiSend(`/api/bear/tasks/${id}/steps?step=${encodeURIComponent(stepId)}`,{},'DELETE');await load();}catch(e){setError((e as Error).message);}finally{setStepBusy(false);}}
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}} right={task.isDemo?<span className="demo-tag">Example</span>:null}/>
   <div className="card">
    <p className="eyebrow">{kindLabel[task.kind]||'Task'}{project&&<span className="pill" style={{marginLeft:8}}>{areaLabels[project.areaKey]}</span>}{task.part&&<span className="pill" style={{marginLeft:8}}>Part {task.part.index} of {task.part.total}</span>}{onWishlist&&<span className="pill mustard" style={{marginLeft:8}}>Wishlist</span>}{done&&<span className="pill teal" style={{marginLeft:8}}>Done</span>}{dropped&&<span className="pill" style={{marginLeft:8}}>Let go</span>}</p>
    <h2 style={{marginTop:6}}>{task.title}</h2>
    <p className="muted" style={{marginTop:6}}>{task.timing==='flexible'?'No rush':task.dueAt?`${formatAU(task.dueAt)}${task.dueTime?' · '+task.dueTime:''}${/^(today|tomorrow|yesterday|[A-Z])/.test(relativeDay(task.dueAt,today))?' · '+relativeDay(task.dueAt,today):''}`:'No date'}</p>
    {task.forPerson&&<span className="pill" style={{marginTop:10,marginRight:6}}>For {task.forPerson}</span>}{task.location&&<span className="pill" style={{marginTop:10}}>{task.location}</span>}
    {task.notes&&<p className="small muted" style={{marginTop:12}}>{task.notes}</p>}
    {items.length>0&&<p style={{marginTop:12,fontWeight:700,fontSize:19}}>{(cost??0)>0?`About ${formatAUD(cost)}`:'No cost estimate yet'}<span className="small muted" style={{fontWeight:400}}>{(cost??0)>0?(missingPrices?' · rough estimate, some items not priced':' · rough estimate, not a quote'):''}</span></p>}
    <div className="btn-row" style={{marginTop:12}}>{!dropped&&<Button className="sm" variant="ghost" onClick={openEdit}>Edit</Button>}{items.length>0&&missingPrices&&!done&&<Button className="sm" variant="primary" disabled={estimating} onClick={estimate}>{estimating?'Estimating…':(cost??0)>0?'Price the rest':'Estimate the cost'}</Button>}</div>
   </div>
   {data.load&&!dropped&&!onWishlist&&(!done||data.load.state==='resolved')&&<LoadPanel taskId={task.id} view={data.load} onNeedInfo={openEdit} onSaid={setToast} onChanged={d=>{if(d){router.replace(`/bear/wins?just=${encodeURIComponent(task.title+' · Sorted')}`);return;}load();}}/>}
   {data.priority&&!done&&!dropped&&!onWishlist&&<WhyThisMatters taskId={task.id} p={data.priority} onChanged={load}/>}
   {!done&&!dropped&&!onWishlist&&overdueDays(task.dueAt,today,task.timing)>0&&<div style={{marginTop:14}}><OverdueAlert title={`This is overdue. ${overdueLabel(overdueDays(task.dueAt,today,task.timing))}.`}><p className="small muted">The date was {formatAU(task.dueAt!)}. It isn&rsquo;t too late: do it now, change the date with Edit, or choose No rush below if it can wait.</p></OverdueAlert></div>}
   {askAfford&&<div className="glass" style={{padding:16,marginTop:14,background:'var(--mustard-tint)'}}>
    <p className="eyebrow" style={{marginBottom:4}}>That&rsquo;s a bigger spend</p>
    <p style={{fontWeight:700,fontSize:18}}>About {formatAUD(cost)}. When could you comfortably buy it?</p>
    {affordStep==='ask'&&<div className="btn-row" style={{marginTop:10}}><Button className="sm" variant="primary" disabled={busy} onClick={()=>afford({mode:'now'})}>I can buy it now</Button><Button className="sm" variant="ghost" onClick={()=>setAffordStep('date')}>On a date</Button><Button className="sm" variant="ghost" onClick={()=>setAffordStep('unsure')}>I&rsquo;m not sure yet</Button></div>}
    {affordStep==='date'&&<div style={{marginTop:10}}><div className="field"><label htmlFor="afford-date">I could buy it on</label><div style={{display:'flex',gap:8}}><input id="afford-date" type="date" value={affordDate} min={todayISO()} onChange={e=>setAffordDate(e.target.value)}/><Button variant="primary" disabled={!affordDate||busy} onClick={()=>afford({mode:'date',date:affordDate})}>Set</Button></div></div><p className="small muted">Bear will park it on your wishlist and bring it back that morning.</p><div className="btn-row"><Button className="sm" variant="quiet" onClick={()=>setAffordStep('ask')}>Back</Button></div></div>}
    {affordStep==='unsure'&&<div style={{marginTop:10}}><p className="small muted">No problem. Want Bear to check back with you?</p><div className="chips" style={{marginTop:8}}><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:14})}>In 2 weeks</button><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:30})}>In a month</button><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:90})}>In 3 months</button><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'wishlist'})}>Just put it on my wishlist</button></div><div className="btn-row"><Button className="sm" variant="quiet" onClick={()=>setAffordStep('ask')}>Back</Button></div></div>}
   </div>}
   {onWishlist&&<div className="glass" style={{padding:16,marginTop:14,background:'var(--mustard-tint)'}}>
    <p className="eyebrow" style={{marginBottom:4}}>On your wishlist</p>
    <p style={{fontWeight:700,fontSize:18}}>{task.wishlist?.checkBackAt?`Bear will check back ${formatAU(task.wishlist.checkBackAt)}.`:'Waiting until you are ready. No date set.'}</p>
    <p className="small muted" style={{marginTop:4}}>It is kept off your main screen. Find it under Wishlist in Your areas.</p>
    <div className="btn-row" style={{marginTop:10}}><Button className="sm" variant="primary" disabled={busy} onClick={()=>afford({mode:'now'})}>Ready to buy it now</Button></div>
    <div className="chips" style={{marginTop:10}} role="group" aria-label="Check back later"><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:14})}>Ask me in 2 weeks</button><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:30})}>In a month</button><button type="button" className="chip" disabled={busy} onClick={()=>afford({mode:'check_back',days:90})}>In 3 months</button></div>
   </div>}
   {!done&&!dropped&&!onWishlist&&!askAfford&&active.length===0&&plan&&!showPlan&&<div className="btn-row" style={{marginTop:12}}><Button className="sm" variant="ghost" onClick={()=>setShowPlan(true)}>Set a reminder</Button></div>}
   {!done&&!dropped&&<details className="load-details" open={!data.load||search.get('details')==='1'||undefined}><summary>Details</summary>
   {!done&&!dropped&&!onWishlist&&!task.part&&<div className="glass read-card">
    <p className="eyebrow">How I read this</p>
    <p className="small muted">Filed under <strong>{project?areaLabels[project.areaKey]:'Me'}</strong>. Change any of it with a tap, or just leave it.</p>
    <div className="read-row"><span className="read-label">How soon</span><div className="chips"><Chip label="Time-sensitive" selected={task.timing==='time_sensitive'} onToggle={()=>!readBusy&&task.timing!=='time_sensitive'&&changeRead({timing:'time_sensitive'})}/><Chip label="No rush" selected={task.timing==='flexible'} onToggle={()=>!readBusy&&task.timing!=='flexible'&&changeRead({timing:'flexible'})}/></div></div>
    <div className="read-row"><span className="read-label">How big</span><div className="chips"><Chip label="One go" selected={task.size!=='bigger'} onToggle={()=>!readBusy&&task.size==='bigger'&&changeRead({size:'one_go'})}/><Chip label="Bigger, in parts" selected={task.size==='bigger'} onToggle={()=>!readBusy&&task.size!=='bigger'&&changeRead({size:'bigger'})}/></div></div>
    {task.size==='bigger'&&!hasSteps&&<div className="btn-row"><Button className="sm" variant="ghost" disabled={readBusy} onClick={breakItDown}>{readBusy?'Thinking…':'Break it into small steps'}</Button></div>}
    {task.timing==='time_sensitive'&&!active[0]&&<p className="small muted" style={{marginTop:10}}>No reminder is set yet.</p>}
    {task.timing==='flexible'&&<div className="read-row" style={{marginTop:10}}><span className="read-label">Reminders</span><div className="chips" role="group" aria-label="How would you like to be reminded">
     <Chip label="None, I'll look when I'm ready" selected={task.nudgeChoice==='none'} onToggle={()=>!readBusy&&chooseNudge({choice:'none'})}/>
     <Chip label="Now and then" selected={task.nudgeChoice==='nudge'||nudgeStep==='every'} onToggle={()=>setNudgeStep(nudgeStep==='every'?null:'every')}/>
     <Chip label="On a day I pick" selected={task.nudgeChoice==='day'||nudgeStep==='day'} onToggle={()=>setNudgeStep(nudgeStep==='day'?null:'day')}/>
    </div></div>}
    {task.timing==='flexible'&&nudgeStep==='every'&&<div className="chips" style={{marginTop:8}}><Chip label="Every week" selected={task.nudge?.every==='week'} onToggle={()=>!readBusy&&chooseNudge({choice:'every',every:'week'})}/><Chip label="Every fortnight" selected={task.nudge?.every==='fortnight'} onToggle={()=>!readBusy&&chooseNudge({choice:'every',every:'fortnight'})}/><Chip label="Every month" selected={task.nudge?.every==='month'} onToggle={()=>!readBusy&&chooseNudge({choice:'every',every:'month'})}/></div>}
    {task.timing==='flexible'&&nudgeStep==='day'&&<div style={{display:'flex',gap:8,marginTop:8}}><input aria-label="Remind me on" type="date" value={nudgeDate} min={todayISO()} onChange={e=>setNudgeDate(e.target.value)}/><Button variant="primary" disabled={!nudgeDate||readBusy} onClick={()=>chooseNudge({choice:'day',date:nudgeDate})}>Set</Button></div>}
    {task.timing==='flexible'&&task.nudgeChoice==null&&nudgeStep===null&&<p className="small muted" style={{marginTop:8}}>No reminders are set. Choose one only if you&rsquo;d like it.</p>}
    {task.timing==='flexible'&&task.nudgeChoice==='nudge'&&task.nudge&&<p className="small muted" style={{marginTop:8}}>A quiet nudge about every {task.nudge.every==='week'?'week':task.nudge.every==='fortnight'?'fortnight':'month'}. You can stop it any time.</p>}
   </div>}
   {(hasSteps||(task.size==='bigger'&&items.length===0&&!task.part))&&<div className="section"><p className="eyebrow">{items.length>0?`Purchases${cost!==null?` · about ${formatAUD(cost)} in all`:''}`:'Steps'}</p><div className="card">
     {steps.map(s=><div key={s.id} className="row"><button type="button" className="icon-dot" aria-label={s.status==='done'?'Done':`Mark done: ${s.title}`} disabled={s.status==='done'} onClick={()=>stepDone(s)} style={{background:s.status==='done'?'var(--teal-tint)':'rgba(16,42,67,.06)'}}>{s.status==='done'?'✓':''}</button><span className="grow" style={{textDecoration:s.status==='done'?'line-through':'none',color:s.status==='done'?'var(--ink-3)':undefined}}>{s.title}{s.dueAt&&task.timing!=='flexible'?<span className="small faint"> · by {formatAU(s.dueAt,'short')}</span>:null}</span>{s.estimatedCents!=null&&<span className="small faint">~{formatAUD(s.estimatedCents)}</span>}{items.length===0&&!done&&<button type="button" className="step-x" aria-label={`Remove step: ${s.title}`} disabled={stepBusy} onClick={()=>removeMyStep(s.id)}>×</button>}</div>)}
     {steps.length===0&&<p className="small muted" style={{margin:'4px 0 8px'}}>No steps yet. Add your own below{task.size==='bigger'?', or ask Bear to suggest some above':''}.</p>}
     {stepsDone&&<p className="small" style={{marginTop:8}}>That is every step. Mark it done below.</p>}
     {items.length===0&&!done&&<form className="add-step" onSubmit={e=>{e.preventDefault();addMyStep();}}><label htmlFor="add-step" className="sr-only">Add a step</label><input id="add-step" aria-label="Add a step" placeholder="Add a step of your own" maxLength={120} value={stepText} onChange={e=>setStepText(e.target.value)}/><Button type="submit" variant="primary" className="sm" disabled={stepBusy||!stepText.trim()}>Add</Button></form>}
    </div></div>}
   </details>}
   {!done&&!dropped&&<>
    {active.length>0&&!showPlan&&!onWishlist&&!data.load&&<div className="glass" style={{padding:16}}><p className="eyebrow teal">Bear&rsquo;s handling it</p><p><strong>Bringing it back {formatWhen(active[0].scheduledFor)}</strong></p><p className="small muted" style={{marginTop:4}}>{active[0].plan.rationale}</p><button type="button" className="btn quiet sm" style={{marginTop:8}} onClick={()=>setShowPlan(true)}>Change the plan</button></div>}
    {items.length>0&&!hasSteps&&<div className="section"><p className="eyebrow">The list{cost!==null?` · about ${formatAUD(cost)} (rough estimate)`:''}</p><div className="card">
     {items.map(it=><div key={it.id} className="row"><button type="button" className="icon-dot" aria-label={it.done?`Un-tick ${it.name}`:`Got ${it.name}`} onClick={()=>tick(it)} style={{background:it.done?'var(--teal-tint)':'rgba(16,42,67,.06)'}}>{it.done?'✓':''}</button><span className="grow" style={{textDecoration:it.done?'line-through':'none',color:it.done?'var(--ink-3)':undefined}}>{formatItemLine(it)}</span>{it.estimatedCents!==null&&<span className="small faint">~{formatAUD(it.estimatedCents)}</span>}</div>)}
     <p className="small muted" style={{marginTop:8}}>{items.length-openItems.length} of {items.length} got. Tick things off as you go, in one trip or several. The last tick finishes it.</p>
     <div className="btn-row" style={{marginTop:8}}><Button className="sm" variant="primary" disabled={busy} onClick={gotEverything}>Got everything</Button>{missingPrices&&<Button className="sm" variant="ghost" disabled={estimating} onClick={estimate}>{estimating?'Estimating…':cost===null?'Estimate the cost':'Estimate the rest'}</Button>}{openItems.length>=2&&<Button className="sm" variant="ghost" onClick={()=>setShowSplit(true)}>Split into separate tasks</Button>}</div>
     {cost!==null&&cost>=LARGE_PURCHASE_CENTS&&<p className="small" style={{marginTop:10}}>That is a bigger spend. Splitting it into a few separate tasks can make it easier on the budget.</p>}
    </div></div>}
    <div className="btn-stack" style={{marginTop:24}}><Button variant="coral" onClick={markDone} disabled={busy}>Done, it&rsquo;s sorted</Button><Button variant="quiet" onClick={drop} disabled={busy}>Not important anymore</Button></div>
   </>}
   {done&&<div className="glass" style={{padding:18,textAlign:'center'}}><RoundBadge size={120}/><BearSays>That&rsquo;s sorted.</BearSays><div className="btn-stack"><Button href="/bear/wins" variant="ghost">See it in My Wins</Button><Button variant="quiet" disabled={busy} onClick={reopen}>Not actually done</Button></div></div>}
   {!task.isDemo&&<div className="btn-stack" style={{marginTop:6}}><Button variant="quiet" disabled={busy} onClick={deleteIt}><span style={{color:'#B42318'}}>Delete this</span></Button></div>}
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
   {showEdit&&<Sheet onClose={()=>setShowEdit(false)} label="Edit this">
    <h2>Edit</h2>
    <div className="field"><label htmlFor="e-title">What is it?</label><input id="e-title" value={edit.title} maxLength={120} onChange={e=>setEdit(x=>({...x,title:e.target.value}))}/></div>
    <div className="pair-row"><div className="field"><label htmlFor="e-date">Date</label><input id="e-date" type="date" value={edit.dueAt} onChange={e=>setEdit(x=>({...x,dueAt:e.target.value}))}/></div><div className="field"><label htmlFor="e-time">Time</label><input id="e-time" type="time" value={edit.dueTime} onChange={e=>setEdit(x=>({...x,dueTime:e.target.value}))}/></div></div>
    <div className="field"><label htmlFor="e-who">Who it&rsquo;s for</label><input id="e-who" value={edit.forPerson} maxLength={80} onChange={e=>setEdit(x=>({...x,forPerson:e.target.value}))}/></div>
    <div className="field"><label htmlFor="e-where">Where</label><input id="e-where" value={edit.location} maxLength={160} onChange={e=>setEdit(x=>({...x,location:e.target.value}))}/></div>
    {(task.kind==='shopping'||items.length>0)&&!hasSteps&&<div className="field"><label htmlFor="e-list">The list</label><textarea id="e-list" value={edit.list} style={{minHeight:130}} onChange={e=>setEdit(x=>({...x,list:e.target.value}))}/><span className="hint">One item per line. Put a number first for how many, like &ldquo;2 bags potting mix&rdquo;. Add a price for one after the name if you know it, like &ldquo;drill bits $25&rdquo;.</span></div>}
    <div className="field"><span className="label-like" id="e-matters">How much does this matter?</span><div className="chips" role="group" aria-labelledby="e-matters" style={{marginTop:6}}>{trafficLight.map(l=><Chip key={l.label} label={`${l.dot} ${l.label}`} selected={edit.importance===l.key} onToggle={()=>setEdit(x=>({...x,importance:l.key}))}/>)}</div></div>
    <div className="field"><label htmlFor="e-notes">Notes</label><textarea id="e-notes" value={edit.notes} maxLength={1000} style={{minHeight:80}} onChange={e=>setEdit(x=>({...x,notes:e.target.value}))}/></div>
    <div className="btn-stack"><Button variant="coral" disabled={busy||!edit.title.trim()} onClick={saveEdit}>Save</Button><Button variant="quiet" onClick={()=>setShowEdit(false)}>Cancel</Button></div>
   </Sheet>}
   {showSplit&&<Sheet onClose={()=>setShowSplit(false)} label="Split into purchases">
    <h2>Split into purchases</h2>
    <p className="muted" style={{marginTop:8}}>{cost!==null?`The list comes to about ${formatAUD(cost)}. `:''}Each purchase becomes its own task with its own items, date and reminder. Bear shares the items out so they cost about the same, and spaces them out{task.dueAt?` before ${formatAU(task.dueAt)}`:' over the next few weeks'}.</p>
    <div className="chips" style={{marginTop:14}}>{[2,3,4,5,6].filter(n=>n<=openItems.length).map(n=><button key={n} type="button" className="chip" disabled={busy} onClick={()=>split(n)}>{n} tasks</button>)}</div>
    <div className="btn-stack"><Button variant="quiet" onClick={()=>setShowSplit(false)}>Keep it as one</Button></div>
   </Sheet>}
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
