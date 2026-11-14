'use client';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Link from 'next/link';
import {apiSend,type ApiError} from '@/lib/bear/client';
import {areaKeys,type AreaKey} from '@/lib/bear/domain/types';
import {replyKind} from '@/lib/bear/services/sorter';

// Tell Bear once. One message (typed or spoken) comes back sorted: each thing with a clear title, its area, a traffic light and
// a timeframe, grouped by how soon it matters. One tap confirms the lot; one sentence or one tap changes a single thing.
type Recognition={lang:string;continuous:boolean;interimResults:boolean;start():void;stop():void;onresult:((e:{resultIndex:number;results:ArrayLike<ArrayLike<{transcript:string}>&{isFinal:boolean}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null};
const recognitionCtor=():(new()=>Recognition)|null=>{if(typeof window==='undefined')return null;const w=window as unknown as {SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};return w.SpeechRecognition||w.webkitSpeechRecognition||null;};
type Light='red'|'amber'|'green';
export interface Item{taskId:string|null;title:string;domain:AreaKey;light:Light;reason:string;when:string;nextAction:string|null;already:boolean;check:string|null;error:string|null}
export interface Found{question:string;answer:string;subject:string;date:string|null;dateLabel:string|null;sources:{title:string;url:string}[];remindedAs?:Item|null}
type Result={found?:Found[];chat?:'closing'|'more';capture?:{id:string};extraction?:{kind?:string};sorted?:Item[];auto?:{taskId:string;title:string}|null;dump?:{captureId:string}|null;confirmed?:{taskId:string;title:string}|null;info?:{captureId:string;receipt:boolean}|null;unclear?:boolean};
type Other={kind:'say';text:string}|{kind:'closing'}|{kind:'more'}|{kind:'done';taskId:string;title:string}|{kind:'info';captureId:string}|{kind:'unclear'}|{kind:'check';href:string;label:string};
const areaLabel:Record<AreaKey,string>={work:'Work',family:'Family',home:'Home',money:'Money',health:'Health',me:'Me'};
const groups:{light:Light;dot:string;label:string}[]=[{light:'red',dot:'🔴',label:'Urgent'},{light:'amber',dot:'🟠',label:'Coming up'},{light:'green',dot:'🟢',label:'Can wait'}];
const noSub=()=>()=>{};
// Where the person can go once they have finished telling Bear things.
const places=[{href:'/bear/home',label:'My Bear'},{href:'/bear/ideas',label:'Bear Ideas'},{href:'/bear/wins',label:'My Wins'},{href:'/bear/me',label:'Settings'}];
const MicIcon=()=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"/></svg>;

type Turn={id:number;said:string;busy:boolean;items:Item[];found:Found[];other:Other|null;confirmed:boolean;note:string|null};
let turnSeq=0;
const blank=(said:string):Turn=>({id:++turnSeq,said,busy:true,items:[],found:[],other:null,confirmed:false,note:null});

// A conversation: what you said and what Bear did with it stay on screen, newest at the bottom, with the box docked under it.
export function QuickCapture({onChanged,hero,links}:{onChanged:()=>void;hero?:(started:boolean)=>React.ReactNode;links?:React.ReactNode}){
 const [text,setText]=useState('');const [turns,setTurns]=useState<Turn[]>([]);const [error,setError]=useState<string|null>(null);const [changing,setChanging]=useState<number|null>(null);const [hint,setHint]=useState(false);
 const [listening,setListening]=useState(false);const voice=useSyncExternalStore(noSub,()=>!!recognitionCtor(),()=>false);const usedVoice=useRef(false);const rec=useRef<Recognition|null>(null);const end=useRef<HTMLSpanElement>(null);
 useEffect(()=>()=>{try{rec.current?.stop();}catch{/* already stopped */}},[]);
 // Keep the newest thing in view, the way a chat does.
 useEffect(()=>{if(turns.length)end.current?.scrollIntoView({block:'end',behavior:'smooth'});},[turns,changing]);
 function listen(){
  if(listening){try{rec.current?.stop();}catch{/* already stopped */}return;}
  const C=recognitionCtor();if(!C)return;const r=new C();r.lang='en-AU';r.continuous=true;r.interimResults=false;
  r.onresult=e=>{let add='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)add+=e.results[i][0].transcript;if(add){usedVoice.current=true;setText(t=>(t?t.trimEnd()+' ':'')+add.trim());}};
  r.onend=()=>setListening(false);r.onerror=e=>{setListening(false);if(e.error==='not-allowed')setError('The microphone is blocked. Allow it in your browser settings, or type instead.');};
  rec.current=r;setError(null);try{r.start();setListening(true);}catch{setListening(false);}
 }
 const busy=turns.some(t=>t.busy);
 const patch=(id:number,fn:(t:Turn)=>Turn)=>setTurns(list=>list.map(t=>t.id===id?fn(t):t));
 const idsOf=(t:Turn)=>t.items.map(i=>i.taskId).filter((x):x is string=>!!x);
 const swap=(id:number,next:Item)=>patch(id,t=>({...t,items:t.items.map(x=>x.taskId===next.taskId?{...next,already:x.already}:x)}));
 async function send(){
  const body=text.trim();if(!body||busy)return;try{rec.current?.stop();}catch{/* not listening */}
  setError(null);setHint(false);setText('');const viaVoice=usedVoice.current;usedVoice.current=false;
  // "Change something": the next thing said is a correction to that turn, not a new to-do.
  const target=changing!==null?turns.find(t=>t.id===changing):null;
  if(target&&idsOf(target).length){
   const turn=blank(body);setTurns(l=>[...l,turn]);
   try{const r=await apiSend<{changed:Item|null}>('/api/bear/sort',{taskIds:idsOf(target),text:body},'PATCH');
    if(r.changed){swap(target.id,r.changed);setChanging(null);onChanged();
     patch(turn.id,t=>({...t,busy:false,other:{kind:'say',text:`Done. “${r.changed!.title}” is now ${groups.find(g=>g.light===r.changed!.light)!.label.toLowerCase()}, under ${areaLabel[r.changed!.domain]}${r.changed!.when&&r.changed!.when!=='No date'?`, ${r.changed!.when.charAt(0).toLowerCase()+r.changed!.when.slice(1)}`:''}.`}}));}
    else patch(turn.id,t=>({...t,busy:false,other:{kind:'say',text:'I wasn’t sure which one you meant. Tap it in the list above instead.'}}));
   }catch(e){setTurns(l=>l.filter(t=>t.id!==turn.id));setText(body);setError((e as ApiError).message||'That didn’t save. Try again.');}
   return;
  }
  setChanging(null);
  const chat=replyKind(body);const turn=blank(body);setTurns(l=>[...l,turn]);
  if(chat){patch(turn.id,t=>({...t,busy:false,other:{kind:chat}}));return;}
  try{
   const r=await apiSend<Result>('/api/bear/captures',{method:viaVoice?'voice':'text',text:body});
   const other:Other|null=r.chat?{kind:r.chat}:r.sorted?.length||r.found?.length?null:r.confirmed?{kind:'done',taskId:r.confirmed.taskId,title:r.confirmed.title}:r.info?{kind:'info',captureId:r.info.captureId}:r.unclear?{kind:'unclear'}
    :r.dump?{kind:'check',href:`/bear/sort/${r.dump.captureId}`,label:'That’s a few things. Line them up'}:r.auto?{kind:'done',taskId:r.auto.taskId,title:r.auto.title}
    :r.capture?{kind:'check',href:`/bear/verify/${r.capture.id}`,label:r.extraction?.kind==='bill'?'That looks like a bill. Check what I read':'Check what I read'}:{kind:'unclear'};
   patch(turn.id,t=>({...t,busy:false,items:r.sorted||[],found:r.found||[],other}));onChanged();
  }catch(e){setTurns(l=>l.filter(t=>t.id!==turn.id));setText(body);setError((e as ApiError).message||'Bear could not take that. Try again.');}
 }
 async function tap(turn:Turn,item:Item,change:{light?:Light;domain?:AreaKey}){
  if(!item.taskId)return;swap(turn.id,{...item,...change});
  try{const r=await apiSend<{changed:Item|null}>('/api/bear/sort',{taskIds:idsOf(turn),taskId:item.taskId,...change},'PATCH');if(r.changed)swap(turn.id,r.changed);onChanged();}catch{swap(turn.id,item);setError('That didn’t save. Try again.');}
 }
 async function keep(turn:Turn,id:string){try{const r=await apiSend<{auto:{taskId:string;title:string}|null}>(`/api/bear/captures/${id}/keep`,{});patch(turn.id,t=>({...t,other:r.auto?{kind:'done',taskId:r.auto.taskId,title:r.auto.title}:{kind:'check',href:`/bear/verify/${id}`,label:'Check what I read'}}));onChanged();}catch{setError('That didn’t save. Try again.');}}
 async function remind(turn:Turn,f:Found){
  try{const r=await apiSend<{item:Item}>('/api/bear/sort',{question:f.question,subject:f.subject||f.question.slice(0,80),date:f.date,answer:f.answer,sources:f.sources});patch(turn.id,t=>({...t,found:t.found.map(x=>x===f?{...f,remindedAs:r.item}:x)}));onChanged();}
  catch(e){setError((e as ApiError).message||'That didn’t save. Try again.');}
 }
 const started=turns.length>0;const last=turns[turns.length-1];
 // Bear asks "Anything else?" once the latest turn needs nothing more from the person.
 const settled=(t:Turn)=>!t.busy&&t.other?.kind!=='closing'&&t.other?.kind!=='more'&&(t.confirmed||t.items.length===1||!t.items.some(i=>i.taskId))&&t.found.every(f=>!f.date||f.remindedAs||t.items.length>0);
 return <div className={`chat${started?' started':''}`}>
  <div className="chat-scroll">
   {hero?.(started)}
   {started&&<div className="qc-thread" aria-live="polite">
    {turns.map(turn=>{const placed=turn.items.filter(i=>i.taskId);const isChanging=changing===turn.id;return <div key={turn.id} className="qc-turn">
     <p className="qc-said">{turn.said.length>220?turn.said.slice(0,220)+'…':turn.said}</p>
     {turn.busy&&<p className="qc-reply muted">{/\b(search|look up|find out|google|research|when|what|how much)\b/i.test(turn.said)?'Bear’s looking into it…':'Bear’s sorting it…'}</p>}
     {turn.found.map((f,k)=><div key={k} className="qc-reply qc-found">
      <p className="qc-head">I looked it up.</p>
      <p className="qc-answer">{f.answer}</p>
      <p className="qc-sources">{f.sources.map((s,i)=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{i===0?'Source: ':''}{(()=>{try{return new URL(s.url).hostname.replace(/^www\./,'');}catch{return s.title||'link';}})()}</a>)}</p>
      <p className="qc-next">Found online. Worth a quick check of the source before you rely on it.</p>
      {f.date&&!f.remindedAs&&<div className="btn-row" style={{marginTop:8}}><button type="button" className="btn coral sm" onClick={()=>remind(turn,f)}>Remind me for {f.dateLabel}</button></div>}
      {f.remindedAs&&<p className="qc-note" role="status">Saved. {f.remindedAs.taskId?<Link href={`/bear/tasks/${f.remindedAs.taskId}`} style={{textDecoration:'underline'}}>{f.remindedAs.title}</Link>:f.remindedAs.title} · {f.remindedAs.when}. I’ll remind you as it gets close.</p>}
     </div>)}
     {turn.items.length>0&&<div className="qc-reply qc-sorted">
      <p className="qc-head">{turn.items.length===1?'I’ve sorted this for you.':'I’ve sorted these for you.'}</p>
      {groups.map(g=>{const list=turn.items.filter(i=>i.light===g.light);if(!list.length)return null;
       return <section key={g.light} className={`qc-group ${g.light}`} aria-label={g.label}>
        <p className="qc-group-head"><span aria-hidden="true">{g.dot}</span> {g.label}</p>
        <ul>{list.map((i,k)=><li key={i.taskId||i.title+k} className="qc-card">
         {i.taskId?<Link className="qc-title" href={`/bear/tasks/${i.taskId}`}>{i.title}</Link>:<span className="qc-title">{i.title}</span>}
         <span className="qc-meta"><span className={`qc-area area-${i.domain}`}>{areaLabel[i.domain]}</span> · {i.when}{i.already?' · Already on my list':''}</span>
         {i.nextAction&&!i.error&&!i.check&&<span className="qc-next">{i.nextAction}</span>}
         {i.check&&<Link className="qc-next" href={i.check} style={{textDecoration:'underline'}}>That looks like a bill. Check what I read</Link>}
         {i.error&&<span className="qc-next">I couldn’t take this one. {i.error}</span>}
         {isChanging&&i.taskId&&<span className="qc-edit">
          <span className="qc-lights" role="group" aria-label={`How soon: ${i.title}`}>{groups.map(x=><button key={x.light} type="button" className="chip sm" aria-pressed={i.light===x.light} onClick={()=>tap(turn,i,{light:x.light})}><span aria-hidden="true">{x.dot}</span> {x.label}</button>)}</span>
          <label className="sr-only" htmlFor={`qc-area-${i.taskId}`}>Area for {i.title}</label>
          <select id={`qc-area-${i.taskId}`} className="qc-select" value={i.domain} onChange={e=>tap(turn,i,{domain:e.target.value as AreaKey})}>{areaKeys.map(a=><option key={a} value={a}>{areaLabel[a]}</option>)}</select>
         </span>}
        </li>)}</ul>
       </section>;})}
      {/* One thing needs no ceremony: it is simply done, with a quiet way to change it. Several things get one confirmation. */}
      {placed.length>0&&turn.items.length===1&&!isChanging&&!turn.confirmed&&<button type="button" className="qc-link qc-change" onClick={()=>{setChanging(turn.id);document.getElementById('qc-text')?.focus();}}>Change something</button>}
      {placed.length>0&&!turn.confirmed&&(turn.items.length>1||isChanging)&&<div className="qc-confirm">
       <p className="qc-ask">{isChanging?'Tell me what to change, or tap it above.':'Want me to get started?'}</p>
       <div className="btn-row" style={{marginTop:6}}>
        <button type="button" className="btn coral sm" onClick={()=>{patch(turn.id,t=>({...t,confirmed:true}));if(isChanging)setChanging(null);}}>Looks good, Bear</button>
        {!isChanging&&<button type="button" className="btn quiet sm" onClick={()=>{setChanging(turn.id);document.getElementById('qc-text')?.focus();}}>Change something</button>}
       </div>
      </div>}
      {turn.confirmed&&<p className="qc-note" role="status">On it. I’ll bring each one back when it needs you.</p>}
     </div>}
     {turn.other?.kind==='say'&&<p className="qc-reply">{turn.other.text}</p>}
     {turn.other?.kind==='closing'&&<div className="qc-reply qc-closing">
      <p style={{margin:0}}>All sorted. I’m here whenever you need me.</p>
      <nav className="qc-places" aria-label="Where to next">{places.map(p=><Link key={p.href} href={p.href} className="chip sm">{p.label}</Link>)}</nav>
     </div>}
     {turn.other?.kind==='more'&&<p className="qc-reply">Go ahead. What else is on your mind?</p>}
     {turn.other?.kind==='done'&&<p className="qc-reply"><strong>Sorted:</strong> <Link href={`/bear/tasks/${turn.other.taskId}`}>{turn.other.title}</Link>.</p>}
     {turn.other?.kind==='info'&&<p className="qc-reply">Nothing for you to do there, so I didn’t add a to-do. <button type="button" className="qc-link" onClick={()=>{const o=turn.other;if(o?.kind==='info')void keep(turn,o.captureId);}}>Keep it anyway</button></p>}
     {turn.other?.kind==='unclear'&&<p className="qc-reply">I couldn’t tell what you need from that. Say a little more?</p>}
     {turn.other?.kind==='check'&&<p className="qc-reply"><Link href={turn.other.href} style={{fontWeight:700,textDecoration:'underline'}}>{turn.other.label}</Link></p>}
    </div>;})}
    {last&&settled(last)&&changing===null&&<p className="qc-reply qc-else">Anything else?</p>}
    <span ref={end} className="qc-end"/>
   </div>}
  </div>
  <div className="chat-dock">
   {error&&<p className="note" role="alert" style={{marginBottom:8}}>{error}</p>}
   {hint&&!voice&&!text&&<p className="qc-hint" role="status">Tap the microphone on your keyboard and say it. Bear will take it from there.</p>}
   <form className="qc-pill" onSubmit={e=>{e.preventDefault();void send();}}>
    <label htmlFor="qc-text" className="sr-only">What do you need to do?</label>
    <textarea id="qc-text" value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send();}}} placeholder={listening?'Listening…':changing!==null?'e.g. “the dentist is urgent”':started&&last?.other?.kind!=='closing'?'Anything else?':'What do you need to do?'} rows={1} maxLength={20000} disabled={busy}/>
    {/* The microphone is always there. Where the browser can't listen itself, it opens the keyboard, whose own microphone can. */}
    <button type="button" className={`qc-go qc-voice${listening?' on':''}`} onClick={()=>{if(voice){listen();return;}document.getElementById('qc-text')?.focus();setHint(true);}} aria-pressed={voice?listening:undefined} aria-label={listening?'Stop listening':'Say it'}><MicIcon/></button>
    {text.trim()&&<button type="submit" className="qc-go" disabled={busy} aria-label={changing!==null?'Change it':'Give it to Bear'}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>}
   </form>
   {links}
  </div>
 </div>;
}
