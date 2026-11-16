'use client';
// Working on one thing, at her own pace. Everything typed here is saved as she goes, so if she's interrupted
// she can close the app and pick up exactly where she was.
import {use,useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {mailtoFor,smsFor,type Help} from '@/lib/bear/board/help';
import {ErrorCard,Skeleton,TopBar} from '@/components/bear/ui';

type Draft={to:string;subject:string;body:string};
type Progress={draft?:Draft|null;notes?:string|null;steps?:{text:string;done:boolean}[]|null;nextAction?:string|null;savedAt:string}|null;
interface Data{task:{id:string;title:string;status:string;dueAt:string|null;notes:string|null;minutes:number;minutesBy:string|null;readiness:string;sharedOut:{to:string;mode:string}|null;sharedIn:{from:string}|null};help:Help|null;progress:Progress;aiAvailable?:boolean}
export default function HelpPage({params}:{params:Promise<{id:string}>}){
 const {id}=use(params);const router=useRouter();
 const [d,setD]=useState<Data|null>(null);const [err,setErr]=useState<string|null>(null);
 const [draft,setDraft]=useState<Draft|null>(null);const [notes,setNotes]=useState('');const [steps,setSteps]=useState<{text:string;done:boolean}[]>([]);const [next,setNext]=useState('');
 const [ask,setAsk]=useState('');const [writing,setWriting]=useState(false);const [prevDraft,setPrevDraft]=useState<Draft|null|undefined>(undefined);const [timeOpen,setTimeOpen]=useState(false);
 const [saved,setSaved]=useState<'idle'|'saving'|'saved'|'offline'>('idle');const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const initial=useRef<string|null>(null);const key=`bear-work-${id}`;
 const load=useCallback(()=>apiGet<Data>(`/api/bear/board/help/${id}`).then(r=>{
  setD(r);const p=r.progress;let local:Partial<{draft:Draft;notes:string;steps:{text:string;done:boolean}[];next:string;at:string}>={};
  // If the last save didn't reach Bear (no signal), the copy kept on this phone is newer: use it.
  try{local=JSON.parse(localStorage.getItem(key)||'{}');}catch{/* no storage */}
  const newer=local.at&&(!p?.savedAt||local.at>p.savedAt);
  const v={draft:newer&&local.draft?local.draft:p?.draft||r.help?.draft||null,notes:newer&&local.notes!==undefined?local.notes:p?.notes||'',
   steps:newer&&local.steps?local.steps:p?.steps||(r.help?.steps||r.help?.points||[]).map(text=>({text,done:false})),next:newer&&local.next!==undefined?local.next:p?.nextAction||''};
  // Only what she changes counts as progress: opening a page and reading Bear's draft doesn't.
  initial.current=newer?'':JSON.stringify(v);setDraft(v.draft);setNotes(v.notes);setSteps(v.steps);setNext(v.next);
  if(newer)setSaved('offline');
 }).catch(e=>setErr((e as Error).message)),[id,key]);
 useEffect(()=>{load();},[load]);
 // Save shortly after each change: on this phone straight away, and to Bear a moment later.
 useEffect(()=>{
  if(initial.current===null||JSON.stringify({draft,notes,steps,next})===initial.current)return;const at=new Date().toISOString();
  try{localStorage.setItem(key,JSON.stringify({draft,notes,steps,next,at}));}catch{/* no storage */}
  if(timer.current)clearTimeout(timer.current);setSaved('saving');
  timer.current=setTimeout(()=>{apiSend(`/api/bear/board/tasks/${id}/progress`,{draft,notes:notes||null,steps:steps.length?steps:null,nextAction:next||null},'PUT').then(()=>{setSaved('saved');try{localStorage.removeItem(key);}catch{/* no storage */}}).catch(()=>setSaved('offline'));},700);
 },[draft,notes,steps,next,id,key]);
 if(err)return <main id="main" className="bear-screen"><TopBar back={{href:'/bear/home',label:'Home'}}/><ErrorCard message={err} retry={load}/></main>;
 if(!d)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const h=d.help;const t=d.task;
 const kind:'email'|'message'|'followup'=h?.kind==='message'?'message':h?.kind==='followup'?'followup':'email';
 const canWrite=!!d.aiAvailable&&t.status!=='done'&&h?.kind!=='bill'&&h?.kind!=='form';
 // Bear writes it with AI; the old version can be brought back. Saving happens through the normal autosave.
 async function write(){setWriting(true);setErr(null);try{const r=await apiSend<{draft:Draft}>(`/api/bear/board/help/${id}/draft`,{ask:ask.trim()||null,current:draft?.body?draft:null,kind});setPrevDraft(draft);setDraft(r.draft);setAsk('');}catch(e){setErr((e as Error).message);}finally{setWriting(false);}}
 // Her own time estimate always wins over Bear's guess. null hands it back to Bear.
 async function setMinutes(m:number|null){setTimeOpen(false);try{await apiSend(`/api/bear/board/tasks/${id}/details`,{minutes:m},'PATCH');await load();}catch(e){setErr((e as Error).message);}}
 async function done(){await apiSend(`/api/bear/tasks/${id}/complete`,{method:null}).catch(e=>setErr((e as Error).message));router.push('/bear/home');}
 return <main id="main" className="bear-screen">
  <TopBar back={{href:'/bear/home',label:'Home'}}/>
  <h1 style={{fontSize:24,marginTop:6}}>{t.title}</h1>
  <p className="small muted" style={{marginTop:4}}><button type="button" className="link-btn" aria-expanded={timeOpen} onClick={()=>setTimeOpen(o=>!o)} aria-label={`About ${t.minutes} minutes${t.minutesBy==='you'?' (your estimate)':' (Bear’s guess)'}. Change`}>About {t.minutes} min{t.minutesBy==='you'?'':' (a guess)'}</button>{t.dueAt?` · by ${formatAU(t.dueAt,'short')}`:''}{t.sharedIn?` · from ${t.sharedIn.from}`:''}{t.sharedOut?` · shared with ${t.sharedOut.to}`:''}</p>
  {timeOpen&&<div className="chips" role="group" aria-label="How long does it take?" style={{gap:6,marginTop:8}}>{[2,5,10,15,30,60,120].map(m=><button type="button" key={m} className="chip" aria-pressed={t.minutesBy==='you'&&t.minutes===m} onClick={()=>setMinutes(m)}>{m<60?`${m} min`:m===60?'1 hour':'2 hours'}</button>)}{t.minutesBy==='you'&&<button type="button" className="chip" onClick={()=>setMinutes(null)}>Let Bear guess</button>}</div>}
  <p className="tiny" role="status" aria-live="polite" style={{marginTop:6,color:saved==='offline'?'var(--coral)':'var(--ink-3)'}}>{saved==='saving'?'Saving…':saved==='saved'?'Saved. You can stop any time.':saved==='offline'?'Kept on this phone. Bear will save it when you’re back online.':'Anything you type here is saved as you go.'}</p>
  {t.status==='done'&&<p className="note teal" style={{marginTop:12}}>This one’s done.</p>}
  {h&&<p className="eyebrow teal" style={{marginTop:18}}>{h.label}</p>}
  {h?.bill&&<div className="glass" style={{padding:16,marginTop:8}}><p>{h.bill.amount?<strong>{h.bill.amount}</strong>:'Amount not read yet'}{h.bill.dueAt?` · due ${formatAU(h.bill.dueAt,'short')}`:''}</p><p className="small muted" style={{marginTop:6}}>Pay it through your bank or the biller’s site. Bear can’t pay for you; tell Bear once it’s paid.</p><Link href={h.bill.href} className="btn ghost sm" style={{marginTop:10}}>Open the bill</Link></div>}
  {h?.formHref&&<Link href={h.formHref} className="btn ghost sm" style={{marginTop:8}}>Check the prepared form</Link>}
  {draft&&<div className="glass" style={{padding:16,marginTop:8,display:'grid',gap:10}}>
   <label className="ce-field">To<input value={draft.to} onChange={e=>setDraft({...draft,to:e.target.value})} placeholder={h?.kind==='message'?'Their number':'Their email'} maxLength={200}/></label>
   {h?.kind!=='message'&&<label className="ce-field">Subject<input value={draft.subject} onChange={e=>setDraft({...draft,subject:e.target.value})} maxLength={200}/></label>}
   <label className="ce-field">Message<textarea value={draft.body} rows={8} onChange={e=>setDraft({...draft,body:e.target.value})} maxLength={6000}/></label>
   <div className="btn-row"><a className="btn coral sm" href={h?.kind==='message'?smsFor(draft):mailtoFor(draft)}>{h?.kind==='message'?'Open in Messages':'Open in Mail'}</a><button type="button" className="btn ghost sm" onClick={()=>navigator.clipboard?.writeText(draft.body).catch(()=>{})}>Copy</button></div>
   <p className="tiny muted">You send it from your own app. Bear never sends anything for you.</p>
  </div>}
  {canWrite&&(draft||!h||h.kind==='call'||h.kind==='steps')&&<div className="glass" style={{padding:14,marginTop:10,display:'grid',gap:8}}>
   <label className="ce-field">{draft?'Want Bear to rewrite it? Say what to change (optional)':'Need to send a message about this? Say what it should say (optional)'}<input value={ask} onChange={e=>setAsk(e.target.value)} placeholder={draft?'e.g. shorter, more firm, mention Friday':'e.g. ask if Thursday at 4 works'} maxLength={500}/></label>
   <div className="btn-row" style={{marginTop:0}}><button type="button" className="btn ghost sm" disabled={writing} onClick={write}>{writing?'Bear is writing…':draft?'Ask Bear to rewrite it':'Ask Bear to write it'}</button>{prevDraft!==undefined&&!writing&&<button type="button" className="link-btn small" onClick={()=>{setDraft(prevDraft);setPrevDraft(undefined);}}>Undo</button>}</div>
   <p className="tiny muted">Bear only uses what you’ve told it. Anything it doesn’t know is left in [brackets] for you to fill in.</p>
  </div>}
  {h?.searchFor&&<a className="btn ghost sm" style={{marginTop:10}} href={`https://www.google.com/search?q=${encodeURIComponent(h.searchFor)}`} target="_blank" rel="noopener noreferrer">Find their number</a>}
  {steps.length>0&&<ul className="b-list glass" style={{marginTop:10,padding:'4px 8px'}}>{steps.map((s,i)=><li key={i} className="b-row"><button type="button" className={`b-check${s.done?' on':''}`} role="checkbox" aria-checked={s.done} aria-label={s.text} onClick={()=>setSteps(a=>a.map((x,j)=>j===i?{...x,done:!x.done}:x))}><span/></button><div className="b-main"><span className="b-title" style={s.done?{textDecoration:'line-through',color:'var(--ink-3)'}:undefined}>{s.text}</span></div></li>)}</ul>}
  <label className="ce-field" style={{marginTop:16}}>Notes<textarea value={notes} rows={3} onChange={e=>setNotes(e.target.value)} placeholder="Names, numbers, what was said…" maxLength={4000}/></label>
  <label className="ce-field" style={{marginTop:12}}>Next step (so future you knows)<input value={next} onChange={e=>setNext(e.target.value)} placeholder="e.g. Wait for the builder’s quote" maxLength={200}/></label>
  <div className="btn-row" style={{marginTop:18}}>{t.status!=='done'&&<button type="button" className="btn coral" onClick={done}>Done</button>}<Link href="/bear/home" className="btn ghost">Leave it for now</Link></div>
 </main>;
}
