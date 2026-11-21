'use client';
// One responsibility: what needs to be true, by when, how Bear plans to get there, what's happened, and what's next.
import {use,useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {mailtoFor,smsFor} from '@/lib/bear/board/help';
import type {BearList} from '@/lib/bear/board/logic';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';
import {DelegationPanel,ShareBearSheet,useShareBear} from '@/components/bear/share-bear';

type Detail=Awaited<ReturnType<typeof import('@/lib/bear/rre/service').detailView>>;
// What her button says for each kind of step.
const doneLabel:Record<string,string>={order:'I’ve ordered it',buy:'I’ve bought it',ask:'I’ve sent it',send:'I’ve sent it',call:'Done, I’ve called',book:'Booked',pay:'Paid',check:'Done',review:'I’ve picked some',wrap:'Wrapped',first:'Done for now',do:'Done',arrived:'It’s arrived',got:'Got it',booked:'Booked',done:'Done',buyGifts:'Bought them'};
const fmt=(d:string|null)=>d?`${formatAU(d,'weekday')} ${formatAU(d,'short')}`:null;
export default function ResponsibilityPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);
 const [d,setD]=useState<Detail|null>(null);const [lists,setLists]=useState<BearList[]>([]);const [err,setErr]=useState<string|null>(null);const [busy,setBusy]=useState<string|null>(null);const [saved,setSaved]=useState<string|null>(null);
 const load=useCallback(()=>Promise.all([apiGet<Detail>(`/api/bear/rre/${id}`),apiGet<{lists:BearList[]}>('/api/bear/board/lists')]).then(([x,l])=>{setD(x);setLists(l.lists);setErr(null);}).catch(e=>setErr((e as Error).message)),[id]);
 useEffect(()=>{load();},[load]);
 const sb=useShareBear();const [asking,setAsking]=useState<{preset:{name:string;phone:string}|null}|null>(null);
 // When Share Bear news has just updated this task (an answer, a "done"), show the task as it is now.
 const sbStatus=sb.state?.requests.find(r=>r.taskId===id)?.status;useEffect(()=>{if(sbStatus&&d?.delegation&&d.delegation.status!==sbStatus)load();},[sbStatus]);// eslint-disable-line react-hooks/exhaustive-deps
 async function act(key:string,path:string,body:unknown,after?:string){setBusy(key);setErr(null);try{setD(await apiSend<Detail>(path,body));if(after)setSaved(after);}catch(e){setErr((e as Error).message);}finally{setBusy(null);}}
 async function classify(listId:string){setBusy('cat');try{await apiSend(`/api/bear/board/tasks/${id}/move`,{listId});await load();setSaved('Category changed. Bear will remember where you put things like this.');}catch(e){setErr((e as Error).message);}finally{setBusy(null);}}
 if(err&&!d)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/brain',label:'Bear Brain'}}/><ErrorCard message={err} retry={load}/></main>;
 if(!d)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const cur=d.current;const done=d.taskStatus==='done'||d.status==='completed';
 // Share Bear: the request this task is linked to (if any), and whether someone is helping with it right now.
 const req=d.delegation?sb.state?.requests.find(r=>r.id===d.delegation!.id)||null:null;
 const helping=!!req&&['PENDING_SEND','SENT','ACCEPTED'].includes(req.status);
 const refresh=()=>{load();sb.reload();};
 return <main id="main" className="bear-screen v2-screen">
  <TopBar back={{href:'/bear/brain',label:'Bear Brain'}}/>
  <p className={`v2-status s-${d.status}`}>{d.statusLabel}</p>
  <h1 className="v2-detail-title">{d.title}</h1>
  {!done&&!helping&&<p className="sb-entry-row"><button type="button" className="sb-entry" onClick={()=>setAsking({preset:null})}><span aria-hidden="true">🐻</span> Share Bear</button></p>}
  {saved&&<p className="note teal" role="status" style={{marginTop:10}}>{saved}</p>}
  {req&&<DelegationPanel r={req} onChanged={refresh} askAgain={preset=>setAsking({preset})}/>}
  {asking&&<ShareBearSheet task={{id:d.id,title:d.title,due:d.dueAt||d.deadlines.outcome,dueTime:d.dueTime}} state={sb.state} preset={asking.preset} onClose={()=>setAsking(null)} onDone={refresh}/>}
  {err&&<p className="note coral" role="alert" style={{marginTop:10}}>{err}</p>}

  <section className="v2-card v2-sec"><h2 className="v2-h3">What needs to happen</h2><p>{d.outcome}</p>{d.original&&d.original!==d.title&&<p className="tiny muted" style={{marginTop:4}}>You said: “{d.original}”</p>}</section>

  {/* Someone has said yes: she isn't asked to do the next step; Bear watches and tells her if anything changes. */}
  {!done&&req?.status==='ACCEPTED'&&<p className="note" style={{marginTop:14}}>{req.to} is handling this. Bear will remind them on the day and tell you if anything changes.</p>}
  {!done&&req?.status!=='ACCEPTED'&&<section className="v2-card v2-sec v2-next" aria-labelledby="next-h"><h2 id="next-h" className="v2-h3">Next</h2>
   {cur?.who==='bear'&&<><p>{d.next?`${d.next.text} (about ${d.next.minutes} min of your time)`:cur.text}</p><p className="tiny muted">Bear does its part first: {cur.text.toLowerCase()}.</p>
    <button type="button" className="btn coral wide" disabled={!!busy} onClick={()=>act('give',`/api/bear/rre/${id}/give`,{},'Bear has prepared this for you to check.')}>{busy==='give'?'One moment…':'Give it to Bear'}</button></>}
   {cur&&cur.who==='you'&&cur.kind!=='wait'&&<><p><strong>{cur.text}</strong>{cur.userMinutes>1?` · about ${cur.userMinutes} min`:''}</p>
    <button type="button" className="btn coral wide" disabled={!!busy} onClick={()=>act('done',`/api/bear/rre/${id}/step`,{action:'done'})}>{busy==='done'?'Saving…':doneLabel[cur.id]||'Done'}</button></>}
   {cur?.kind==='wait'&&<><p>{cur.text}{d.dependencies.find(x=>x.status==='open')?.expectedBy?`: expected by ${fmt(d.dependencies.find(x=>x.status==='open')!.expectedBy)}. Bear will check back then.`:''}</p>
    <div className="btn-row">{d.dependencies.some(x=>x.kind==='delivery')?<><button type="button" className="btn coral sm" disabled={!!busy} onClick={()=>act('arr',`/api/bear/rre/${id}/step`,{action:'arrived'})}>It’s arrived</button><button type="button" className="btn ghost sm" disabled={!!busy} onClick={()=>act('no',`/api/bear/rre/${id}/step`,{action:'not_arrived'},'Bear has moved to another way to get it.')}>It hasn’t come</button></>
     :<button type="button" className="btn coral sm" disabled={!!busy} onClick={()=>act('rep',`/api/bear/rre/${id}/step`,{action:'replied'})}>They’ve replied</button>}</div></>}
  </section>}
  {done&&<p className="note teal" style={{marginTop:14}}>Done. {d.outcome}.</p>}

  {d.prepared&&<section className="v2-card v2-sec"><h2 className="v2-h3">What Bear has done</h2><p><strong>{d.prepared.title}</strong></p>
   {d.prepared.lines.length>0&&<ul className="v2-lines">{d.prepared.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>}
   {d.prepared.draft&&<div className="v2-draft"><p className="small" style={{whiteSpace:'pre-wrap'}}>{d.prepared.draft.body}</p><div className="btn-row">{d.prepared.draft.subject?<a className="btn ghost sm" href={mailtoFor(d.prepared.draft)}>Open in Mail</a>:<a className="btn ghost sm" href={smsFor(d.prepared.draft)}>Open in Messages</a>}<Link className="btn ghost sm" href={`/bear/help/${id}`}>Edit it</Link></div></div>}
   {d.prepared.links.map(l=><a key={l.url} className="btn ghost sm" style={{marginTop:8,marginRight:8}} href={l.url} target={l.url.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{l.label}</a>)}
   <p className="tiny muted" style={{marginTop:8}}>{d.prepared.note}</p>
  </section>}

  <section className="v2-card v2-sec"><h2 className="v2-h3">The plan: {d.pathway.label.toLowerCase()}</h2><p className="small muted">{d.pathway.description} About {d.pathway.minutes[0]===d.pathway.minutes[1]?d.pathway.minutes[0]:`${d.pathway.minutes[0]}–${d.pathway.minutes[1]}`} min of your time.{d.pathway.chosenBy==='you'?' You chose this.':''}</p>
   {d.pathway.why&&<p className="small" style={{color:'var(--coral)',marginTop:6}}>{d.pathway.why}</p>}
   <ol className="v2-steps">{d.steps.map(s=><li key={s.id} className={`st-${s.state}`}><span>{s.who==='bear'?'Bear: ':''}{s.text}</span></li>)}</ol>
   <p className="tiny muted">{d.pathway.evidence.map(e=>e.note).join(' ')}</p>
  </section>

  {(d.deadlines.outcome||d.deadlines.opportunity||d.deadlines.followUp)&&<section className="v2-card v2-sec"><h2 className="v2-h3">Dates</h2><ul className="v2-lines">
   {d.deadlines.outcome&&<li>Needed by {fmt(d.deadlines.outcome)}{d.deadlineSource==='known_date'?' (Christmas; change it if you celebrate earlier)':''}</li>}
   {d.deadlines.opportunity&&d.pathway.id==='online'&&<li>Order by about {fmt(d.deadlines.opportunity)} for delivery in time (an estimate)</li>}
   {d.deadlines.followUp&&<li>Bear checks back {fmt(d.deadlines.followUp)}</li>}
  </ul></section>}

  {d.dependencies.length>0&&<section className="v2-card v2-sec"><h2 className="v2-h3">Waiting on</h2><ul className="v2-lines">{d.dependencies.map(x=><li key={x.id}>{x.what}{x.expectedBy?` · expected ${fmt(x.expectedBy)}`:''} · {x.status==='met'?'done':'open'}</li>)}</ul></section>}

  {!done&&d.alternatives.length>0&&<section className="v2-card v2-sec"><h2 className="v2-h3">Other ways</h2><ul className="v2-alts">{d.alternatives.map(a=><li key={a.id}>
   <div><strong>{a.label}</strong><span className="small muted"> · about {a.minutes[0]}–{a.minutes[1]} min</span><p className="small muted">{a.feasibility==='infeasible'?a.why:a.description}</p></div>
   {a.feasibility!=='infeasible'&&<button type="button" className="btn ghost sm" disabled={!!busy} onClick={()=>act('sw'+a.id,`/api/bear/rre/${id}/step`,{action:'switch',pathway:a.id,explicit:true},`Done: Bear will ${a.label.toLowerCase()} instead${['online','shop'].includes(a.id)?', and remember you prefer this':''}.`)}>{a.id==='shop'?'I’d rather buy it in person':a.id==='online'?'I’d rather order it online':'Do it this way'}</button>}
  </li>)}</ul></section>}

  <section className="v2-card v2-sec"><h2 className="v2-h3">Category</h2>
   <label className="ce-field">{d.category?.by==='bear'?'Bear filed this here. Change it if it belongs somewhere else.':'You put this here.'}
    <select value={d.category?.id||''} disabled={busy==='cat'} onChange={e=>classify(e.target.value)}>{lists.map(l=><option key={l.id} value={l.id}>{l.icon} {l.title}</option>)}</select></label>
  </section>

  {d.log.length>0&&<details className="v2-card v2-sec"><summary className="v2-h3">History</summary><ul className="v2-lines">{[...d.log].reverse().map((l,i)=><li key={i} className="small">{new Date(l.at).toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}: {l.text}</li>)}</ul></details>}
  <p className="small" style={{marginTop:16}}><Link href={`/bear/help/${id}`} className="link-btn">Notes and drafts</Link> · <Link href={`/bear/tasks/${id}`} className="link-btn">More details</Link></p>
 </main>;
}
