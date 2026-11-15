'use client';
import {useEffect,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {CalendarButton,CardEditor,type CardChange} from './card-controls';
import {apiGet,apiSend,type ApiError} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';

// The action cards from triage: what Bear found, what it already prepared, and one tap to use each draft. Bear never sends:
// every button opens the person's own email, messages or calendar with the draft filled in.
export interface Payload{email:{to:string|null;subject:string;body:string}|null;sms:{to:string|null;body:string}|null;calendar_hold:{title:string;start:string;end:string|null;all_day:boolean;location:string|null}|null;shopping_list:string[]|null;steps:string[]|null}
export interface TriageCardView{linkedFrom?:string|null;card_id:string;family_member:string|null;action_type:string;urgency:'red'|'amber'|'green';hard_deadline:string|null;card_headline:string;ai_work_completed:string;execution_payload:Payload;confidence_score:number;missing_blocker:string|null;taskId:string|null;area:string;when:string;already:boolean}
export interface TriageView{reasoning:string;summary:string;cards:TriageCardView[]}
const areaLabel:Record<string,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
const groups=[{light:'red',dot:'🔴',label:'Urgent'},{light:'amber',dot:'🟠',label:'Coming up'},{light:'green',dot:'🟢',label:'Can wait'}] as const;

// Debug view (the model's reasoning) is for the owner: on with ?debug=1, off with ?debug=0, remembered on this device.
const DEBUG_KEY='bear-debug';
const debugOn=()=>{try{return localStorage.getItem(DEBUG_KEY)==='1';}catch{return false;}};
const subscribe=(cb:()=>void)=>{window.addEventListener('storage',cb);return()=>window.removeEventListener('storage',cb);};
export function useDebug(){
 useEffect(()=>{try{const q=new URLSearchParams(location.search).get('debug');if(q==='1'||q==='0'){localStorage.setItem(DEBUG_KEY,q);window.dispatchEvent(new StorageEvent('storage'));}}catch{/* no storage */}},[]);
 return useSyncExternalStore(subscribe,debugOn,()=>false);
}

// The steps shown while Bear reads. They move on a timer (the reading is one request), so they show progress, not a promise.
const STEPS=['Reading layout & dates…','Matching family profile…','Drafting 90% done cards…'];
export function TriageProgress(){
 const [step,setStep]=useState(0);
 useEffect(()=>{const a=setTimeout(()=>setStep(1),5000),b=setTimeout(()=>setStep(2),12000);return()=>{clearTimeout(a);clearTimeout(b);};},[]);
 return <ol className="qc-reply qc-progress" aria-live="polite">{STEPS.map((s,i)=><li key={s} className={i<step?'done':i===step?'now':''}><span aria-hidden="true">{i<step?'✓':i===step?'•':'○'}</span> {s}</li>)}</ol>;
}

const mailto=(e:NonNullable<Payload['email']>)=>`mailto:${encodeURIComponent(e.to||'')}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;
const smsHref=(s:NonNullable<Payload['sms']>)=>`sms:${encodeURIComponent(s.to||'')}${/iPhone|iPad/.test(typeof navigator!=='undefined'?navigator.userAgent:'')?'&':'?'}body=${encodeURIComponent(s.body)}`;
async function copy(text:string){try{await navigator.clipboard.writeText(text);return true;}catch{return false;}}

// A card shows only what is needed to act: the title, where it belongs, when, and (if Bear drafted anything) one row of chips.
// Each chip opens its draft; the calendar chip downloads straight away.
function Card({c,reasoning,debug,editing,onChange}:{c:TriageCardView&{removed?:boolean};reasoning:string;debug:boolean;editing:boolean;onChange:(x:CardChange)=>void}){
 const p=c.execution_payload;const [copied,setCopied]=useState<string|null>(null);const [open,setOpen]=useState<'email'|'sms'|'list'|'steps'|null>(null);
 const did=async(what:string,text:string)=>{if(await copy(text)){setCopied(what);setTimeout(()=>setCopied(null),1800);}};
 if(c.removed)return <li className="qc-card tc-card"><span className="qc-removed">{c.card_headline}</span> <span className="qc-next">Removed</span></li>;
 const toggle=(k:NonNullable<typeof open>)=>setOpen(o=>o===k?null:k);
 const chips=[p.email&&{k:'email' as const,label:'Email draft'},p.sms&&{k:'sms' as const,label:'Text draft'},p.shopping_list?.length&&{k:'list' as const,label:`List (${p.shopping_list.length})`},p.steps?.length&&{k:'steps' as const,label:'Steps'}].filter(Boolean) as {k:NonNullable<typeof open>;label:string}[];
 return <li className="qc-card tc-card">
  {c.taskId?<Link className="qc-title" href={`/bear/tasks/${c.taskId}`}>{c.card_headline}</Link>:<span className="qc-title">{c.card_headline}</span>}
  <span className="qc-meta"><span className="qc-area">{areaLabel[c.area]||c.area}</span>{c.family_member?` · ${c.family_member}`:''} · {c.when}{c.linkedFrom?` · Added “${c.linkedFrom}” to this`:c.already?' · Already on my list':''}</span>
  {(chips.length>0||p.calendar_hold||c.hard_deadline)&&<span className="tc-actions">
   {chips.map(x=><button key={x.k} type="button" className="chip sm" aria-expanded={open===x.k} onClick={()=>toggle(x.k)}>{x.label}</button>)}
   <CalendarButton title={c.card_headline} deadline={c.hard_deadline} hold={p.calendar_hold}/>
  </span>}
  {open==='email'&&p.email&&<div className="tc-draft">{p.email.to&&<p className="qc-next">To {p.email.to}</p>}<p className="tc-subject">{p.email.subject}</p><p className="tc-body">{p.email.body}</p>
   <span className="tc-actions"><a className="chip sm" href={mailto(p.email)}>Open in email</a><button type="button" className="chip sm" onClick={()=>did('email',`${p.email!.subject}\n\n${p.email!.body}`)}>{copied==='email'?'Copied':'Copy'}</button></span></div>}
  {open==='sms'&&p.sms&&<div className="tc-draft">{p.sms.to&&<p className="qc-next">To {p.sms.to}</p>}<p className="tc-body">{p.sms.body}</p>
   <span className="tc-actions"><a className="chip sm" href={smsHref(p.sms)}>Open in Messages</a><button type="button" className="chip sm" onClick={()=>did('sms',p.sms!.body)}>{copied==='sms'?'Copied':'Copy'}</button></span></div>}
  {open==='list'&&p.shopping_list?.length?<div className="tc-draft"><ul className="tc-list">{p.shopping_list.map((s,i)=><li key={i}>{s}</li>)}</ul>
   <span className="tc-actions"><button type="button" className="chip sm" onClick={()=>did('list',p.shopping_list!.join('\n'))}>{copied==='list'?'Copied':'Copy list'}</button></span></div>:null}
  {open==='steps'&&p.steps?.length?<div className="tc-draft"><ol className="tc-list">{p.steps.map((s,i)=><li key={i}>{s}</li>)}</ol></div>:null}
  {editing&&c.taskId&&<CardEditor taskId={c.taskId} title={c.card_headline} deadline={c.hard_deadline} light={c.urgency} area={c.area} onChange={onChange}/>}
  {debug&&<details className="tc-debug"><summary>AI Reasoning</summary><pre>{reasoning||'The service did not return a summary of its thinking for this one.'}</pre><p className="tc-meta-debug">{c.action_type} · urgency {c.urgency} · confidence {Math.round(c.confidence_score*100)}%{c.hard_deadline?` · deadline ${c.hard_deadline}`:''}{c.ai_work_completed?` · ${c.ai_work_completed}`:''}</p></details>}
 </li>;
}

// Bear's questions, one at a time, with somewhere to answer. A question about when gets a date picker and sets the due date;
// any other answer is kept in the task's notes. Skipping is fine.
const isWhen=(q:string)=>/\b(when|what date|which date|what day|due|by when|deadline)\b/i.test(q);
function Question({card,onDone}:{card:TriageCardView;onDone:(change:CardChange|null)=>void}){
 const q=card.missing_blocker||'';const when=isWhen(q);const [v,setV]=useState('');const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 async function save(){
  if(!v.trim()||!card.taskId)return;setBusy(true);setErr(null);
  try{
   if(when){await apiSend(`/api/bear/tasks/${card.taskId}`,{dueAt:v},'PATCH');onDone({deadline:v,when:`Due ${formatAU(v,'short')}`});}
   else{const r=await apiGet<{task:{notes?:string|null}}>(`/api/bear/tasks/${card.taskId}`);const notes=[r.task?.notes||'',`${q} ${v.trim()}`].filter(Boolean).join('\n').slice(0,1000);await apiSend(`/api/bear/tasks/${card.taskId}`,{notes},'PATCH');onDone(null);}
  }catch(e){setErr((e as ApiError).message||'That didn’t save. Try again.');}finally{setBusy(false);}
 }
 return <form className="tc-question" onSubmit={e=>{e.preventDefault();void save();}}>
  <label htmlFor={`tq-${card.card_id}`}><span className="tc-q">{q}</span><span className="qc-next"> · {card.card_headline}</span></label>
  <span className="tc-qrow">{when?<input id={`tq-${card.card_id}`} type="date" value={v} onChange={e=>setV(e.target.value)}/>:<input id={`tq-${card.card_id}`} value={v} onChange={e=>setV(e.target.value)} placeholder="Your answer" maxLength={200} autoComplete="off"/>}
   <button type="submit" className="btn coral sm" disabled={busy||!v.trim()}>Save</button><button type="button" className="qc-link" onClick={()=>onDone(null)}>Skip</button></span>
  {err&&<span className="tc-blocker" role="alert">{err}</span>}
 </form>;
}

export function TriageCards({t,onApproved}:{t:TriageView;onApproved?:()=>void}){
 const debug=useDebug();
 const [cards,setCards]=useState<(TriageCardView&{removed?:boolean;asked?:boolean})[]>(t.cards);const [editing,setEditing]=useState(false);const [confirmed,setConfirmed]=useState(false);
 const change=(id:string,x:CardChange)=>setCards(l=>l.map(c=>c.card_id!==id?c:{...c,...(x.title?{card_headline:x.title}:{}),...(x.deadline!==undefined?{hard_deadline:x.deadline}:{}),...(x.when?{when:x.when}:{}),...(x.light?{urgency:x.light}:{}),...(x.area?{area:x.area}:{}),...(x.removed?{removed:true}:{})}));
 const placed=cards.filter(c=>c.taskId&&!c.removed);
 const next=cards.find(c=>c.missing_blocker&&c.taskId&&!c.removed&&!c.asked);
 const drafted=cards.some(c=>{const p=c.execution_payload;return !!(p.email||p.sms);});
 return <div className="qc-reply qc-sorted tc">
  <p className="qc-head">{t.cards.length?(t.cards.length===1?'I’ve sorted this for you.':`I found ${t.cards.length} things.`):'I read it. Nothing in it needs you.'}</p>
  {groups.map(g=>{const list=cards.filter(c=>c.urgency===g.light);if(!list.length)return null;
   return <section key={g.light} className={`qc-group ${g.light}`} aria-label={g.label}><p className="qc-group-head"><span aria-hidden="true">{g.dot}</span> {g.label}</p>
    <ul>{list.map(c=><Card key={c.card_id} c={c} reasoning={t.reasoning} debug={debug} editing={editing} onChange={x=>change(c.card_id,x)}/>)}</ul></section>;})}
  {debug&&!t.cards.length&&<details className="tc-debug"><summary>AI Reasoning</summary><pre>{t.reasoning||'The service did not return a summary of its thinking for this one.'}</pre></details>}
  {next&&!editing&&<Question key={next.card_id} card={next} onDone={x=>{if(x)change(next.card_id,x);setCards(l=>l.map(c=>c.card_id===next.card_id?{...c,asked:true}:c));}}/>}
  {drafted&&<p className="qc-next">Drafts are ready. Nothing’s been sent.</p>}
  {placed.length>0&&!confirmed&&!next&&<div className="btn-row tc-confirm">
   <button type="button" className="btn coral sm" onClick={()=>{setConfirmed(true);setEditing(false);onApproved?.();}}>{editing?'Done':'Looks good'}</button>
   {!editing&&<button type="button" className="btn quiet sm" onClick={()=>setEditing(true)}>Change something</button>}
  </div>}
  {confirmed&&<p className="qc-note" role="status">On it. I’ll remind you when each one needs you.</p>}
 </div>;
}
