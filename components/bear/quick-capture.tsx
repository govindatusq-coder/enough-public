'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {apiSend,type ApiError} from '@/lib/bear/client';
import {areaKeys,type AreaKey} from '@/lib/bear/domain/types';

// Tell Bear once. One message (typed or spoken) comes back sorted: each thing with a clear title, its area, a traffic light and
// a timeframe, grouped by how soon it matters. One tap confirms the lot; one sentence or one tap changes a single thing.
type Recognition={lang:string;continuous:boolean;interimResults:boolean;start():void;stop():void;onresult:((e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>&{isFinal:boolean}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null};
const recognitionCtor=():(new()=>Recognition)|null=>{if(typeof window==='undefined')return null;const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return w.SpeechRecognition||w.webkitSpeechRecognition||null;};
type Light='red'|'amber'|'green';
export interface Item{taskId:string|null;title:string;domain:AreaKey;light:Light;reason:string;when:string;nextAction:string|null;already:boolean;check:string|null;error:string|null}
type Result={capture?:{id:string};extraction?:{kind?:string};sorted?:Item[];auto?:{taskId:string;title:string}|null;dump?:{captureId:string}|null;confirmed?:{taskId:string;title:string}|null;info?:{captureId:string;receipt:boolean}|null;unclear?:boolean};
type Other={kind:'done';taskId:string;title:string}|{kind:'info';captureId:string}|{kind:'unclear'}|{kind:'check';href:string;label:string};
const areaLabel:Record<AreaKey,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
const groups:{light:Light;dot:string;label:string}[]=[{light:'red',dot:'🔴',label:'Urgent'},{light:'amber',dot:'🟠',label:'Coming up'},{light:'green',dot:'🟢',label:'Can wait'}];
const noSub=()=>()=>{};
const MicIcon=()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;

export function QuickCapture({onChanged}:{onChanged:()=>void}){
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [said,setSaid]=useState<string|null>(null);const [error,setError]=useState<string|null>(null);
 const [items,setItems]=useState<Item[]>([]);const [other,setOther]=useState<Other|null>(null);const [changing,setChanging]=useState(false);const [confirmed,setConfirmed]=useState(false);const [note,setNote]=useState<string|null>(null);
 const [listening,setListening]=useState(false);const voice=useSyncExternalStore(noSub,()=>!!recognitionCtor(),()=>false);const usedVoice=useRef(false);const rec=useRef<Recognition|null>(null);
 useEffect(()=>()=>{try{rec.current?.stop();}catch{/* already stopped */}},[]);
 function listen(){
  if(listening){try{rec.current?.stop();}catch{/* already stopped */}return;}
  const C=recognitionCtor();if(!C)return;const r=new C();r.lang='en-AU';r.continuous=true;r.interimResults=false;
  r.onresult=e=>{let add='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)add+=e.results[i][0].transcript;if(add){usedVoice.current=true;setText(t=>(t?t.trimEnd()+' ':'')+add.trim());}};
  r.onend=()=>setListening(false);r.onerror=e=>{setListening(false);if(e.error==='not-allowed')setError('The microphone is blocked. Allow it in your browser settings, or type instead.');};
  rec.current=r;setError(null);try{r.start();setListening(true);}catch{setListening(false);}
 }
 const ids=()=>items.map(i=>i.taskId).filter((x):x is string=>!!x);
 const replace=(next:Item)=>setItems(list=>list.map(x=>x.taskId===next.taskId?{...next,already:x.already}:x));
 async function send(){
  const body=text.trim();if(!body||busy)return;try{rec.current?.stop();}catch{/* not listening */}
  setBusy(true);setError(null);setNote(null);
  // "Change something": the next thing said is a correction to what Bear just sorted, not a new to-do.
  if(changing&&ids().length){
   try{const r=await apiSend<{changed:Item|null}>('/api/bear/sort',{taskIds:ids(),text:body},'PATCH');setText('');usedVoice.current=false;
    if(r.changed){replace(r.changed);setNote(`Done. “${r.changed.title}” is now ${groups.find(g=>g.light===r.changed!.light)!.label.toLowerCase()}, under ${areaLabel[r.changed.domain]}${r.changed.when&&r.changed.when!=='No date'?`, ${r.changed.when.charAt(0).toLowerCase()+r.changed.when.slice(1)}`:''}.`);setChanging(false);onChanged();}
    else setNote('I wasn’t sure which one you meant. Tap it below instead.');
   }catch(e){setError((e as ApiError).message||'That didn’t save. Try again.');}
   finally{setBusy(false);}
   return;
  }
  setItems([]);setOther(null);setConfirmed(false);setChanging(false);setSaid(body);
  try{
   const r=await apiSend<Result>('/api/bear/captures',{method:usedVoice.current?'voice':'text',text:body});setText('');usedVoice.current=false;
   if(r.sorted?.length)setItems(r.sorted);
   else if(r.confirmed)setOther({kind:'done',taskId:r.confirmed.taskId,title:r.confirmed.title});
   else if(r.info)setOther({kind:'info',captureId:r.info.captureId});
   else if(r.unclear)setOther({kind:'unclear'});
   else if(r.dump)setOther({kind:'check',href:`/bear/sort/${r.dump.captureId}`,label:'That’s a few things. Line them up'});
   else if(r.auto)setOther({kind:'done',taskId:r.auto.taskId,title:r.auto.title});
   else if(r.capture)setOther({kind:'check',href:`/bear/verify/${r.capture.id}`,label:r.extraction?.kind==='bill'?'That looks like a bill. Check what I read':'Check what I read'});
   onChanged();
  }catch(e){setError((e as ApiError).message||'Bear could not take that. Try again.');setSaid(null);}
  finally{setBusy(false);}
 }
 async function tap(item:Item,change:{light?:Light;domain?:AreaKey}){
  if(!item.taskId)return;const before=item;replace({...item,...change});
  try{const r=await apiSend<{changed:Item|null}>('/api/bear/sort',{taskIds:ids(),taskId:item.taskId,...change},'PATCH');if(r.changed)replace(r.changed);onChanged();}catch{replace(before);setError('That didn’t save. Try again.');}
 }
 async function keep(id:string){try{const r=await apiSend<{auto:{taskId:string;title:string}|null}>(`/api/bear/captures/${id}/keep`,{});setOther(r.auto?{kind:'done',taskId:r.auto.taskId,title:r.auto.title}:{kind:'check',href:`/bear/verify/${id}`,label:'Check what I read'});onChanged();}catch{setError('That didn’t save. Try again.');}}
 const answered=items.length>0||!!other;const placed=items.filter(i=>i.taskId);
 return <section className="qc" aria-label="Tell Bear">
  <form className="qc-pill" onSubmit={e=>{e.preventDefault();void send();}}>
   <label htmlFor="qc-text" className="sr-only">What do you need to do?</label>
   <textarea id="qc-text" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder={listening?'Listening…':changing?'e.g. “the dentist is urgent”':answered?'Anything else?':'What do you need to do?'} rows={1} maxLength={20000} disabled={busy}/>
   {text.trim()||!voice
    ?<button type="submit" className="qc-go" disabled={!text.trim()||busy} aria-label={changing?'Change it':'Give it to Bear'}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
    :<button type="button" className={`qc-go${listening?' on':''}`} onClick={listen} aria-pressed={listening} aria-label={listening?'Stop listening':'Say it'}><MicIcon/></button>}
  </form>
  {error&&<p className="note" role="alert" style={{marginTop:10}}>{error}</p>}
  {said&&<div className="qc-thread" aria-live="polite">
   <p className="qc-said">{said.length>220?said.slice(0,220)+'…':said}</p>
   {busy&&!answered&&<p className="qc-reply muted">Bear’s sorting it…</p>}
   {items.length>0&&<div className="qc-reply qc-sorted">
    <p className="qc-head">{items.length===1?'I’ve sorted this for you.':'I’ve sorted these for you.'}</p>
    {groups.map(g=>{const list=items.filter(i=>i.light===g.light);if(!list.length)return null;
     return <section key={g.light} className={`qc-group ${g.light}`} aria-label={g.label}>
      <p className="qc-group-head"><span aria-hidden="true">{g.dot}</span> {g.label}</p>
      <ul>{list.map((i,k)=><li key={i.taskId||i.title+k} className="qc-card">
       {i.taskId?<Link className="qc-title" href={`/bear/tasks/${i.taskId}`}>{i.title}</Link>:<span className="qc-title">{i.title}</span>}
       <span className="qc-meta"><span className={`qc-area area-${i.domain}`}>{areaLabel[i.domain]}</span> · {i.when}{i.already?' · Already on my list':''}</span>
       {i.nextAction&&!i.error&&!i.check&&<span className="qc-next">{i.nextAction}</span>}
       {i.check&&<Link className="qc-next" href={i.check} style={{textDecoration:'underline'}}>That looks like a bill. Check what I read</Link>}
       {i.error&&<span className="qc-next">I couldn’t take this one. {i.error}</span>}
       {changing&&i.taskId&&<span className="qc-edit">
        <span className="qc-lights" role="group" aria-label={`How soon: ${i.title}`}>{groups.map(x=><button key={x.light} type="button" className="chip sm" aria-pressed={i.light===x.light} onClick={()=>tap(i,{light:x.light})}><span aria-hidden="true">{x.dot}</span> {x.label}</button>)}</span>
        <label className="sr-only" htmlFor={`qc-area-${i.taskId}`}>Area for {i.title}</label>
        <select id={`qc-area-${i.taskId}`} className="qc-select" value={i.domain} onChange={e=>tap(i,{domain:e.target.value as AreaKey})}>{areaKeys.map(a=><option key={a} value={a}>{areaLabel[a]}</option>)}</select>
       </span>}
      </li>)}</ul>
     </section>;})}
    {note&&<p className="qc-note" role="status">{note}</p>}
    {placed.length>0&&!confirmed&&<div className="qc-confirm">
     {!changing&&<p className="qc-ask">Want me to get started?</p>}
     {changing&&<p className="qc-ask">Tell me what to change, or tap it above.</p>}
     <div className="btn-row" style={{marginTop:6}}>
      <button type="button" className="btn coral sm" onClick={()=>{setConfirmed(true);setChanging(false);setNote(null);}}>Looks good, Bear</button>
      {!changing&&<button type="button" className="btn quiet sm" onClick={()=>{setChanging(true);setNote(null);document.getElementById('qc-text')?.focus();}}>Change something</button>}
     </div>
    </div>}
    {confirmed&&<p className="qc-note" role="status">On it. I’ll bring each one back when it needs you.</p>}
   </div>}
   {other?.kind==='done'&&<p className="qc-reply"><strong>Sorted:</strong> <Link href={`/bear/tasks/${other.taskId}`}>{other.title}</Link>.</p>}
   {other?.kind==='info'&&<p className="qc-reply">Nothing for you to do there, so I didn’t add a to-do. <button type="button" className="qc-link" onClick={()=>keep(other.captureId)}>Keep it anyway</button></p>}
   {other?.kind==='unclear'&&<p className="qc-reply">I couldn’t tell what you need from that. Say a little more?</p>}
   {other?.kind==='check'&&<p className="qc-reply"><Link href={other.href} style={{fontWeight:700,textDecoration:'underline'}}>{other.label}</Link></p>}
   {answered&&!busy&&(confirmed||!placed.length)&&<p className="qc-reply qc-else">Anything else?</p>}
  </div>}
 </section>;
}
