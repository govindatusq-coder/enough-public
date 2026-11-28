'use client';
// Bear Boost: a conversation with Bear. It opens on one invitation and one box (no menus, moods, timers or chips); the
// first message turns the same screen into a chat. Talk or type; Bear's replies can be read aloud on request.
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend,type ApiError} from '@/lib/bear/client';
import type {MomentAction,MomentMessage} from '@/lib/bear/services/moment-chat';
import {Art} from './art';
import {Icon,LabelChip} from './v2';
import {AddToOutlook} from './add-to-outlook';
import {useSpeechInput,useSpeechOutput} from './speech';

type Pending={id:string;text:string;at:string;state:'sending'|'failed'};
const DRAFT='bear-moment-draft',CACHE='bear-moment-cache',READ='bear-moment-read';
const get=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const put=(k:string,v:string|null)=>{try{if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);}catch{/* no storage */}};
const newId=()=>`m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const time=(iso:string)=>new Date(iso).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}).toLowerCase();
const nearBottom=()=>window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-160;
const svg=(d:React.ReactNode,size=22)=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const I={
 mic:svg(<><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>),
 send:svg(<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>,22),
 speaker:svg(<><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></>),
 speakerOff:svg(<><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></>),
 play:svg(<path d="M7 5v14l11-7z" fill="currentColor" stroke="none"/>,16),
 stop:svg(<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>,16),
 back:svg(<path d="m15 6-6 6 6 6"/>,24),
 x:svg(<path d="M6 6l12 12M18 6 6 18"/>,18),
};

// Talk It Out: the conversation with Bear, opened from Bear Boost's three choices. No time question first.
export const OPENER='I’m listening. What’s on your mind?';
export function MomentChat({onBack}:{onBack:()=>void}){
 const router=useRouter();
 const [messages,setMessages]=useState<MomentMessage[]>([]);const [pending,setPending]=useState<Pending[]>([]);
 const [loaded,setLoaded]=useState(false);const view='chat' as 'idle'|'chat';const [freshFrom,setFreshFrom]=useState<number|null>(null);
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [autoRead,setAutoRead]=useState(false);
 const box=useRef<HTMLTextAreaElement>(null);const stick=useRef(true);
 const focus=useCallback(()=>box.current?.focus(),[]);
 const speech=useSpeechInput({text,setText,focus});const voice=useSpeechOutput();

 // Open: what was being typed, the cached conversation (instant, works offline), then the kept one from the server.
 useEffect(()=>{queueMicrotask(()=>{setText(get(DRAFT)||'');setAutoRead(get(READ)==='on');try{const c=JSON.parse(get(CACHE)||'[]');if(Array.isArray(c))setMessages(c);}catch{/* none */}});
  apiGet<{messages:MomentMessage[];resume:boolean}>('/api/bear/moment/chat').then(r=>{setMessages(r.messages);put(CACHE,JSON.stringify(r.messages.slice(-40)));
   if(r.resume&&r.messages.length)stick.current=true;else setFreshFrom(r.messages.length);setLoaded(true);})
   .catch(e=>{if((e as ApiError).status===401){router.replace('/bear/signin');return;}setLoaded(true);});},[router]);
 useEffect(()=>{if(loaded)put(DRAFT,text||null);},[text,loaded]);
 useEffect(()=>{const el=box.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,view==='idle'?200:140)+'px';}},[text,view]);
 // Newest in view, but only if she was already near the bottom (never yanked away from something she's reading).
 useLayoutEffect(()=>{if(view==='chat'&&stick.current)window.scrollTo({top:document.documentElement.scrollHeight});},[messages,pending,busy,view]);
 useEffect(()=>{const on=()=>{stick.current=nearBottom();};window.addEventListener('scroll',on,{passive:true});return()=>window.removeEventListener('scroll',on);},[]);

 async function deliver(p:Pending){
  setBusy(true);setPending(l=>l.map(x=>x.id===p.id?{...x,state:'sending'}:x));stick.current=true;
  try{
   const r=await apiSend<{messages:MomentMessage[]}>('/api/bear/moment/chat',{id:p.id,text:p.text});
   setMessages(m=>{const ids=new Set(r.messages.map(x=>x.id));const next=[...m.filter(x=>!ids.has(x.id)),...r.messages];put(CACHE,JSON.stringify(next.slice(-40)));return next;});
   setPending(l=>l.filter(x=>x.id!==p.id));
   const bear=r.messages.find(x=>x.role==='bear');if(bear&&autoRead)voice.play(bear.id,bear.text);
  }catch{setPending(l=>l.map(x=>x.id===p.id?{...x,state:'failed'}:x));}
  finally{setBusy(false);}
 }
 function send(){
  const t=text.trim();if(!t||busy)return;if(speech.listening)speech.cancel();
  const p:Pending={id:newId(),text:t,at:new Date().toISOString(),state:'sending'};
  setText('');put(DRAFT,null);setPending(l=>[...l,p]);
  deliver(p);
 }
 function toggleRead(){const on=!autoRead;setAutoRead(on);put(READ,on?'on':null);if(!on)voice.stop();}
 async function clearChat(){if(!window.confirm('Clear this conversation? It can’t be brought back.'))return;try{await apiSend('/api/bear/moment/chat',{},'DELETE');setMessages([]);setPending([]);put(CACHE,null);setFreshFrom(0);}catch{/* stays as it was */}}
 const state=speech.listening?'voice_recording':busy?'responding':pending.some(p=>p.state==='failed')?'error':text.trim()?'composing':view==='chat'?'ready':'idle';

 const composer=(idle:boolean)=><div className={idle?'mc-composer idle':'mc-composer'}>
  <label htmlFor="mc-text" className="sr-only">Message Bear</label>
  <textarea id="mc-text" ref={box} value={text} rows={1} maxLength={4000} placeholder={speech.listening?'Listening…':idle?'Whatever’s on your mind…':'Message Bear…'}
   onChange={e=>{setText(e.target.value);speech.clearHint();}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!('ontouchstart' in window)){e.preventDefault();send();}}}/>
  <div className="mc-tools">
   <button type="button" className={`mc-mic${speech.listening?' on':''}`} onClick={speech.toggle} aria-pressed={speech.listening} aria-label={speech.listening?'Stop listening':speech.canTalk?'Speak instead of typing':'Speak (uses your keyboard’s microphone)'}>{I.mic}</button>
   {speech.listening&&<button type="button" className="mc-cancel" onClick={speech.cancel} aria-label="Cancel listening">{I.x}<span>Cancel</span></button>}
   <span className="mc-spacer"/>
   {idle&&voice.can&&<button type="button" className={`mc-icon${autoRead?' on':''}`} onClick={toggleRead} aria-pressed={autoRead} aria-label="Read Bear’s replies aloud">{autoRead?I.speaker:I.speakerOff}</button>}
   <button type="button" className="mc-send" onClick={send} disabled={!text.trim()||busy} aria-label="Send">{I.send}</button>
  </div>
  {(speech.hint||speech.listening)&&<p className="mc-hint" role="status" aria-live="polite">{speech.listening?'Listening… tap the microphone when you’re done, then check it and send.':speech.hint}</p>}
 </div>;

 // Bear opens each new sitting the same way; it isn't saved, so it never piles up in her history.
 const opener=<div className="mc-row mc-b"><Art file="avatar" className="mc-avatar"/><div className="mc-col"><div className="mc-bubble mc-b"><p>{OPENER}</p></div></div></div>;
 return <main id="main" className="bear-screen mc mc-chat" data-state={state}>
  <header className="mc-top">
   <button type="button" className="mc-icon" onClick={()=>{voice.stop();onBack();}} aria-label="Back">{I.back}</button>
   <Art file="avatar" className="mc-top-avatar"/>
   <div className="mc-who"><strong>Bear</strong><span>Here with you</span></div>
   {voice.can&&<button type="button" className={`mc-icon${autoRead?' on':''}`} onClick={toggleRead} aria-pressed={autoRead} aria-label="Read Bear’s replies aloud">{autoRead?I.speaker:I.speakerOff}</button>}
  </header>
  <section className="mc-thread" aria-label="Conversation with Bear" aria-live="polite">
   {messages.length>0&&<p className="mc-clear"><button type="button" className="link-btn small" onClick={clearChat}>Clear this chat</button></p>}
   {messages.map((m,i)=><div key={m.id}>
    {freshFrom!==null&&i===freshFrom&&<>{freshFrom>0&&<p className="mc-divider"><span>Today</span></p>}{opener}</>}
    {m.role==='user'?<UserBubble text={m.text} at={m.at}/>:<BearBubble m={m} voice={voice}/>}
   </div>)}
   {freshFrom!==null&&freshFrom>=messages.length&&<>{freshFrom>0&&<p className="mc-divider"><span>Today</span></p>}{opener}</>}
   {pending.map(p=><UserBubble key={p.id} text={p.text} at={p.at} state={p.state} retry={()=>deliver(p)}/>)}
   {busy&&<div className="mc-row mc-b"><Art file="avatar" className="mc-avatar"/><div className="mc-bubble mc-b mc-typing" aria-label="Bear is replying"><span className="dots" aria-hidden="true"><i/><i/><i/></span></div></div>}
  </section>
  {composer(false)}
 </main>;
}

function UserBubble({text,at,state,retry}:{text:string;at:string;state?:'sending'|'failed';retry?:()=>void}){
 return <div className="mc-row you"><div className={`mc-bubble you${state==='failed'?' failed':''}`}><p>{text}</p>
  <span className="mc-time">{state==='sending'?'Sending…':state==='failed'?<button type="button" className="link-btn" onClick={retry}>Didn’t send. Try again</button>:time(at)}</span></div></div>;
}
function BearBubble({m,voice}:{m:MomentMessage;voice:ReturnType<typeof useSpeechOutput>}){
 const on=voice.playing===m.id;
 return <div className="mc-row mc-b"><Art file="avatar" className="mc-avatar"/>
  <div className="mc-col">
   <div className="mc-bubble mc-b">{m.text.split(/\n{2,}/).map((p,i)=><p key={i}>{p}</p>)}
    {voice.can&&<button type="button" className={`mc-play${on?' on':''}`} onClick={()=>on?voice.stop():voice.play(m.id,m.text)} aria-label={on?'Stop reading aloud':'Read this aloud'}>{on?I.stop:I.play}<span>{on?'Stop':voice.failed===m.id?'Couldn’t play':'Listen'}</span></button>}
   </div>
   {m.actions?.map(a=><ActionCard key={a.id} a={a}/>)}
  </div></div>;
}

// What Bear did or found, as a card under its message. Each says honestly where it stands.
function ActionCard({a}:{a:MomentAction}){
 const router=useRouter();const [state,setState]=useState(a.state);const [msg,setMsg]=useState<string|null>(null);const [working,setWorking]=useState(false);
 async function give(){if(!a.taskId)return;setWorking(true);try{await apiSend(`/api/bear/rre/${a.taskId}/give`,{});router.push(`/bear/brain/${a.taskId}`);}catch(e){setMsg((e as Error).message);setWorking(false);}}
 async function notNow(){if(!a.taskId)return;setWorking(true);try{await apiSend(`/api/bear/rre/${a.taskId}/skip`,{});}catch{/* still set aside here */}setState('cancelled');setMsg('Okay, not now.');setWorking(false);}
 const open=a.taskId?<Link href={`/bear/brain/${a.taskId}`} className="mc-open">Open <span aria-hidden="true">›</span></Link>:null;
 if(a.kind==='suggestion')return <div className="mc-card">
  {a.label&&<LabelChip label={a.label}/>}
  <Link href={`/bear/brain/${a.taskId}`} className="mc-card-title">{a.title}</Link>
  {a.minutes?<p className="mc-card-sub">Takes about {a.minutes} minute{a.minutes===1?'':'s'}.</p>:null}
  {a.detail&&<p className="mc-card-sub">{a.detail}</p>}
  {state==='cancelled'?<p className="mc-card-sub">{msg}</p>:<div className="mc-card-actions"><button type="button" className="btn coral sm" disabled={working} onClick={give}>{working?'One moment…':'Give it to Bear'}</button><button type="button" className="btn quiet sm" disabled={working} onClick={notNow}>Not now</button></div>}
  {msg&&state!=='cancelled'&&<p className="mc-card-sub" role="alert">{msg}</p>}
 </div>;
 if(a.kind==='responsibility')return <div className="mc-card"><div className="mc-card-head"><span className="mc-card-title">{a.title}</span>{open}</div>{a.detail&&<p className="mc-card-sub">{a.detail}</p>}{a.taskId&&<AddToOutlook taskId={a.taskId}/>}</div>;
 if(a.kind==='proposed_tasks')return <ProposedList a={a}/>;
 if(a.kind==='added')return <div className="mc-card"><p className="mc-card-eyebrow">Saved in Bear Brain</p><ul className="mc-card-list">{(a.items||[a.title]).map((x,i)=><li key={i}>{x}</li>)}</ul>{a.items?.length===1&&open}</div>;
 if(a.kind==='prepared')return <div className="mc-card"><p className="mc-card-eyebrow">Bear prepared this · ready for you to check</p>
  <div className="mc-card-head"><span className="mc-card-title">{a.detail||a.title}</span>{open}</div><p className="mc-card-sub">For: {a.title}</p>
  {!!a.lines?.length&&<ul className="mc-card-list">{a.lines.map((x,i)=><li key={i}>{x}</li>)}</ul>}
  {a.draft&&<Draft d={a.draft}/>}{a.taskId&&<AddToOutlook taskId={a.taskId}/>}
 </div>;
 if(a.kind==='draft'&&a.draft)return <div className="mc-card"><p className="mc-card-eyebrow">Draft · ready for you to check</p>{a.taskId&&<div className="mc-card-head"><span className="mc-card-title">{a.title}</span>{open}</div>}<Draft d={a.draft}/></div>;
 return null;
}
// A draft is not a sent message. Bear can't send email or texts, so the person copies it or opens it in her own app to send.
function Draft({d}:{d:NonNullable<MomentAction['draft']>}){
 const [done,setDone]=useState<string|null>(null);
 const href=d.channel==='email'?`mailto:${encodeURIComponent(d.to&&d.to.includes('@')?d.to:'')}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`:`sms:?&body=${encodeURIComponent(d.body)}`;
 async function copy(){try{await navigator.clipboard.writeText(d.channel==='email'?`${d.subject}\n\n${d.body}`:d.body);setDone('Copied. Paste it wherever you’re sending it.');}catch{setDone('Couldn’t copy on this device. Select the text and copy it.');}}
 return <div className="mc-draft">
  {d.to&&<p className="mc-draft-meta">To: {d.to}</p>}{d.channel==='email'&&d.subject&&<p className="mc-draft-meta">Subject: {d.subject}</p>}
  <p className="mc-draft-body">{d.body}</p>
  <div className="mc-card-actions"><a className="btn ghost sm" href={href} onClick={()=>setDone(d.channel==='email'?'Opened in your Mail app. Bear can’t see whether it was sent.':'Opened in Messages. Bear can’t see whether it was sent.')}>{d.channel==='email'?'Open in Mail':'Open in Messages'}</a><button type="button" className="btn quiet sm" onClick={copy}>Copy</button></div>
  <p className="mc-card-note">{done||'Bear can’t send this for you. You check it and send it.'}</p>
 </div>;
}

// A to-do list Bear proposed: nothing is saved until she approves it. She can untick anything first.
function ProposedList({a}:{a:MomentAction}){
 const items=a.items||[];const [keep,setKeep]=useState<boolean[]>(items.map(()=>true));const [cur,setCur]=useState(a);const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 async function answer(cancel:boolean){setBusy(true);setErr(null);try{const r=await apiSend<{action:MomentAction}>('/api/bear/moment/approve',{actionId:a.id,keep:keep.map((k,i)=>k?i:-1).filter(i=>i>=0),...(cancel?{cancel:true}:{})});setCur(r.action);}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 if(cur.state==='verified_success')return <div className="mc-card"><p className="mc-card-eyebrow">Saved in Bear Brain</p><ul className="mc-card-list">{(cur.items||[]).map((x,i)=><li key={i}>{x}</li>)}</ul><Link href="/bear/brain" className="mc-open">See it in Bear Brain <span aria-hidden="true">›</span></Link></div>;
 if(cur.state==='cancelled')return <div className="mc-card"><p className="mc-card-sub">Not saved. That’s fine.</p></div>;
 return <div className="mc-card"><p className="mc-card-eyebrow">Your list · check it before Bear saves it</p>
  <ul className="mc-checks">{items.map((x,i)=><li key={i}><label><input type="checkbox" checked={keep[i]} onChange={e=>setKeep(k=>k.map((v,j)=>j===i?e.target.checked:v))}/><span>{x}</span></label></li>)}</ul>
  <div className="mc-card-actions"><button type="button" className="btn coral sm" disabled={busy||!keep.some(Boolean)} onClick={()=>answer(false)}>{busy?'Saving…':`Save ${keep.filter(Boolean).length===items.length?'these':keep.filter(Boolean).length}`}</button><button type="button" className="btn quiet sm" disabled={busy} onClick={()=>answer(true)}>Not now</button></div>
  {err&&<p className="mc-card-note" role="alert">{err}</p>}
 </div>;
}
