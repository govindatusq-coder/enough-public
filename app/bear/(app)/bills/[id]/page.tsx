'use client';
import {use,useCallback,useEffect,useState} from 'react';
import type {LoadView} from '@/lib/bear/load/view';
import {LoadPanel} from '@/components/bear/load-panel';
import {useRouter,useSearchParams} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAUD} from '@/lib/bear/domain/money';
import {formatAU,formatWhen,relativeDay,todayISO} from '@/lib/bear/domain/dates';
import type {Bill,RecurringExpectation,Reminder,Task} from '@/lib/bear/domain/types';
import type {PlanRecommendation} from '@/lib/bear/services/reminder-planning';
import type {AssistOption} from '@/lib/bear/services/assistance';
import {categoryLabels} from '@/lib/bear/domain/labels';
import {RoundBadge} from '@/components/bear/art';
import {BearSays} from '@/components/bear/brand';
import {Button,ErrorCard,OverdueAlert,Sheet,Skeleton,Toast,TopBar} from '@/components/bear/ui';
import {overdueDays,overdueLabel} from '@/lib/bear/domain/overdue';

type Loaded={bill:Bill;task:Task;reminders:Reminder[];steps:Task[];plan:PlanRecommendation|null;assistance:{options:AssistOption[];explanation:string;contactDraft:string|null;increase:{previousCents:number;deltaCents:number}|null};expectation:RecurringExpectation|null;documentUrl:string|null;load?:LoadView|null};
export default function BillPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const router=useRouter();const search=useSearchParams();
 const [data,setData]=useState<Loaded|null>(null);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [busy,setBusy]=useState(false);
 const [custom,setCustom]=useState('');const [followUp,setFollowUp]=useState(true);const [showPlan,setShowPlan]=useState(search.get('plan')==='1');const [showPaid,setShowPaid]=useState(false);const [expectNext,setExpectNext]=useState<boolean|null>(null);const [saved,setSaved]=useState('');const [savedWhy,setSavedWhy]=useState('early_discount_used');const [showExplain,setShowExplain]=useState(false);const [showDraft,setShowDraft]=useState(false);
 const reminderId=search.get('reminder');
 const load=useCallback(()=>apiGet<Loaded>(`/api/bear/bills/${id}`).then(d=>{setData(d);setError(null);if(d.plan)setShowPlan(true);}).catch(e=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);}),[id,router]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'opened'}).catch(()=>{});},[reminderId]);
 if(error&&!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><ErrorCard message={error} retry={load}/></main>;
 if(!data)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home'}}/><Skeleton/></main>;
 const {bill,task,reminders,steps,plan,assistance}=data;const today=todayISO();const paid=bill.status==='paid';const dropped=bill.status==='dropped';
 const active=reminders.filter(r=>['scheduled','snoozed'].includes(r.status));
 async function acceptPlan(key:string,when:string|null,label:string,rationale:string){if(!when){setToast('Pick a time first.');return;}setBusy(true);
  try{await apiSend(`/api/bear/bills/${id}/plan`,{when:new Date(when).toISOString(),label,rationale,key,followUpIfUnpaid:followUp});setShowPlan(false);setToast("Bear's got it. You can stop thinking about this one.");await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function markPaid(){setBusy(true);try{const res=await apiSend<{ledger:unknown[];win:{id:string;detail:string}}>(`/api/bear/tasks/${task.id}/complete`,{method:null,expectNext});const cents=Math.round(Number(saved.replace(/[^0-9.]/g,''))*100);let detail=res.win.detail;if(Number.isFinite(cents)&&cents>0){const r=await apiSend<{win:{detail:string}}>(`/api/bear/wins/${res.win.id}/saving`,{cents,reason:savedWhy});detail=r.win.detail;}if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'helped'}).catch(()=>{});setShowPaid(false);router.replace(`/bear/wins?just=${encodeURIComponent(detail)}`);}catch(e){setError((e as Error).message);setBusy(false);}}
 async function deleteBill(){if(!confirm(paid?'Delete this? It will also come out of My Wins.':'Delete this bill for good? Its reminders go with it.'))return;setBusy(true);try{await apiSend(`/api/bear/tasks/${task.id}`,{},'DELETE');router.replace('/bear/home');}catch(e){setError((e as Error).message);setBusy(false);}}
 async function reopenBill(){setBusy(true);try{await apiSend(`/api/bear/tasks/${task.id}/reopen`,{});setToast('Back on your list.');await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function drop(){if(!confirm('Tell Bear this bill is not important anymore? Reminders will stop.'))return;setBusy(true);try{await apiSend(`/api/bear/tasks/${task.id}/drop`,{});router.replace('/bear/home');}catch(e){setError((e as Error).message);setBusy(false);}}
 async function runAssist(o:AssistOption){if(reminderId)apiSend('/api/bear/reminders/interact',{reminderId,action:'helped'}).catch(()=>{});if(o.copy){try{await navigator.clipboard.writeText(o.copy);setToast('Copied.');}catch{setToast(o.copy);}}if(o.href)window.open(o.href,'_blank','noopener');if(o.key==='direct_debit')setToast(o.detail||'');}
 const recurring=bill.fields.isRecurring.value===true&&bill.fields.expectedRecurrence.value&&bill.fields.expectedRecurrence.value!=='unknown'&&!bill.recurringExpectationId;
 return (
  <main id="main" className="bear-screen">
   <TopBar back={{href:'/bear/home'}} right={bill.isDemo?<span className="demo-tag">Example data</span>:null}/>
   <div className="card">
    <p className="eyebrow">{categoryLabels[bill.category]}{bill.category!=='other'?' bill':''}{paid&&<span className="pill teal" style={{marginLeft:8}}>Paid</span>}{dropped&&<span className="pill" style={{marginLeft:8}}>Let go</span>}</p>
    <h2>{bill.biller}</h2>
    <div className="amount" style={{marginTop:10}}>{formatAUD(bill.amountCents)}</div>
    <p className="muted" style={{marginTop:6}}>{bill.dueAt?`Due ${formatAU(bill.dueAt)}${/^(today|tomorrow|yesterday|[A-Z])/.test(relativeDay(bill.dueAt,today))?' · '+relativeDay(bill.dueAt,today):''}`:'No due date'}</p>
    {task.forPerson&&<span className="pill" style={{marginTop:10}}>For {task.forPerson}</span>}
   </div>
   {data.load&&!dropped&&<LoadPanel taskId={task.id} view={data.load} readOnly hideComingUp onChanged={()=>load()}/>}
   {!paid&&!dropped&&overdueDays(bill.dueAt,today)>0&&<div style={{marginTop:14}}><OverdueAlert title={`This bill is overdue. ${overdueLabel(overdueDays(bill.dueAt,today))}.`}><p className="small muted">It was due {formatAU(bill.dueAt!)}. It isn&rsquo;t too late: pay it now, or ask the biller about more time or a late fee. Bear can help with either.</p></OverdueAlert></div>}
   {!paid&&!dropped&&<>
    {active.length>0&&!showPlan&&<div className="glass" style={{padding:16}}>
     <p className="eyebrow teal">Bear&rsquo;s handling it</p>
     <p><strong>Bringing it back {formatWhen(active[0].scheduledFor)}</strong></p><p className="small muted" style={{marginTop:4}}>{active[0].plan.rationale}</p>
     {active.length>1&&<p className="faint" style={{marginTop:6}}>Then again {formatWhen(active[1].scheduledFor)} if it isn&rsquo;t paid.</p>}
     <button type="button" className="btn quiet sm" style={{marginTop:8}} onClick={()=>setShowPlan(true)}>Change the plan</button>
    </div>}
    <div className="section">
     <p className="eyebrow coral">Sort it with Bear</p>
     <div className="glass-strong" style={{padding:'6px 16px'}}>
      {assistance.options.map(o=><button key={o.key} type="button" className="row" style={{width:'100%',textAlign:'left'}} onClick={()=>runAssist(o)}><span className="grow"><span className="title">{o.label}</span>{o.detail&&<><br/><span className="faint">{o.detail}</span></>}</span><span className="faint">{o.href?'Open':o.copy?'Copy':''}</span></button>)}
      <button type="button" className="row" style={{width:'100%',textAlign:'left'}} onClick={()=>setShowExplain(s=>!s)} aria-expanded={showExplain}><span className="grow"><span className="title">Explain this bill</span></span><span className="faint">{showExplain?'Hide':'Show'}</span></button>
      {showExplain&&<p className="small muted" style={{padding:'0 0 14px'}}>{assistance.explanation}</p>}
      {assistance.contactDraft&&<><button type="button" className="row" style={{width:'100%',textAlign:'left'}} onClick={()=>setShowDraft(s=>!s)} aria-expanded={showDraft}><span className="grow"><span className="title">Check why it increased</span><br/><span className="faint">Up {formatAUD(assistance.increase!.deltaCents)} on last time · draft a question</span></span></button>
       {showDraft&&<div style={{paddingBottom:14}}><textarea readOnly className="field" style={{width:'100%',minHeight:150,padding:12,borderRadius:14,border:'1px solid var(--line)',fontSize:14}} value={assistance.contactDraft} aria-label="Draft message to the provider"/><Button variant="ghost" className="sm" style={{marginTop:8}} onClick={async()=>{try{await navigator.clipboard.writeText(assistance.contactDraft!);setToast('Draft copied.');}catch{setToast('Select the text to copy it.');}}}>Copy draft</Button></div>}</>}
     </div>
     <p className="faint" style={{marginTop:10}}>Bear sets things up. You make the payment, then tell Bear it&rsquo;s done.</p>
    </div>
    {steps.filter(s=>s.status==='open').length>0&&<div className="section"><p className="eyebrow">Worth doing first</p><div className="card">{steps.filter(s=>s.status==='open').map(s=><div key={s.id} className="row"><span className="icon-dot mustard" aria-hidden="true">·</span><span className="grow"><span className="title">{s.title}</span>{s.dueAt&&<><br/><span className="faint">By {formatAU(s.dueAt,'short')}</span></>}</span></div>)}</div></div>}
    <div className="btn-stack" style={{marginTop:24}}><Button variant="coral" onClick={()=>setShowPaid(true)}>I&rsquo;ve paid it</Button><Button variant="quiet" onClick={drop} disabled={busy}>Not important anymore</Button></div>
   </>}
   {paid&&<div className="glass" style={{padding:18,textAlign:'center'}}><RoundBadge size={120}/><BearSays>That&rsquo;s sorted.</BearSays><p className="muted small" style={{marginTop:6}}>Paid {bill.paidAt?formatAU(bill.paidAt.slice(0,10)):''}.</p>{data.expectation&&<p className="faint" style={{marginTop:6}}>Bear expects the next one around {formatAU(data.expectation.expectedFrom,'short')}–{formatAU(data.expectation.expectedTo,'short')}.</p>}<div className="btn-stack"><Button href="/bear/wins" variant="ghost">See it in My Wins</Button><Button variant="quiet" disabled={busy} onClick={reopenBill}>Not actually paid</Button></div></div>}
   {data.documentUrl&&<p style={{marginTop:16}}><a className="pill" href={data.documentUrl} target="_blank" rel="noreferrer">Original bill</a></p>}
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {showPlan&&plan&&<Sheet onClose={()=>setShowPlan(false)} label="When should Bear bring this back?">
    <h2>When should I bring this back?</h2>
    <div className="glass" style={{padding:16,marginTop:14,background:'var(--teal-tint)'}}>
     <p className="eyebrow teal" style={{marginBottom:4}}>Bear suggests</p><p style={{fontWeight:700,fontSize:19}}>{plan.suggested.label}</p><p className="small muted" style={{marginTop:4}}>&ldquo;{plan.suggested.rationale}&rdquo;</p>
     <Button variant="primary" className="wide" style={{marginTop:12}} disabled={busy} onClick={()=>acceptPlan('bear',plan.suggested.when,plan.suggested.label,plan.suggested.rationale)}>Sounds good</Button>
    </div>
    <div className="chips" style={{marginTop:14}}>{plan.alternatives.filter(a=>a.key!=='custom').map(a=><button key={a.key} type="button" className="chip" disabled={busy} onClick={()=>acceptPlan(a.key,a.when,a.label,a.rationale)}>{a.label}</button>)}</div>
    <div className="field"><label htmlFor="custom-when">Choose a time</label><div style={{display:'flex',gap:8}}><input id="custom-when" type="datetime-local" value={custom} onChange={e=>setCustom(e.target.value)} min={new Date().toISOString().slice(0,16)}/><Button variant="ghost" disabled={!custom||busy} onClick={()=>acceptPlan('custom',custom,new Date(custom).toLocaleString('en-AU',{weekday:'long',hour:'numeric',minute:'2-digit'}),'You chose this time.')}>Set</Button></div></div>
    <label style={{display:'flex',gap:10,alignItems:'center',marginTop:16}}><input type="checkbox" checked={followUp} onChange={e=>setFollowUp(e.target.checked)} style={{width:22,height:22}}/> Remind me again if it isn&rsquo;t paid.</label>
    {plan.deadline&&<p className="faint" style={{marginTop:12}}>Due {formatAU(plan.deadline)}. Bear won&rsquo;t let the reminder land after that.</p>}
   </Sheet>}
   {showPaid&&<Sheet onClose={()=>setShowPaid(false)} label="Mark as paid">
    <h2>Paid? Lovely.</h2><p className="muted" style={{marginTop:6}}>Bear will close this one and keep the receipt in My Wins.</p>
    {recurring&&<div className="glass" style={{padding:14,marginTop:14}}><p style={{fontWeight:600}}>Looks like this happens every {(bill.fields.expectedRecurrence.value||'').replace('_',' ').replace(/ly$/,'').replace('month','month').replace('quarter','quarter')||'so often'}. Want me to expect the next one?</p><div className="btn-row"><Button className="sm" variant={expectNext===true?'primary':'ghost'} onClick={()=>setExpectNext(true)}>Yes please</Button><Button className="sm" variant={expectNext===false?'primary':'ghost'} onClick={()=>setExpectNext(false)}>No thanks</Button></div></div>}
    <div className="field" style={{marginTop:14}}><label htmlFor="saved">Did this save you money?</label><input id="saved" inputMode="decimal" placeholder="Amount saved, like 15.00" value={saved} onChange={e=>setSaved(e.target.value)}/>{saved.trim()&&<select id="saved-why" aria-label="How you saved" value={savedWhy} onChange={e=>setSavedWhy(e.target.value)} style={{marginTop:8}}><option value="early_discount_used">Paid early for a discount</option><option value="late_fee_avoided">Avoided a late fee</option><option value="discount_used">A discount or rebate</option><option value="better_price">A better price</option></select>}<span className="hint">Only if you know the amount. Bear never guesses, and it counts in My Wins as something you told it.</span></div>
    <div className="btn-stack"><Button variant="coral" disabled={busy} onClick={markPaid}>{busy?'One moment…':"Yep, it's paid"}</Button><Button variant="quiet" onClick={()=>setShowPaid(false)}>Not yet</Button></div>
   </Sheet>}
   {!bill.isDemo&&<div className="btn-stack" style={{marginTop:6}}><Button variant="quiet" disabled={busy} onClick={deleteBill}><span style={{color:'#B42318'}}>Delete this</span></Button></div>}
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
