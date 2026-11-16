'use client';
// The Brain Dump Board: unload, see, sort, share, do. Any step can be the last; nothing is lost between them.
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import type {BoardTask,BoardView} from '@/lib/bear/board/service';
import type {BearList} from '@/lib/bear/board/logic';
import {Sheet} from '@/components/bear/ui';
import {mailtoFor,smsFor} from '@/lib/bear/board/help';

export type Say=(text:string,undo?:()=>void)=>void;

// ---------- Unload: one box for typing and talking ----------
type Rec={start():void;stop():void;abort():void;onresult:((e:{resultIndex:number;results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>})=>void)|null;onend:(()=>void)|null;onerror:((e:{error:string})=>void)|null;continuous:boolean;interimResults:boolean;lang:string};
const DRAFT_KEY='bear-dump-draft';
export function BrainDumpInput({onUnloaded,say,placeholder='Brain dump it here…',card=false,onFiles,filesBusy=false}:{onUnloaded:(r:{added:{id:string;title:string}[];already:{id:string;title:string}[];tip?:{taskId:string;text:string}|null})=>void;say:Say;placeholder?:string;card?:boolean;onFiles?:(files:File[])=>void;filesBusy?:boolean}){
 const fileRef=useRef<HTMLInputElement>(null);
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
  try{const r=await apiSend<{added:{id:string;title:string}[];already:{id:string;title:string}[];tip?:{taskId:string;text:string}|null}>('/api/bear/board/dump',{text:t,via:via.current});setText('');via.current='text';onUnloaded(r);}
  catch(e){setFailed((e as Error).message||'Bear couldn’t take that just now.');}
  finally{setBusy(false);}
 }
 // One box, like the design: type or talk, then the arrow. It grows as she writes more than a line.
 return <section className={card?'drop-card':`dump-box${text.includes('\n')||text.length>34?' tall':''}`} aria-label="Drop it here">
  <label htmlFor="dump-text" className="sr-only">What’s on your mind?</label>
  <textarea id="dump-text" ref={box} value={text} rows={1} onChange={e=>{setText(e.target.value);if(!listening)via.current='text';}} onKeyDown={e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();unload();}}}
   placeholder={listening?'Listening…':placeholder} disabled={busy} maxLength={12000}/>
  {card&&<span className="drop-spacer" aria-hidden="true"/>}
  {onFiles&&<><input ref={fileRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={e=>{const f=[...(e.target.files||[])];e.target.value='';if(f.length)onFiles(f);}}/>
   <button type="button" className="dump-mic drop-attach" onClick={()=>fileRef.current?.click()} aria-label="Add a photo or PDF" disabled={busy||filesBusy}>
    {filesBusy?<span className="dots" aria-hidden="true"><i/><i/><i/></span>:<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="M21 17l-5-5-9 8"/></svg>}</button></>}
  {canTalk&&<button type="button" className={`dump-mic${listening?' on':''}`} onClick={talk} aria-pressed={listening} aria-label={listening?'Stop listening':'Speak instead'} disabled={busy}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>}
  <button type="button" className="dump-go" onClick={unload} disabled={busy||!text.trim()} aria-label={busy?'Sorting it out':'Unload'}>
   {busy?<span className="dots" aria-hidden="true"><i/><i/><i/></span>:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}
   <span className="sr-only">{busy?'Sorting it out…':'Unload'}</span></button>
  {failed&&<p className="note coral dump-fail" role="alert">{failed} Your words are still here. <button type="button" className="link-btn" onClick={unload}>Try again</button></p>}
 </section>;
}

