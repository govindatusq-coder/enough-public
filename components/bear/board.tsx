'use client';
// The Brain Dump Board: unload, see, sort, share, do. Any step can be the last; nothing is lost between them.
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import type {BoardTask,BoardView} from '@/lib/bear/board/service';
import type {BearList} from '@/lib/bear/board/logic';
import {Sheet} from '@/components/bear/ui';

export type Say=(text:string,undo?:()=>void)=>void;

// ---------- Unload: one box for typing and talking ----------
type Rec={start():void;stop():void;abort():void;onresult:((e:{resultIndex:number;results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null;continuous:boolean;interimResults:boolean;lang:string};
const DRAFT_KEY='bear-dump-draft';
export function BrainDumpInput({onUnloaded,say}:{onUnloaded:(r:{added:{id:string;title:string}[];already:{id:string;title:string}[]})=>void;say:Say}){
 const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [failed,setFailed]=useState<string|null>(null);
 const [listening,setListening]=useState(false);const [canTalk,setCanTalk]=useState(false);const rec=useRef<Rec|null>(null);const base=useRef('');const via=useRef<'text'|'voice'>('text');
 const box=useRef<HTMLTextAreaElement>(null);
 // What she was typing survives the app closing mid-thought.
 const restored=useRef(false);
 useEffect(()=>{queueMicrotask(()=>{try{const d=localStorage.getItem(DRAFT_KEY);if(d)setText(d);}catch{/* no storage */}restored.current=true;const w=window as unknown as {SpeechRecognition?:new()=>Rec;webkitSpeechRecognition?:new()=>Rec};setCanTalk(!!(w.SpeechRecognition||w.webkitSpeechRecognition));});},[]);
 useEffect(()=>{try{if(text)localStorage.setItem(DRAFT_KEY,text);else if(restored.current)localStorage.removeItem(DRAFT_KEY);}catch{/* no storage */}const el=box.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,320)+'px';}},[text]);
 function talk(){
  if(listening){rec.current?.stop();return;}
  const w=window as unknown as {SpeechRecognition?:new()=>Rec;webkitSpeechRecognition?:new()=>Rec};const R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R)return;
  const r=new R();r.continuous=true;r.interimResults=true;r.lang='en-AU';base.current=text?text.replace(/\s*$/,'\n'):'';let finals='';
  r.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i];if(res.isFinal)finals+=res[0].transcript.trim()+' ';else interim+=res[0].transcript;}setText((base.current+finals+interim).replace(/\s+$/,interim?'':' '));};
  r.onend=()=>{setListening(false);setText(t=>t.trim()?t.trim():'');};
  r.onerror=e=>{setListening(false);if(e.error==='not-allowed')say('Bear needs microphone permission to listen. You can still type, or use the keyboard’s microphone.');};
  rec.current=r;via.current='voice';setListening(true);r.start();
 }
 async function unload(){
  const t=text.trim();if(!t||busy)return;if(listening)rec.current?.stop();
  setBusy(true);setFailed(null);
  try{const r=await apiSend<{added:{id:string;title:string}[];already:{id:string;title:string}[]}>('/api/bear/board/dump',{text:t,via:via.current});setText('');via.current='text';onUnloaded(r);}
  catch(e){setFailed((e as Error).message||'Bear couldn’t take that just now.');}
  finally{setBusy(false);}
 }
 return <section className="dump-box glass-strong" aria-label="Brain dump">
  <label htmlFor="dump-text" className="sr-only">What’s on your mind?</label>
  <textarea id="dump-text" ref={box} value={text} rows={3} onChange={e=>{setText(e.target.value);if(!listening)via.current='text';}} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();unload();}}}
   placeholder="Pay the electricity bill, call the possum man, book the podiatrist…" disabled={busy} maxLength={12000}/>
  <div className="dump-actions">
   {canTalk&&<button type="button" className={`dump-mic${listening?' on':''}`} onClick={talk} aria-pressed={listening} aria-label={listening?'Stop listening':'Speak instead'} disabled={busy}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
    <span>{listening?'Listening… tap to stop':'Speak'}</span></button>}
   <button type="button" className="btn coral sm dump-go" onClick={unload} disabled={busy||!text.trim()}>{busy?'Sorting it out…':'Unload'}</button>
  </div>
  {failed&&<p className="note coral" role="alert" style={{marginTop:10}}>{failed} Your words are still here. <button type="button" className="link-btn" onClick={unload}>Try again</button></p>}
 </section>;
}

