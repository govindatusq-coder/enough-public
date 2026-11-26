'use client';
// Bear Brain: everything Bear is remembering, preparing, coordinating and helping resolve. Oversight, not a task system.
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {apiGet} from '@/lib/bear/client';
import {formatAU} from '@/lib/bear/domain/dates';
import type {BoardTask,BoardView} from '@/lib/bear/board/service';
import type {BrainItem} from '@/lib/bear/rre/service';
import {ErrorCard,Skeleton} from '@/components/bear/ui';
import {Swipe,TaskRow,useBoardActions,type Say} from '@/components/bear/board';
import {Icon} from '@/components/bear/v2';
import {useShareBear} from '@/components/bear/share-bear';

interface Brain{total:number;waiting:number;priority:BrainItem[];categories:{id:string;title:string;icon:string;items:BrainItem[]}[]}
const tint:Record<string,string>={night:'#ECE8FB',calls:'#E3F3EE',followup:'#FFE9DE',spare:'#FFF3D6',week:'#E3F0FB',aspire:'#E6F4E1'};
const dotColour={red:'var(--coral)',amber:'#F0A030',green:'#3FA77A',grey:'#A9B4C2'};
const whenText=(i:BrainItem)=>[i.domain,i.reason||(i.when?formatAU(i.when,'short'):null)||(i.status==='waiting'?'Waiting':null)].filter(Boolean).join(' · ');
type Filter='all'|'attention'|'waiting'|'check';
export default function BearBrain(){
 const router=useRouter();
 const [brain,setBrain]=useState<Brain|null>(null);const [board,setBoard]=useState<BoardView|null>(null);const [err,setErr]=useState<string|null>(null);
 const [open,setOpen]=useState<Record<string,boolean>>({});const [filter,setFilter]=useState<Filter>('all');
 // Both fold away until tapped: the full list of everything, and Priority Actions.
 const [allOpen,setAllOpen]=useState(false);const [prioOpen,setPrioOpen]=useState(false);const [sharedOpen,setSharedOpen]=useState(false);const sb=useShareBear();
 const [searching,setSearching]=useState(false);const [q,setQ]=useState('');
 const [toast,setToast]=useState<{text:string;undo?:()=>void;key:number}|null>(null);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const load=useCallback(()=>Promise.all([apiGet<Brain>('/api/bear/rre/brain'),apiGet<{onboarding?:boolean;board?:BoardView}>('/api/bear/board')]).then(([b,bd])=>{if(bd.onboarding){router.replace('/bear/onboarding');return;}setBrain(b);setBoard(bd.board||null);setErr(null);})
  .catch(e=>{const x=e as {status?:number;message:string};if(x.status===401)router.replace('/bear/signin');else setErr(x.message);}),[router]);
 useEffect(()=>{load();},[load]);
 // My Wins: just the count, as a small link at the bottom.
 const [wins,setWins]=useState<number|null>(null);useEffect(()=>{apiGet<{total:number}>('/api/bear/wins/summary').then(w=>setWins(w.total)).catch(()=>{});},[]);
 const say:Say=useCallback((text,undo)=>{if(timer.current)clearTimeout(timer.current);setToast({text,undo,key:Date.now()});timer.current=setTimeout(()=>setToast(null),undo?6000:3500);},[]);
 const {actions,dragging}=useBoardActions(board,setBoard,load,say);
 const byId=useMemo(()=>{const m=new Map<string,BoardTask>();if(board){for(const t of board.inbox)m.set(t.id,t);for(const l of Object.values(board.byList))for(const t of l)m.set(t.id,t);}return m;},[board]);
 if(err&&!brain)return <main id="main" className="bear-screen"><ErrorCard message={err} retry={load}/></main>;
 if(!brain||!board)return <main id="main" className="bear-screen"><Skeleton/></main>;
 const all=brain.categories.flatMap(c=>c.items).filter(i=>byId.has(i.id));
 const counts={all:all.length,attention:brain.priority.filter(i=>byId.has(i.id)).length,waiting:all.filter(i=>i.status==='waiting').length,check:all.filter(i=>i.status==='awaiting_approval').length};
 const term=q.trim().toLowerCase();
 const listed=filter==='attention'?brain.priority.filter(i=>byId.has(i.id)):filter==='waiting'?all.filter(i=>i.status==='waiting'):filter==='check'?all.filter(i=>i.status==='awaiting_approval'):all;
 const found=term?all.filter(i=>i.title.toLowerCase().includes(term)):null;
 const prio=brain.priority.filter(i=>byId.has(i.id));
 const catOf=new Map(brain.categories.flatMap(c=>c.items.map(i=>[i.id,c] as const)));
 const row=(i:BrainItem,withCat=false)=><Swipe key={i.id} label={i.title} onDelete={()=>{const t=byId.get(i.id);if(t)actions.remove(t);}}><Link href={`/bear/brain/${i.id}`} className="v2-prow"><i className="v2-dot" style={{background:dotColour[i.dot]}} aria-hidden="true"/><span className="v2-prow-main"><strong>{i.title}</strong><span>{withCat&&catOf.get(i.id)?`${catOf.get(i.id)!.icon} ${catOf.get(i.id)!.title} · `:''}{whenText(i)}</span></span><span className="v2-chev" aria-hidden="true">{Icon.chevron()}</span></Link></Swipe>;
 return <main id="main" className="bear-screen v2-screen brain-screen">
  <header className="v2-brain-head">
   <span className="v2-brain-icon" aria-hidden="true">{Icon.brain(28)}</span>
   <div className="v2-brain-titles"><h1>Bear Brain</h1><p>All your tasks, plans and progress.</p></div>
   <button type="button" className="v2-icon-btn" aria-label="Search" aria-expanded={searching} onClick={()=>{setSearching(s=>!s);setQ('');}}>{Icon.search()}</button>
   <Link href="/bear/me" className="v2-icon-btn" aria-label="Settings and categories">{Icon.sliders()}</Link>
  </header>
  {searching&&<input className="v2-search" autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search everything Bear is holding" aria-label="Search"/>}
  {found?<section className="v2-card" aria-label="Search results">{found.length?<ul className="v2-plist">{found.map(i=>row(i,true))}</ul>:<p className="faint" style={{padding:'14px 4px'}}>Nothing matches that.</p>}</section>:<>
   <section className="v2-card v2-fold">
    <button type="button" className="v2-fold-head" aria-expanded={allOpen} onClick={()=>setAllOpen(o=>!o)}><span>All Tasks ({counts.all})</span><span className={`v2-chev${allOpen?' down':''}`} aria-hidden="true">{Icon.chevron()}</span></button>
    {allOpen&&<>
     <div className="v2-filters" role="radiogroup" aria-label="Show">{([['all',`All (${counts.all})`],['attention',`Needs attention (${counts.attention})`],['check',`Ready to check (${counts.check})`],['waiting',`Waiting (${counts.waiting})`]] as [Filter,string][]).map(([k,l])=><button key={k} type="button" role="radio" aria-checked={filter===k} className={`chip${filter===k?' on':''}`} onClick={()=>setFilter(k)}>{l}</button>)}</div>
     {listed.length?<ul className="v2-plist">{listed.map(i=>row(i,true))}</ul>:<p className="faint" style={{padding:'8px 4px 12px'}}>Nothing here right now.</p>}
    </>}
   </section>
   <section className="v2-card v2-fold" aria-labelledby="pa-h">
    <button type="button" className="v2-fold-head" aria-expanded={prioOpen} onClick={()=>setPrioOpen(o=>!o)}><span id="pa-h">Priority Actions{prio.length?` (${prio.length})`:''}</span><span className={`v2-chev${prioOpen?' down':''}`} aria-hidden="true">{Icon.chevron()}</span></button>
    {prioOpen&&(prio.length?<ul className="v2-plist">{prio.map(i=>row(i))}</ul>:<p className="faint" style={{padding:'4px 4px 12px'}}>Nothing needs your attention right now.</p>)}
   </section>
   {!!sb.state?.requests.length&&<section className="v2-card v2-fold" aria-labelledby="sw-h">
    <button type="button" className="v2-fold-head" aria-expanded={sharedOpen} onClick={()=>setSharedOpen(o=>!o)}><span id="sw-h">Shared with others ({sb.state.requests.filter(r=>!['CANCELLED'].includes(r.status)).length})</span><span className={`v2-chev${sharedOpen?' down':''}`} aria-hidden="true">{Icon.chevron()}</span></button>
    {sharedOpen&&<ul className="v2-plist">{sb.state.requests.filter(r=>r.status!=='CANCELLED').map(r=><li key={r.id}><Link href={`/bear/brain/${r.taskId}`} className="v2-prow"><i className="v2-dot" style={{background:r.status==='ACCEPTED'?'#3FA77A':r.status==='COMPLETED'?'#A9B4C2':['DECLINED','UNABLE_TO_COMPLETE','EXPIRED','SEND_FAILED'].includes(r.status)?'var(--coral)':'#F0A030'}} aria-hidden="true"/><span className="v2-prow-main"><strong>{r.to}</strong><span>{r.title} · {['DECLINED','UNABLE_TO_COMPLETE','EXPIRED','SEND_FAILED'].includes(r.status)?'Needs attention':r.label}</span></span><span className="v2-chev" aria-hidden="true">{Icon.chevron()}</span></Link></li>)}</ul>}
   </section>}
   <h2 className="v2-h2 v2-h2-out">By Category</h2>
   {brain.categories.map(c=>{const items=c.items.filter(i=>byId.has(i.id));const isOpen=!!open[c.id];return <section key={c.id} className="v2-cat" data-drop={c.id} style={{['--cat' as string]:tint[c.id]||'#EEF1F5'}}>
    <button type="button" className="v2-cat-head" aria-expanded={isOpen} onClick={()=>setOpen(o=>({...o,[c.id]:!o[c.id]}))}>
     <span className="v2-cat-icon" aria-hidden="true">{c.icon}</span><span className="v2-cat-title">{c.title}</span><span className="v2-cat-count">{items.length}</span><span className={`v2-chev${isOpen?' down':''}`} aria-hidden="true">{Icon.chevron()}</span>
    </button>
    {isOpen&&<ul className="b-list v2-cat-list">{items.length?items.map((i,ix)=><TaskRow key={i.id} task={{...byId.get(i.id)!,listId:c.id}} index={ix} count={items.length} lists={board.lists} actions={actions} dragging={dragging===i.id} detailHref={`/bear/brain/${i.id}`} meta={i.status==='completed'?null:i.statusLabel+(i.categoryBy==='bear'?' · filed by Bear':'')}/>):<li className="faint" style={{padding:'10px 4px'}}>Nothing here.</li>}</ul>}
   </section>;})}
  </>}
  <p className="board-links small"><Link href="/bear/calendar?from=brain">Calendar</Link> · <Link href="/bear/shared?from=brain">Share Bear</Link> · <Link href="/bear/helps?from=brain">Bear Helps</Link> · <Link href="/bear/me/lists?from=brain">Edit categories</Link> · <Link href="/bear/wins" className="brain-wins">My Wins{wins?` (${wins})`:''}</Link></p>
  {toast&&<div key={toast.key} className="undo-toast glass-strong" role="status"><span>{toast.text}</span>{toast.undo&&<button type="button" onClick={()=>{toast.undo!();setToast(null);}}>Undo</button>}</div>}
 </main>;
}
