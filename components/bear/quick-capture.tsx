'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {apiSend,type ApiError} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import {areaKeys,type AreaKey} from '@/lib/bear/domain/types';

// The main screen's one job: tell Bear something and be done. Bear answers in a line, already filed and ranked;
// one tap corrects where it goes or how much it matters. Nothing has to be answered.
type Recognition={lang:string;continuous:boolean;interimResults:boolean;start():void;stop():void;onresult:((e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>&{isFinal:boolean}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null};
const recognitionCtor=():(new()=>Recognition)|null=>{if(typeof window==='undefined')return null;const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return w.SpeechRecognition||w.webkitSpeechRecognition||null;};
type One={auto?:{taskId:string;title:string;area:AreaKey;dueAt:string|null;merged:boolean}|null;dump?:{captureId:string}|null;confirmed?:{taskId:string;title:string}|null;info?:{captureId:string;receipt:boolean}|null;unclear?:boolean;error?:string;text?:string};
type Result={capture:{id:string};extraction?:{kind?:string};many?:(One&{captureId?:string;kind?:string})[];auto?:{taskId:string;title:string;area:AreaKey;dueAt:string|null;merged:boolean};dump?:{captureId:string};confirmed?:{taskId:string;title:string};info?:{captureId:string;receipt:boolean};unclear?:boolean};
type Reply={kind:'task';taskId:string;title:string;area:AreaKey;dueAt:string|null;merged:boolean;level:'very'|'nice'|'not'|null}|{kind:'done';taskId:string;title:string}|{kind:'info';captureId:string}|{kind:'unclear'}|{kind:'check';href:string;label:string}|{kind:'failed';text:string;message:string};
const areaLabel:Record<AreaKey,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
const levels=[{key:'very',label:'Really matters'},{key:'nice',label:'Matters'},{key:'not',label:'Low stakes'}] as const;
const noSub=()=>()=>{};
function toReply(r:One,captureId:string,kind?:string):Reply{
 if(r.error)return {kind:'failed',text:r.text||'',message:r.error};
 if(r.confirmed)return {kind:'done',taskId:r.confirmed.taskId,title:r.confirmed.title};
 if(r.info)return {kind:'info',captureId:r.info.captureId};
 if(r.unclear)return {kind:'unclear'};
 if(r.dump)return {kind:'check',href:`/bear/sort/${r.dump.captureId}`,label:'That’s a few things. Line them up'};
 if(r.auto)return {kind:'task',taskId:r.auto.taskId,title:r.auto.title,area:r.auto.area,dueAt:r.auto.dueAt,merged:r.auto.merged,level:null};
 return {kind:'check',href:`/bear/verify/${captureId}`,label:kind==='bill'?'That looks like a bill. Check what I read':'Check what I read'};
}
const MicIcon=()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;

export function QuickCapture({onChanged}:{onChanged:()=>void}){
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [said,setSaid]=useState<string|null>(null);const [replies,setReplies]=useState<Reply[]>([]);const [error,setError]=useState<string|null>(null);const [open,setOpen]=useState<{i:number;which:'area'|'level'}|null>(null);
 const [listening,setListening]=useState(false);const voice=useSyncExternalStore(noSub,()=>!!recognitionCtor(),()=>false);const usedVoice=useRef(false);const rec=useRef<Recognition|null>(null);
 useEffect(()=>()=>{try{rec.current?.stop();}catch{/* already stopped */}},[]);
 function listen(){
  if(listening){try{rec.current?.stop();}catch{/* already stopped */}return;}
  const C=recognitionCtor();if(!C)return;const r=new C();r.lang='en-AU';r.continuous=true;r.interimResults=false;
  r.onresult=e=>{let add='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)add+=e.results[i][0].transcript;if(add){usedVoice.current=true;setText(t=>(t?t.trimEnd()+' ':'')+add.trim());}};
  r.onend=()=>setListening(false);r.onerror=e=>{setListening(false);if(e.error==='not-allowed')setError('The microphone is blocked. Allow it in your browser settings, or type instead.');};
  rec.current=r;setError(null);try{r.start();setListening(true);}catch{setListening(false);}
 }
 async function send(){
  const body=text.trim();if(!body||busy)return;try{rec.current?.stop();}catch{/* not listening */}
  setBusy(true);setError(null);setReplies([]);setOpen(null);setSaid(body);
  try{
   const r=await apiSend<Result>('/api/bear/captures',{method:usedVoice.current?'voice':'text',text:body});setText('');usedVoice.current=false;
   setReplies(r.many&&r.many.length>1?r.many.map(m=>toReply(m,m.captureId||r.capture.id,m.kind)):[toReply(r,r.capture.id,r.extraction?.kind)]);
   onChanged();
  }catch(e){setError((e as ApiError).message||'Bear could not take that. Try again.');setSaid(null);}
  finally{setBusy(false);}
 }
 const put=(i:number,next:Reply)=>setReplies(list=>list.map((x,k)=>k===i?next:x));
 async function setArea(i:number,area:AreaKey){const reply=replies[i];if(reply?.kind!=='task'||reply.area===area)return;put(i,{...reply,area});try{await apiSend(`/api/bear/tasks/${reply.taskId}/area`,{area});onChanged();}catch{put(i,reply);setError('That didn’t save. Try again.');}}
 async function setLevel(i:number,level:'very'|'nice'|'not'){const reply=replies[i];if(reply?.kind!=='task')return;const next=reply.level===level?null:level;put(i,{...reply,level:next});try{await apiSend(`/api/bear/tasks/${reply.taskId}/importance`,{level:next});onChanged();}catch{put(i,reply);setError('That didn’t save. Try again.');}}
 async function keep(i:number,id:string){try{const r=await apiSend<{auto:{taskId:string;title:string;area:AreaKey;dueAt:string|null}|null}>(`/api/bear/captures/${id}/keep`,{});put(i,r.auto?{kind:'task',taskId:r.auto.taskId,title:r.auto.title||'Kept',area:r.auto.area||'me',dueAt:r.auto.dueAt||null,merged:false,level:null}:{kind:'check',href:`/bear/verify/${id}`,label:'Check what I read'});onChanged();}catch{setError('That didn’t save. Try again.');}}
 const isOpen=(i:number,which:'area'|'level')=>open?.i===i&&open.which===which;const toggle=(i:number,which:'area'|'level')=>setOpen(isOpen(i,which)?null:{i,which});
 return <section className="qc" aria-label="Tell Bear">
  <form className="qc-pill" onSubmit={e=>{e.preventDefault();void send();}}>
   <label htmlFor="qc-text" className="sr-only">What do you need to do?</label>
   <textarea id="qc-text" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder={listening?'Listening…':replies.length?'Anything else?':'What do you need to do?'} rows={1} maxLength={20000} disabled={busy}/>
   {text.trim()||!voice
    ?<button type="submit" className="qc-go" disabled={!text.trim()||busy} aria-label="Give it to Bear"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
    :<button type="button" className={`qc-go${listening?' on':''}`} onClick={listen} aria-pressed={listening} aria-label={listening?'Stop listening':'Say it'}><MicIcon/></button>}
  </form>
  {error&&<p className="note" role="alert" style={{marginTop:10}}>{error}</p>}
  {said&&<div className="qc-thread" aria-live="polite">
   <p className="qc-said">{said.length>140?said.slice(0,140)+'…':said}</p>
   {busy&&<p className="qc-reply muted">Bear’s reading it…</p>}
   {replies.length>1&&<p className="qc-reply qc-count">That’s {replies.length} things. I’ve taken each one.</p>}
   {replies.map((reply,i)=><div key={i} className="qc-item">
    {reply.kind==='task'&&<div className="qc-reply">
     <p className="qc-line"><strong>{reply.merged?'Added to':'Got it'}:</strong> <Link href={`/bear/tasks/${reply.taskId}`}>{reply.title}</Link>{reply.dueAt?<span className="muted"> · {formatAU(reply.dueAt,'short')}</span>:null}</p>
     <div className="qc-chips">
      <button type="button" className="chip sm" aria-expanded={isOpen(i,'area')} onClick={()=>toggle(i,'area')}>{areaLabel[reply.area]} <span aria-hidden="true">▾</span><span className="sr-only">: change where it goes</span></button>
      <button type="button" className="chip sm" aria-expanded={isOpen(i,'level')} onClick={()=>toggle(i,'level')}>{reply.level?levels.find(l=>l.key===reply.level)!.label:'Bear decides priority'} <span aria-hidden="true">▾</span><span className="sr-only">: change how much it matters</span></button>
     </div>
     {isOpen(i,'area')&&<div className="qc-chips" role="group" aria-label="Where it goes">{areaKeys.map(a=><button key={a} type="button" className="chip sm" aria-pressed={reply.area===a} onClick={()=>{void setArea(i,a);setOpen(null);}}>{areaLabel[a]}</button>)}</div>}
     {isOpen(i,'level')&&<div className="qc-chips" role="group" aria-label="How much it matters">{levels.map(l=><button key={l.key} type="button" className="chip sm" aria-pressed={reply.level===l.key} onClick={()=>{void setLevel(i,l.key);setOpen(null);}}>{l.label}</button>)}</div>}
    </div>}
    {reply.kind==='done'&&<p className="qc-reply"><strong>Sorted:</strong> that settles part of <Link href={`/bear/tasks/${reply.taskId}`}>{reply.title}</Link>.</p>}
    {reply.kind==='info'&&<p className="qc-reply">Nothing for you to do there, so I didn’t add a to-do. <button type="button" className="qc-link" onClick={()=>keep(i,reply.captureId)}>Keep it anyway</button></p>}
    {reply.kind==='unclear'&&<p className="qc-reply">I couldn’t tell what you need from that. Say a little more?</p>}
    {reply.kind==='check'&&<p className="qc-reply"><Link href={reply.href} style={{fontWeight:700,textDecoration:'underline'}}>{reply.label}</Link></p>}
    {reply.kind==='failed'&&<p className="qc-reply">I couldn’t take “{reply.text}”. {reply.message}</p>}
   </div>)}
   {replies.length>0&&!busy&&<p className="qc-reply qc-else">Anything else?</p>}
  </div>}
 </section>;
}
