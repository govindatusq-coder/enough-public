'use client';
// Got a Moment?: three choices, nothing else. Need a Break (an idea just for her), Talk It Out (Bear listens), Finish or share
// a task (one realistic thing from Bear Brain: do it with Bear's help, or ask someone). She chooses; Bear doesn't guess what
// she needs. Sharing adds no extra question: the task card offers both, and "No time? Hand something off" skips the time.
import {useCallback,useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {apiGet,apiSend} from '@/lib/bear/client';
import {mailtoFor,smsFor} from '@/lib/bear/board/help';
import {AppHeader,LabelChip,MamaBear} from './v2';
import {MomentChat} from './moment-chat';
import {ShareBearSheet,useShareBear} from './share-bear';
import {confetti} from './celebrate';

export type GmState='home'|'break_time'|'break_suggestion'|'talk'|'task_time'|'task_suggestion'|'task_action'|'task_complete'|'share_suggestion';
type Idea={id:string;title:string;line:string;minutes:number;icon:string};
type Rec={taskId:string;title:string;label:string;minutes:number;why:string;needsBear:boolean};
type Share={taskId:string;title:string;why:string;dueAt:string|null;dueTime:string|null};
type Detail={id:string;title:string;taskStatus:string;status:string;dueAt:string|null;dueTime:string|null;deadlines:{outcome:string|null};next:{text:string;minutes:number;needsBear:boolean}|null;current:{who:string;text:string}|null;
 prepared:{title:string;lines:string[];links:{label:string;url:string}[];draft?:{to:string;subject:string;body:string}|null;note:string}|null};
interface Saved{stack:GmState[];minutes:number|null;idea:Idea|null;rec:Rec|null;seen:string[];done:string[];share?:Share|null;shareSeen?:string[]}
const KEY='bear-gm-state';
const TIMES=[2,5,10,20];
const svg=(d:React.ReactNode,size=26)=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Ico={
 cup:svg(<><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/></>),
 talk:svg(<><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/><path d="M12 15.2s-3-1.8-3-3.6a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 1.8-3 3.6-3 3.6z" fill="currentColor" stroke="none"/></>),
 check:svg(<><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/></>),
 chevron:svg(<path d="m9 6 6 6-6 6"/>,20),
 back:svg(<path d="m15 6-6 6 6 6"/>,24),
};
const breakIcon:Record<string,React.ReactNode>={tea:Ico.cup,music:svg(<><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></>),walk:svg(<><circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4M7 12l3-4 4 1 3 3"/></>),
 book:svg(<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5"/>),heart:svg(<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>),
 rest:svg(<path d="M20 15.5A8.5 8.5 0 1 1 8.5 4a7 7 0 0 0 11.5 11.5z"/>),create:svg(<><path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="m14 6 3 3"/></>),
 sun:svg(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>),
 air:svg(<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>)};

export function MomentFlow(){
 const [s,setS]=useState<Saved>({stack:['home'],minutes:null,idea:null,rec:null,seen:[],done:[]});
 const [busy,setBusy]=useState(false);const [msg,setMsg]=useState<string|null>(null);
 const [none,setNone]=useState(false);const [detail,setDetail]=useState<Detail|null>(null);const [sharing,setSharing]=useState<{id:string;title:string;due:string|null;dueTime:string|null}|null>(null);const [enjoy,setEnjoy]=useState(false);
 const sb=useShareBear();const restored=useRef(false);const pushed=useRef(0);const cur=s.stack[s.stack.length-1];
 // Coming back to Got a Moment? picks up where she was (except half-way through a task, which goes back to its suggestion).
 useEffect(()=>{queueMicrotask(()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'null') as Saved|null;if(v&&Array.isArray(v.stack)&&v.stack.length){const st=v.stack.filter(x=>x!=='task_action'&&x!=='task_complete');setS({...v,stack:st.length?st:['home']});}}catch{/* fresh */}restored.current=true;});},[]);
 useEffect(()=>{if(restored.current)try{sessionStorage.setItem(KEY,JSON.stringify(s));}catch{/* no storage */}},[s]);
 const go=useCallback((to:GmState,patch:Partial<Saved>={})=>{setMsg(null);setS(v=>({...v,...patch,stack:to==='home'?['home']:[...v.stack.filter(x=>x!==to),to]}));try{history.pushState({gm:to},'');pushed.current++;}catch{/* fine */}window.scrollTo({top:0});},[]);
 const back=useCallback(()=>{setMsg(null);setEnjoy(false);setS(v=>({...v,stack:v.stack.length>1?v.stack.slice(0,-1):['home']}));window.scrollTo({top:0});},[]);
 // The phone's back gesture steps back through the flow, not out of the page.
 useEffect(()=>{const on=()=>{pushed.current=Math.max(0,pushed.current-1);back();};window.addEventListener('popstate',on);return()=>window.removeEventListener('popstate',on);},[back]);
 // The on-screen Back and the phone's back gesture do the same thing.
 const goBack=useCallback(()=>{if(pushed.current>0)history.back();else back();},[back]);

 // ---------- Need a Break ----------
 async function idea(minutes:number,exclude:string[]){setBusy(true);setMsg(null);setEnjoy(false);
  try{const r=await apiSend<{idea:Idea|null}>('/api/bear/moment/break',{minutes,exclude});
   if(!r.idea){if(exclude.length){setS(v=>({...v,seen:[]}));setMsg('That’s all my ideas for that much time. Here’s the first again.');return idea(minutes,[]);}setMsg('Even a minute with your eyes closed counts.');return;}
   go('break_suggestion',{minutes,idea:r.idea,seen:[...exclude,r.idea.id]});}
  catch{setMsg('Bear couldn’t come up with an idea just now. Even a minute with your eyes closed counts.');}
  finally{setBusy(false);}}
 async function soundsGood(){if(!s.idea)return;setEnjoy(true);apiSend('/api/bear/moment/break',{id:s.idea.id,value:'liked'},'PUT').catch(()=>{});}

 // ---------- Finish a Task ----------
 async function task(minutes:number,exclude:string[]){setBusy(true);setMsg(null);setNone(false);
  try{const r=await apiSend<{recommendation:Rec|null}>('/api/bear/rre/moment',{minutes,exclude});
   if(!r.recommendation){setNone(true);go('task_suggestion',{minutes,rec:null,seen:exclude});return;}
   go('task_suggestion',{minutes,rec:r.recommendation,seen:[...exclude,r.recommendation.taskId]});}
  catch{setMsg('Bear couldn’t look at your list just now. Nothing has changed; try again in a moment.');}
  finally{setBusy(false);}}
 // What she chose, kept so we can see whether handing off helps (never her words).
 const feedback=(taskId:string,surface:'finish'|'share',response:'do_it'|'ask_someone'|'another'|'not_now')=>{apiSend('/api/bear/rre/share-pick',{taskId,surface,response},'PUT').catch(()=>{});};
 async function notNowTask(){if(s.rec){feedback(s.rec.taskId,'finish','not_now');apiSend(`/api/bear/rre/${s.rec.taskId}/skip`,{}).catch(()=>{});}go('home');}
 function anotherTask(){if(s.rec)feedback(s.rec.taskId,'finish','another');return task(s.minutes||10,s.seen);}
 // Ask someone straight from the suggestion: Share Bear opens on that task, with her recent helpers.
 async function askFor(taskId:string,surface:'finish'|'share'){setBusy(true);setMsg(null);
  try{const d=await apiGet<Detail>(`/api/bear/rre/${taskId}`);
   if(d.taskStatus!=='open'||d.status==='completed'){setMsg('That one’s already been done.');return;}
   feedback(taskId,surface,'ask_someone');setSharing({id:d.id,title:d.title,due:d.dueAt||d.deadlines.outcome,dueTime:d.dueTime});}
  catch{setMsg('Bear couldn’t open that task just now. Nothing has changed; try again in a moment.');}
  finally{setBusy(false);}}

 // ---------- No time? Hand something off ----------
 async function shareIdea(exclude:string[]){setBusy(true);setMsg(null);
  try{const r=await apiSend<{suggestion:Share|null}>('/api/bear/rre/share-pick',{exclude});
   go('share_suggestion',{share:r.suggestion,shareSeen:r.suggestion?[...exclude,r.suggestion.taskId]:exclude});}
  catch{setMsg('Bear couldn’t look at your list just now. Nothing has changed; try again in a moment.');}
  finally{setBusy(false);}}
 function anotherShare(){if(s.share)feedback(s.share.taskId,'share','another');return shareIdea(s.shareSeen||[]);}
 function notNowShare(){if(s.share)feedback(s.share.taskId,'share','not_now');go('home');}
 async function letsDoIt(){if(!s.rec)return;setBusy(true);setMsg(null);feedback(s.rec.taskId,'finish','do_it');
  try{let d=await apiGet<Detail>(`/api/bear/rre/${s.rec.taskId}`);
   if(d.taskStatus!=='open'||d.status==='completed'){setMsg('That one’s already been done. Here’s another.');return task(s.minutes||10,s.seen);}
   // Bear does its part first (a draft, steps, a shortlist), then it's her turn. Nothing is sent or bought.
   if(d.current?.who==='bear')d=await apiSend<Detail>(`/api/bear/rre/${s.rec.taskId}/give`,{});
   setDetail(d);go('task_action');}
  catch{setMsg('Bear couldn’t open that task just now. Nothing has changed; try again in a moment.');}
  finally{setBusy(false);}}
 async function markDone(e:React.MouseEvent<HTMLButtonElement>){if(!detail)return;const from=e.currentTarget.getBoundingClientRect();setBusy(true);setMsg(null);
  try{await apiSend(`/api/bear/tasks/${detail.id}/complete`,{method:null});confetti({x:from.left+from.width/2,y:from.top});go('task_complete',{done:[...s.done,detail.id]});}
  catch(e){const m=(e as Error).message||'';if(/already/i.test(m))go('task_complete',{done:[...s.done,detail.id]});else setMsg('That didn’t save. Nothing was lost; try again.');}
  finally{setBusy(false);}}

 const backBtn=<button type="button" className="gm-back" onClick={goBack} aria-label="Back">{Ico.back}<span>Back</span></button>;
 const times=(on:(m:number)=>void)=><><div className="gm-times" role="group" aria-label="How much time have you got?">{TIMES.map(m=><button key={m} type="button" className="gm-time" disabled={busy} onClick={()=>on(m)}>{m} min</button>)}</div>
  <button type="button" className="gm-more" disabled={busy} onClick={()=>on(45)}>I’ve got longer</button></>;
 const note=msg?<p className="gm-msg" role="status">{msg}</p>:null;

 if(cur==='talk')return <MomentChat onBack={goBack}/>;
 return <main id="main" className="bear-screen v2-screen gm" data-state={cur}>
  {cur==='home'&&<>
   <AppHeader/>
   <h1 className="gm-title">Got a Moment?</h1>
   <MamaBear className="v2-bear gm-bear"/>
   <p className="gm-headline">What do you need right now?</p>
   <ul className="gm-choices">
    {([['break_time',Ico.cup,'Need a Break','A little time just for you'],['talk',Ico.talk,'Talk It Out','Get something off your chest'],['task_time',Ico.check,'Finish or share a task','Get something off your list']] as const).map(([to,icon,t,sub])=>
     <li key={to}><button type="button" className="gm-choice" onClick={()=>go(to)}><span className="gm-choice-icon">{icon}</span><span className="gm-choice-text"><strong>{t}</strong><span>{sub}</span></span><span className="gm-chev" aria-hidden="true">{Ico.chevron}</span></button></li>)}
   </ul>
  </>}

  {cur==='break_time'&&<>{backBtn}<h1 className="gm-h">Let’s find you a little breathing room.</h1><p className="gm-q">How much time have you got?</p>{times(m=>idea(m,[]))}{note}</>}
  {cur==='break_suggestion'&&s.idea&&<>{backBtn}
   <section className="gm-card" aria-live="polite">
    <span className="gm-card-icon">{breakIcon[s.idea.icon]||Ico.cup}</span>
    <h1 className="gm-card-title">{s.idea.title}</h1><p className="gm-card-line">{s.idea.line}</p>
    {enjoy?<p className="gm-enjoy" role="status">Enjoy it. Everything else can wait.</p>
     :<div className="gm-actions"><button type="button" className="btn coral wide" onClick={soundsGood}>Sounds good</button><button type="button" className="btn ghost wide" disabled={busy} onClick={()=>idea(s.minutes||5,s.seen)}>{busy?'One moment…':'Another idea'}</button><button type="button" className="btn quiet wide" onClick={()=>go('home')}>Not now</button></div>}
    {enjoy&&<button type="button" className="btn quiet wide" onClick={()=>go('home')}>Back to Got a Moment</button>}
   </section>{note}</>}

  {cur==='task_time'&&<>{backBtn}<h1 className="gm-h">Let’s get something off your list.</h1><p className="gm-q">How much time have you got?</p>{times(m=>task(m,s.done))}
   <button type="button" className="gm-handoff" disabled={busy} onClick={()=>shareIdea([])}>No time? Hand something off</button>{note}</>}
  {cur==='task_suggestion'&&<>{backBtn}
   {none||!s.rec?<section className="gm-card" aria-live="polite"><h1 className="gm-card-title">Nothing on your list looks like a good fit for the time you’ve got.</h1>
     <div className="gm-actions"><Link href="/bear/brain" className="btn ghost wide">See my tasks</Link><button type="button" className="btn quiet wide" onClick={()=>go('home')}>Not now</button></div></section>
   :<section className="gm-card" aria-live="polite"><p className="gm-kicker">You could get this sorted.</p><LabelChip label={s.rec.label}/>
     <h1 className="gm-card-title">{s.rec.title}</h1><p className="gm-card-line">{s.rec.why}</p><p className="gm-card-small">About {s.rec.minutes} minute{s.rec.minutes===1?'':'s'} of your time (an estimate).</p>
     <div className="gm-pair"><button type="button" className="btn coral wide" disabled={busy} onClick={letsDoIt}>{busy?'One moment…':'Let’s do it'}</button><button type="button" className="btn coral-line wide" disabled={busy} onClick={()=>askFor(s.rec!.taskId,'finish')}>Ask someone</button></div>
     <div className="gm-actions"><button type="button" className="btn ghost wide" disabled={busy} onClick={anotherTask}>Another task</button><button type="button" className="btn quiet wide" onClick={notNowTask}>Not now</button></div></section>}
   {note}</>}
  {cur==='task_action'&&detail&&<>{backBtn}
   <section className="gm-card gm-do" aria-live="polite">
    <h1 className="gm-card-title">{detail.title}</h1>
    {detail.next&&<p className="gm-card-line"><strong>Next:</strong> {detail.next.text}</p>}
    {detail.prepared&&<div className="gm-prepared"><p className="gm-kicker">Bear has got this ready for you</p><p className="gm-prep-title">{detail.prepared.title}</p>
     {detail.prepared.lines.length>0&&<ul className="gm-lines">{detail.prepared.lines.map((l,i)=><li key={i}>{l}</li>)}</ul>}
     {detail.prepared.draft&&<div className="gm-draft"><p>{detail.prepared.draft.body}</p><div className="gm-row">{detail.prepared.draft.subject?<a className="btn ghost sm" href={mailtoFor(detail.prepared.draft)}>Open in Mail</a>:<a className="btn ghost sm" href={smsFor(detail.prepared.draft)}>Open in Messages</a>}<Link className="btn quiet sm" href={`/bear/help/${detail.id}`}>Edit it</Link></div><p className="gm-card-small">Nothing is sent until you send it.</p></div>}
     {detail.prepared.links.map(l=><a key={l.url} className="btn ghost sm gm-link" href={l.url} target={l.url.startsWith('http')?'_blank':undefined} rel="noopener noreferrer">{l.label}</a>)}</div>}
    <div className="gm-actions"><button type="button" className="btn coral wide" disabled={busy} onClick={markDone}>{busy?'Saving…':'Mark as done'}</button>
     <button type="button" className="btn ghost wide" onClick={()=>setSharing({id:detail.id,title:detail.title,due:detail.dueAt||detail.deadlines.outcome,dueTime:detail.dueTime})}>Ask someone to do it</button>
     <Link href={`/bear/brain/${detail.id}`} className="btn quiet wide">Open the full task</Link></div>
   </section>{note}
  </>}
  {cur==='share_suggestion'&&<>{backBtn}
   {!s.share?<section className="gm-card" aria-live="polite"><h1 className="gm-card-title">Nothing on your list looks easy to hand to someone else right now.</h1>
     <div className="gm-actions"><Link href="/bear/brain" className="btn ghost wide">Choose from Bear Brain</Link><button type="button" className="btn quiet wide" onClick={()=>go('home')}>Not now</button></div></section>
   :<section className="gm-card" aria-live="polite"><p className="gm-kicker">Someone else could take this.</p>
     <h1 className="gm-card-title">{s.share.title}</h1><p className="gm-card-line">{s.share.why}</p>
     <div className="gm-actions"><button type="button" className="btn coral wide" disabled={busy} onClick={()=>askFor(s.share!.taskId,'share')}>{busy?'One moment…':'Ask someone'}</button><button type="button" className="btn ghost wide" disabled={busy} onClick={anotherShare}>Another one</button><button type="button" className="btn quiet wide" onClick={notNowShare}>Not now</button></div>
     <Link href="/bear/brain" className="gm-handoff">Choose from Bear Brain</Link></section>}
   {note}</>}
  {sharing&&<ShareBearSheet task={sharing} state={sb.state} onClose={()=>setSharing(null)} onDone={()=>{sb.reload();setSharing(null);go('home');}}/>}
  {cur==='task_complete'&&<section className="gm-done" role="status" aria-live="polite">
   <svg className="gm-tick" width="96" height="96" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" fill="none" strokeWidth="3"/><path fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" d="m15 27 7 7 15-16"/></svg>
   {detail&&<p className="gm-crossed"><span className="crossed-off">{detail.title}</span></p>}
   <h1 className="gm-h">One less thing on your mind.</h1>
   <div className="gm-actions"><button type="button" className="btn ghost wide" disabled={busy} onClick={()=>task(s.minutes||10,s.done)}>Another task</button><button type="button" className="btn quiet wide" onClick={()=>go('home')}>Back to Got a Moment</button></div>
   {note}
  </section>}
 </main>;
}