// ---------- A checklist row ----------
const lightDot=(l:BoardTask['light'])=>l==='red'?'var(--coral)':l==='amber'?'var(--mustard)':null;
export function TaskRow({task,lists,index,actions,dragging,fresh}:{task:BoardTask;lists:BearList[];index:number;actions:RowActions;dragging:boolean;fresh?:boolean}){
 const [editing,setEditing]=useState(false);const [title,setTitle]=useState(task.title);const [menu,setMenu]=useState(false);
 const sug=task.suggestion?lists.find(l=>l.id===task.suggestion!.listId):null;
 function save(){setEditing(false);const t=title.trim();if(t&&t!==task.title)actions.rename(task,t);else setTitle(task.title);}
 return <li className={`b-row${dragging?' dragging':''}${fresh?' fresh':''}`} data-row={task.id} data-list={task.listId||'inbox'} data-index={index}>
  <button type="button" className="b-check" role="checkbox" aria-checked={false} aria-label={`Done: ${task.title}`} onClick={()=>actions.complete(task)}><span/></button>
  <div className="b-main">
   {editing?<input className="b-edit" value={title} autoFocus maxLength={120} onChange={e=>setTitle(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape'){setTitle(task.title);setEditing(false);}}} aria-label="Edit"/>
   :<button type="button" className="b-title" onClick={()=>{setTitle(task.title);setEditing(true);}} aria-label={`${task.title}. Tap to edit`}>{task.title}</button>}
   <div className="b-meta">
    {lightDot(task.light)&&<i className="b-dot" style={{background:lightDot(task.light)!}} aria-label={task.light==='red'?'Urgent':'Soon'}/>}
    {task.dueAt&&<span>{formatAU(task.dueAt,'short')}{task.dueTime?` · ${task.dueTime}`:''}</span>}
    {task.readiness==='in_progress'&&<Link href={`/bear/help/${task.id}`} className="b-tag">Started · pick up</Link>}
    {task.readiness==='waiting'&&<span className="b-tag">{task.shared?`With ${task.shared.who}`:'Waiting'}</span>}
    {task.shared?.direction==='in'&&<span className="b-tag">From {task.shared.who}</span>}
    {task.shared?.direction==='out'&&task.readiness!=='waiting'&&<span className="b-tag">Shared with {task.shared.who}</span>}
    {sug&&<span className="b-sug"><button type="button" onClick={()=>actions.move(task,sug.id)} aria-label={`${task.suggestion!.by==='learned'?'You usually put this in':'Bear suggests'} ${sug.title}. Move it there`}>{sug.icon} <span className="sug-word">{task.suggestion!.by==='learned'?'Usually':'Suggested'}: </span>{sug.title}</button><button type="button" className="b-sug-x" onClick={()=>actions.ignore(task)} aria-label="Leave it here">×</button></span>}
   </div>
  </div>
  <button type="button" className="b-more" aria-label={`More for ${task.title}`} aria-haspopup="dialog" onClick={()=>setMenu(true)}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
  <span className="b-handle" aria-hidden="true" onPointerDown={e=>actions.dragStart(e,task)}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>
  {menu&&<RowMenu task={task} lists={lists} actions={actions} onClose={()=>setMenu(false)} onEdit={()=>{setMenu(false);setTitle(task.title);setEditing(true);}}/>}
 </li>;
}

function RowMenu({task,lists,actions,onClose,onEdit}:{task:BoardTask;lists:BearList[];actions:RowActions;onClose:()=>void;onEdit:()=>void}){
 const [view,setView]=useState<'main'|'move'|'remind'|'share'>('main');
 const [when,setWhen]=useState('');const [who,setWho]=useState('');const [mode,setMode]=useState<'info'|'action'|'transfer'>('action');const [note,setNote]=useState('');
 const [link,setLink]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 async function share(){setBusy(true);setErr(null);try{const r=await apiSend<{link:string}>('/api/bear/shares',{taskId:task.id,mode,toName:who.trim(),note:note.trim()||null});setLink(r.link);actions.refresh();}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}
 async function sendLink(){if(!link)return;const text=mode==='transfer'?`Could you take over “${task.title}”?`:mode==='action'?`Could you do this: “${task.title}”?`:`For your info: “${task.title}”`;
  try{if(navigator.share){await navigator.share({title:'Load Bear',text,url:link});return;}}catch{/* cancelled */}
  try{await navigator.clipboard.writeText(`${text} ${link}`);actions.say('Link copied. Paste it in a message to them.');}catch{actions.say('Copy this link and send it to them: '+link);}}
 return <Sheet label={task.title} onClose={onClose}>
  <h2 style={{fontSize:19,marginBottom:12}}>{task.title}</h2>
  {view==='main'&&<div className="menu-list">
   <button type="button" onClick={onEdit}>Edit</button>
   <button type="button" onClick={()=>setView('move')}>Move to list</button>
   <Link href={`/bear/help/${task.id}`}>Bear, help me with this</Link>
   {!task.shared||task.shared.direction==='out'?<button type="button" onClick={()=>setView('share')}>Share Bear</button>:null}
   <button type="button" onClick={()=>setView('remind')}>Remind me</button>
   <Link href={`/bear/tasks/${task.id}`}>Details</Link>
   <button type="button" className="danger" onClick={()=>{onClose();actions.remove(task);}}>Delete</button>
  </div>}
  {view==='move'&&<div className="menu-list">
   {lists.map(l=><button type="button" key={l.id} aria-current={task.listId===l.id||undefined} onClick={()=>{onClose();actions.move(task,l.id);}}>{l.icon} {l.title}</button>)}
   <button type="button" aria-current={!task.listId||undefined} onClick={()=>{onClose();actions.move(task,null);}}>🧠 Back to My Brain Dump</button>
  </div>}
  {view==='remind'&&<div style={{display:'grid',gap:12}}>
   <label className="ce-field">When<input type="datetime-local" value={when} onChange={e=>setWhen(e.target.value)}/></label>
   <p className="tiny muted">Only if you want one. Bear won’t nag about anything you don’t ask for.</p>
   <button type="button" className="btn coral sm" disabled={!when||busy} onClick={async()=>{setBusy(true);setErr(null);try{const at=new Date(when);if(!(at.getTime()>Date.now()))throw new Error('Pick a time that is still ahead of you.');await apiSend(`/api/bear/tasks/${task.id}/plan`,{when:at.toISOString(),label:'You asked',key:'custom',followUpIfUnpaid:false});onClose();actions.say(`I’ll remind you ${at.toLocaleString('en-AU',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}.`);}catch(e){setErr((e as Error).message);}finally{setBusy(false);}}}>Set reminder</button>
  </div>}
  {view==='share'&&(link?<div style={{display:'grid',gap:12}}>
   <p className="small">Send this link to {who}. When they open it and say yes, {mode==='transfer'?'it becomes theirs and leaves your lists':mode==='action'?'Bear shows you when they’ve done it':'they can see it'}.</p>
   <button type="button" className="btn coral sm" onClick={sendLink}>Send the link</button>
   <p className="tiny muted" style={{wordBreak:'break-all'}}>{link}</p>
  </div>:<div style={{display:'grid',gap:12}}>
   <label className="ce-field">Who<input value={who} onChange={e=>setWho(e.target.value)} placeholder="James" maxLength={60}/></label>
   <div className="menu-list" role="radiogroup" aria-label="How">
    {([['info','Share information','They can see it. It stays yours.'],['action','Ask them to do it','They do this part. You keep the bigger picture.'],['transfer','Hand it over','It becomes theirs once they accept.']] as const).map(([k,l,d])=>
     <button type="button" key={k} role="radio" aria-checked={mode===k} className={mode===k?'on':''} onClick={()=>setMode(k)}><strong>{l}</strong><span className="tiny muted" style={{display:'block'}}>{d}</span></button>)}
   </div>
   <label className="ce-field">Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></label>
   <button type="button" className="btn coral sm" disabled={!who.trim()||busy} onClick={share}>{busy?'Making the link…':'Make a link to send'}</button>
  </div>)}
  {err&&<p className="note coral" role="alert" style={{marginTop:10}}>{err}</p>}
 </Sheet>;
}

// ---------- The board ----------
export interface RowActions{complete(t:BoardTask):void;rename(t:BoardTask,title:string):void;move(t:BoardTask,listId:string|null,index?:number):void;ignore(t:BoardTask):void;remove(t:BoardTask):void;dragStart(e:React.PointerEvent,t:BoardTask):void;refresh():void;say:Say}

export function useBoardActions(board:BoardView|null,setBoard:(f:(b:BoardView|null)=>BoardView|null)=>void,reload:()=>Promise<unknown>,say:Say){
 const pending=useRef(new Map<string,ReturnType<typeof setTimeout>>());
 const [drag,setDrag]=useState<{id:string;y:number;x:number}|null>(null);
 const local=useCallback((f:(t:BoardTask[])=>BoardTask[])=>setBoard(b=>b?{...b,inbox:f(b.inbox),byList:Object.fromEntries(Object.entries(b.byList).map(([k,v])=>[k,f(v)]))}:b),[setBoard]);
 const fail=useCallback((e:unknown)=>{say((e as Error).message||'That didn’t save. Nothing was lost.');reload();},[say,reload]);
 // A delete waits a few seconds so it can be undone. If the app closes in the meantime it is still carried out.
 useEffect(()=>{const flush=()=>{for(const [id,t] of pending.current){clearTimeout(t);fetch(`/api/bear/tasks/${id}/drop`,{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>{});}pending.current.clear();};window.addEventListener('pagehide',flush);return()=>window.removeEventListener('pagehide',flush);},[]);
 const actions:RowActions={
  say,refresh:()=>{reload();},
  complete(t){local(a=>a.filter(x=>x.id!==t.id));setBoard(b=>b?{...b,doneToday:[{id:t.id,title:t.title},...b.doneToday]}:b);
   apiSend(`/api/bear/tasks/${t.id}/complete`,{method:null}).then(()=>say(`Done: ${t.title}`,()=>apiSend(`/api/bear/tasks/${t.id}/reopen`,{}).then(()=>reload()).catch(fail))).catch(fail);},
  rename(t,title){local(a=>a.map(x=>x.id===t.id?{...x,title}:x));apiSend(`/api/bear/tasks/${t.id}`,{title},'PATCH').catch(fail);},
  move(t,listId,index){
   setBoard(b=>{if(!b)return b;const strip=(a:BoardTask[])=>a.filter(x=>x.id!==t.id);const moved={...t,listId,suggestion:listId?null:t.suggestion};
    const inbox=strip(b.inbox);const byList=Object.fromEntries(Object.entries(b.byList).map(([k,v])=>[k,strip(v)]));
    const target=listId?byList[listId]:inbox;target.splice(index??target.length,0,moved);return {...b,inbox,byList};});
   apiSend(`/api/bear/board/tasks/${t.id}/move`,{listId,...(index!==undefined?{index}:{})}).then(()=>{if(listId!==t.listId){const l=board?.lists.find(x=>x.id===listId);say(l?`Moved to ${l.icon} ${l.title}`:'Back in My Brain Dump',()=>actions.move({...t,listId},t.listId));}}).catch(fail);},
  ignore(t){local(a=>a.map(x=>x.id===t.id?{...x,suggestion:null}:x));apiSend(`/api/bear/board/tasks/${t.id}/ignore`,{}).catch(fail);},
  remove(t){local(a=>a.filter(x=>x.id!==t.id));
   const timer=setTimeout(()=>{pending.current.delete(t.id);apiSend(`/api/bear/tasks/${t.id}/drop`,{}).catch(fail);},6000);pending.current.set(t.id,timer);
   say(`Deleted: ${t.title}`,()=>{const p=pending.current.get(t.id);if(p){clearTimeout(p);pending.current.delete(t.id);}reload();});},
  dragStart(e,t){
   e.preventDefault();const el=e.currentTarget as HTMLElement;el.setPointerCapture?.(e.pointerId);setDrag({id:t.id,x:e.clientX,y:e.clientY});
   const row=el.closest('.b-row') as HTMLElement|null;const startY=e.clientY;
   const over=(x:number,y:number)=>{document.querySelectorAll('.drop-on').forEach(n=>n.classList.remove('drop-on'));if(row)row.style.visibility='hidden';const hit=document.elementFromPoint(x,y) as HTMLElement|null;if(row)row.style.visibility='';return hit;};
   const move=(ev:PointerEvent)=>{if(row)row.style.transform=`translateY(${ev.clientY-startY}px)`;const hit=over(ev.clientX,ev.clientY);(hit?.closest('[data-row]')||hit?.closest('[data-drop]'))?.classList.add('drop-on');};
   const up=(ev:PointerEvent)=>{
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
    if(row)row.style.transform='';const hit=over(ev.clientX,ev.clientY);document.querySelectorAll('.drop-on').forEach(n=>n.classList.remove('drop-on'));setDrag(null);
    const r=hit?.closest('[data-row]') as HTMLElement|null;const d=hit?.closest('[data-drop]') as HTMLElement|null;
    if(r&&r.dataset.row!==t.id){const l=r.dataset.list==='inbox'?null:r.dataset.list!;actions.move(t,l,Number(r.dataset.index));}
    else if(!r&&d){const l=d.dataset.drop==='inbox'?null:d.dataset.drop!;if(l!==t.listId)actions.move(t,l);}
   };
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  },
 };
 return {actions,dragging:drag?.id||null};
}

export function AddRow({listId,onAdded,say}:{listId:string|null;onAdded:()=>void;say:Say}){
 const [v,setV]=useState('');const [busy,setBusy]=useState(false);
 async function add(){const t=v.trim();if(!t)return;setBusy(true);try{await apiSend('/api/bear/board/add',{title:t,listId});setV('');onAdded();}catch(e){say((e as Error).message);}finally{setBusy(false);}}
 return <li className="b-row add"><span className="b-plus" aria-hidden="true">+</span><input value={v} onChange={e=>setV(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')add();}} placeholder="Add one" aria-label="Add one" maxLength={120} disabled={busy}/>{v.trim()&&<button type="button" className="link-btn" onClick={add} disabled={busy}>Add</button>}</li>;
}

// ---------- "I've got a moment" ----------
interface Pick{taskId:string;title:string;minutes:number;why:string|null}
export function MomentPicker({onDone}:{onDone:(id:string,title:string)=>void}){
 const [res,setRes]=useState<{minutes:number;picks:Pick[];heldBack:string|null}|null>(null);const [busy,setBusy]=useState<number|null>(null);
 async function ask(m:number){setBusy(m);try{setRes(await apiSend('/api/bear/board/moment',{minutes:m}));}catch{setRes({minutes:m,picks:[],heldBack:null});}finally{setBusy(null);}}
 return <section className="moment glass" aria-label="When I have a moment">
  <div className="moment-row"><span className="small" style={{fontWeight:600}}>Got a moment?</span>
   <div className="chips" style={{gap:6}}>{[[5,'5 min'],[10,'10 min'],[20,'20 min'],[60,'Some time']].map(([m,l])=><button key={m} type="button" className="chip" aria-pressed={res?.minutes===m} disabled={busy!==null} onClick={()=>ask(m as number)}>{l}</button>)}</div></div>
  {res&&<div className="moment-out" aria-live="polite">
   {res.picks.length?<><p className="small">{res.minutes>=60?'Here’s what you could tackle':`You’ve got ${res.minutes} minutes. Here ${res.picks.length===1?'is one thing':`are ${res.picks.length===2?'two':'three'} things`} you could tackle`}. Only if you feel like it.</p>
    <ul className="b-list">{res.picks.map(p=><li key={p.taskId} className="b-row"><button type="button" className="b-check" role="checkbox" aria-checked={false} aria-label={`Done: ${p.title}`} onClick={()=>{onDone(p.taskId,p.title);setRes(r=>r?{...r,picks:r.picks.filter(x=>x.taskId!==p.taskId)}:r);}}><span/></button><div className="b-main"><Link href={`/bear/help/${p.taskId}`} className="b-title">{p.title}</Link><div className="b-meta"><span>about {p.minutes} min</span>{p.why&&<span className="b-tag">{p.why}</span>}</div></div></li>)}</ul>
    <Link href={`/bear/help/${res.picks[0].taskId}`} className="btn ghost sm" style={{marginTop:8}}>Help me with the first one</Link></>
   :<p className="small">Nothing on your lists fits {res.minutes>=60?'right now':`${res.minutes} minutes`} and can be done right now. That’s fine.</p>}
   {res.heldBack&&<p className="tiny muted" style={{marginTop:6}}>{res.heldBack}</p>}
  </div>}
 </section>;
}