// ---------- A checklist row ----------
const lightDot=(l:BoardTask['light'])=>l==='red'?'var(--coral)':l==='amber'?'var(--mustard)':null;
export function TaskRow({task,lists,index,count,actions,dragging,fresh,detailHref,meta}:{task:BoardTask;lists:BearList[];index:number;count:number;actions:RowActions;dragging:boolean;fresh?:boolean;detailHref?:string;meta?:string|null}){
 // Reorder from the keyboard: arrow keys on the handle. Focus follows the row to its new place.
 const nudge=(d:-1|1)=>{const to=index+d;if(to<0||to>=count)return;actions.move(task,task.listId,to);actions.say(`Moved ${d<0?'up':'down'}: ${task.title}`);requestAnimationFrame(()=>requestAnimationFrame(()=>(document.querySelector(`[data-row="${task.id}"] .b-handle`) as HTMLElement|null)?.focus()));};
 const [editing,setEditing]=useState(false);const [title,setTitle]=useState(task.title);const [menu,setMenu]=useState(false);
 function save(){setEditing(false);const t=title.trim();if(t&&t!==task.title)actions.rename(task,t);else setTitle(task.title);}
 return <li className={`b-row${dragging?' dragging':''}${fresh?' fresh':''}`} data-row={task.id} data-list={task.listId||'inbox'} data-index={index}>
  <button type="button" className="b-check" role="checkbox" aria-checked={false} aria-label={`Done: ${task.title}`} onClick={()=>actions.complete(task)}><span/></button>
  <div className="b-main">
   {editing?<input className="b-edit" value={title} autoFocus maxLength={120} onChange={e=>setTitle(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter')save();if(e.key==='Escape'){setTitle(task.title);setEditing(false);}}} aria-label="Edit"/>
   :<button type="button" className="b-title" onClick={()=>{setTitle(task.title);setEditing(true);}} aria-label={`${task.title}. Tap to edit`}>{task.title}</button>}
   <div className="b-meta">
    {lightDot(task.light)&&<i className="b-dot" style={{background:lightDot(task.light)!}} aria-label={task.light==='red'?'Urgent':'Soon'}/>}
    {task.dueAt&&<span>{formatAU(task.dueAt,'short')}{task.dueTime?` · ${task.dueTime}`:''}</span>}
    {meta&&<span>{meta}</span>}
    {task.readiness==='in_progress'&&<Link href={`/bear/help/${task.id}`} className="b-tag">Started · pick up</Link>}
    {task.readiness==='waiting'&&<span className="b-tag">{task.shared?`With ${task.shared.who}`:'Waiting'}</span>}
    {task.shared?.direction==='in'&&<span className="b-tag">From {task.shared.who}</span>}
    {task.shared?.direction==='out'&&task.readiness!=='waiting'&&<span className="b-tag">Shared with {task.shared.who}</span>}
   </div>
  </div>
  {detailHref&&<Link href={detailHref} className="b-more b-detail" aria-label={`Open ${task.title}`}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></Link>}
  <button type="button" className="b-more" aria-label={`More for ${task.title}`} aria-haspopup="dialog" onClick={()=>setMenu(true)}>
   <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
  <button type="button" className="b-handle" aria-label={`Reorder ${task.title}. Use the up and down arrow keys`} onPointerDown={e=>actions.dragStart(e,task)} onKeyDown={e=>{if(e.key==='ArrowUp'){e.preventDefault();nudge(-1);}else if(e.key==='ArrowDown'){e.preventDefault();nudge(1);}}}>
   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></button>
  {menu&&<RowMenu task={task} lists={lists} actions={actions} canUp={index>0} canDown={index<count-1} onNudge={d=>{setMenu(false);nudge(d);}} onClose={()=>setMenu(false)} onEdit={()=>{setMenu(false);setTitle(task.title);setEditing(true);}}/>}
 </li>;
}

type Person={id:string;name:string;email:string|null;phone:string|null;joined?:boolean};
function RowMenu({task,lists,actions,onClose,onEdit,canUp,canDown,onNudge}:{task:BoardTask;lists:BearList[];actions:RowActions;onClose:()=>void;onEdit:()=>void;canUp:boolean;canDown:boolean;onNudge:(d:-1|1)=>void}){
 const [people,setPeople]=useState<Person[]>([]);
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
   {canUp&&<button type="button" onClick={()=>onNudge(-1)}>Move up</button>}
   {canDown&&<button type="button" onClick={()=>onNudge(1)}>Move down</button>}
   <Link href={`/bear/help/${task.id}`}>Bear, help me with this</Link>
   {!task.shared||task.shared.direction==='out'?<button type="button" onClick={()=>{setView('share');apiGet<{people:Person[]}>('/api/bear/board/household').then(r=>setPeople(r.people)).catch(()=>{});}}>Share Bear</button>:null}
   <button type="button" onClick={()=>setView('remind')}>Remind me</button>
   <Link href={`/bear/brain/${task.id}`}>Details</Link>
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
   {(()=>{const p=people.find(x=>x.name.toLowerCase()===who.trim().toLowerCase());const text=`${mode==='transfer'?`Could you take over “${task.title}”?`:mode==='action'?`Could you do this: “${task.title}”?`:`For your info: “${task.title}”`} ${link}`;
    return <div className="btn-row" style={{marginTop:0}}>
     {p?.email&&<a className="btn coral sm" href={mailtoFor({to:p.email,subject:`Load Bear: ${task.title}`,body:text})}>Email it to {p.name}</a>}
     {p?.phone&&<a className={`btn ${p.email?'ghost':'coral'} sm`} href={smsFor({to:p.phone,body:text})}>Text it to {p.name}</a>}
     <button type="button" className={`btn ${p?.email||p?.phone?'ghost':'coral'} sm`} onClick={sendLink}>{p?.email||p?.phone?'Other ways':'Send the link'}</button>
    </div>;})()}
   <p className="tiny muted" style={{wordBreak:'break-all'}}>{link}</p>
  </div>:<div style={{display:'grid',gap:12}}>
   {people.length>0&&<div className="chips" role="group" aria-label="Your household" style={{gap:6}}>{people.map(p=><button type="button" key={p.id} className="chip" aria-pressed={who.trim().toLowerCase()===p.name.toLowerCase()} onClick={()=>setWho(p.name)}>{p.name}{p.joined?' ✓':''}</button>)}</div>}
   <label className="ce-field">{people.length?'Or someone else':'Who'}<input value={who} onChange={e=>setWho(e.target.value)} placeholder="James" maxLength={60}/></label>
   <div className="menu-list" role="radiogroup" aria-label="How">
    {([['info','Share information','They can see it. It stays yours.'],['action','Ask them to do it','They do this part. You keep the bigger picture.'],['transfer','Hand it over','It becomes theirs once they accept.']] as const).map(([k,l,d])=>
     <button type="button" key={k} role="radio" aria-checked={mode===k} className={mode===k?'on':''} onClick={()=>setMode(k)}><strong>{l}</strong><span className="tiny muted" style={{display:'block'}}>{d}</span></button>)}
   </div>
   <label className="ce-field">Note (optional)<input value={note} onChange={e=>setNote(e.target.value)} maxLength={500}/></label>
   <button type="button" className="btn coral sm" disabled={!who.trim()||busy} onClick={share}>{busy?'Making the link…':'Make a link to send'}</button>
   <Link href="/bear/me/household" className="tiny link-btn">Edit your household</Link>
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
export function MomentPicker({onDone,open,onToggle}:{onDone:(id:string,title:string)=>void;open:boolean;onToggle:()=>void}){
 const [res,setRes]=useState<{minutes:number;picks:Pick[];heldBack:string|null}|null>(null);const [busy,setBusy]=useState<number|null>(null);
 async function ask(m:number){setBusy(m);try{setRes(await apiSend('/api/bear/board/moment',{minutes:m}));}catch{setRes({minutes:m,picks:[],heldBack:null});}finally{setBusy(null);}}
 return <section className="moment home-card" aria-label="When I have a moment">
  <button type="button" className="home-card-head" aria-expanded={open} onClick={onToggle}>
   <span className="home-card-icon moment-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M12 2.5V6M18.5 6.5l1.5-1.5"/></svg></span>
   <span className="home-card-text"><strong>Got a moment?</strong><span>Find something you can tackle now</span></span>
   <span className={`home-chev${open?' up':''}`} aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
  </button>
  {open&&<div className="moment-row">
   <div className="chips" style={{gap:6}}>{[[5,'5 min'],[10,'10 min'],[20,'20 min'],[60,'Some time']].map(([m,l])=><button key={m} type="button" className="chip" aria-pressed={res?.minutes===m} disabled={busy!==null} onClick={()=>ask(m as number)}>{l}</button>)}</div></div>}
  {open&&res&&<div className="moment-out" aria-live="polite">
   {res.picks.length?<><p className="small">{res.minutes>=60?'Here’s what you could tackle':`You’ve got ${res.minutes} minutes. Here ${res.picks.length===1?'is one thing':`are ${res.picks.length===2?'two':'three'} things`} you could tackle`}. Only if you feel like it.</p>
    <ul className="b-list">{res.picks.map(p=><li key={p.taskId} className="b-row"><button type="button" className="b-check" role="checkbox" aria-checked={false} aria-label={`Done: ${p.title}`} onClick={()=>{onDone(p.taskId,p.title);setRes(r=>r?{...r,picks:r.picks.filter(x=>x.taskId!==p.taskId)}:r);}}><span/></button><div className="b-main"><Link href={`/bear/help/${p.taskId}`} className="b-title">{p.title}</Link><div className="b-meta"><span>about {p.minutes} min</span>{p.why&&<span className="b-tag">{p.why}</span>}</div></div></li>)}</ul>
    <Link href={`/bear/help/${res.picks[0].taskId}`} className="btn ghost sm" style={{marginTop:8}}>Help me with the first one</Link></>
   :<p className="small">Nothing on your lists fits {res.minutes>=60?'right now':`${res.minutes} minutes`} and can be done right now. That’s fine.</p>}
   {res.heldBack&&<p className="tiny muted" style={{marginTop:6}}>{res.heldBack}</p>}
  </div>}
 </section>;
}

// ---------- "Bear sorts, you check" ----------
// Bear puts its guesses into lists in one go, grouped so she can glance over them. Untick anything wrong: it stays in
// My Brain Dump and Bear stops suggesting it. Nothing moves until she says "Looks right", and Undo puts it all back.
export function BearSortSheet({board,onClose,onSorted}:{board:BoardView;onClose:()=>void;onSorted:(r:{moved:{taskId:string;listId:string;suggestion:BoardTask['suggestion']}[];skipped:{taskId:string;suggestion:BoardTask['suggestion']}[]})=>void}){
 const guessed=board.inbox.filter(t=>t.suggestion&&board.lists.some(l=>l.id===t.suggestion!.listId));const unsure=board.inbox.filter(t=>!guessed.includes(t));
 const [keep,setKeep]=useState<Record<string,boolean>>(()=>Object.fromEntries(guessed.map(t=>[t.id,true])));
 const [busy,setBusy]=useState(false);const [err,setErr]=useState<string|null>(null);
 const yes=guessed.filter(t=>keep[t.id]).length;
 async function go(){setBusy(true);setErr(null);
  try{const r=await apiSend<{moved:{taskId:string;listId:string;suggestion:BoardTask['suggestion']}[];skipped:{taskId:string;suggestion:BoardTask['suggestion']}[]}>('/api/bear/board/sort',{moves:guessed.filter(t=>keep[t.id]).map(t=>({taskId:t.id,listId:t.suggestion!.listId})),skip:guessed.filter(t=>!keep[t.id]).map(t=>t.id)});onSorted(r);}
  catch(e){setErr((e as Error).message);setBusy(false);}}
 return <Sheet label="Bear sorted these" onClose={onClose}>
  <h2 style={{fontSize:20}}>{guessed.length?`Bear sorted ${guessed.length} of ${board.inbox.length}`:'Bear isn’t sure about these'}</h2>
  {guessed.length>0&&<p className="small muted" style={{marginTop:4}}>Untick anything that’s wrong. It stays in My Brain Dump.</p>}
  <div className="sort-groups">
   {board.lists.map(l=>{const items=guessed.filter(t=>t.suggestion!.listId===l.id);if(!items.length)return null;
    return <div key={l.id} className="sort-group"><p className="sort-list"><span aria-hidden="true">{l.icon}</span> {l.title}</p>
     <ul className="b-list">{items.map(t=><li key={t.id} className="b-row sort-row"><button type="button" className={`b-check${keep[t.id]?' on':''}`} role="checkbox" aria-checked={!!keep[t.id]} aria-label={`${t.title}: put in ${l.title}`} onClick={()=>setKeep(k=>({...k,[t.id]:!k[t.id]}))}><span/></button>
      <div className="b-main"><span className="b-title" style={keep[t.id]?undefined:{color:'var(--ink-3)'}}>{t.title}</span>{t.suggestion!.by==='learned'&&<span className="tiny muted">Where you usually put these</span>}</div></li>)}</ul></div>;})}
  </div>
  {unsure.length>0&&<p className="small muted sort-unsure">Not sure: {unsure.map(t=>t.title).join(', ')}. {unsure.length===1?'It stays':'They stay'} in My Brain Dump.</p>}
  {err&&<p className="note coral" role="alert" style={{marginTop:10}}>{err}</p>}
  <div className="btn-row" style={{marginTop:16}}>
   {guessed.length>0&&<button type="button" className="btn coral" disabled={busy} onClick={go}>{busy?'Sorting…':yes===guessed.length?'Looks right':yes?`Sort these ${yes}`:'Leave them all'}</button>}
   <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>Not now</button>
  </div>
 </Sheet>;
}
