'use client';
import {useCallback,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {apiGet,apiSend} from '@/lib/bear/client';
import {brand} from '@/lib/bear/domain/copy';
import type {Suggestion} from '@/lib/bear/domain/types';
import type {PriorityIdea} from '@/lib/bear/services/priority-ideas';
import type {Idea,IdeaAction,Capacity} from '@/lib/bear/strategy/ideas';
import {EmptyArt} from '@/components/bear/art';
import {WhyInline} from '@/components/bear/why-inline';
import {Button,Chip,ErrorCard,Sheet,Skeleton,Toast} from '@/components/bear/ui';
// Ideas the person set aside today stay hidden on this device until tomorrow (legacy feed only).
const hiddenKey=()=>'bear-ideas-hidden-'+new Date().toISOString().slice(0,10);
const hidden=():string[]=>{try{return JSON.parse(localStorage.getItem(hiddenKey())||'[]');}catch{return [];}};
type View=Omit<Idea,'score'>;
const familyTone:Record<string,string>={load:'teal',priority:'coral',strategic:'mustard'};
const windows=[{key:'today',label:'Today'},{key:'tomorrow',label:'Tomorrow'},{key:'this_week',label:'This week'},{key:'not_sure',label:'Not sure'}] as const;
const rooms:{key:Capacity;label:string}[]=[{key:'5',label:'5 min'},{key:'15',label:'15 min'},{key:'30',label:'30 min'},{key:'block',label:'A proper block'},{key:'none',label:'Nothing right now'}];
const roomLabel:Record<string,string>={'5':'about 5 minutes','15':'about 15 minutes','30':'about 30 minutes',block:'a proper block',none:'nothing right now'};

export default function Ideas(){
 const router=useRouter();const [items,setItems]=useState<Suggestion[]|null>(null);const [prio,setPrio]=useState<PriorityIdea[]>([]);const [error,setError]=useState<string|null>(null);const [toast,setToast]=useState<string|null>(null);const [leaving,setLeaving]=useState<string|null>(null);
 // Bear Ideas V2: one feed chosen by the orchestrator. null = still loading, or the legacy feed is on.
 const [feed,setFeed]=useState<{ideas:View[];askCapacity:boolean;capacity:Capacity|null;rested:boolean}|null>(null);const [legacy,setLegacy]=useState(false);
 const [room,setRoom]=useState<View|null>(null);
 const fail=useCallback((e:{status?:number;message:string})=>{if(e.status===401)router.replace('/bear/signin');else setError(e.message);},[router]);
 const loadLegacy=useCallback(()=>apiGet<{suggestions:Suggestion[];priority?:PriorityIdea[]}>('/api/bear/suggestions').then(r=>{setItems(r.suggestions);setPrio((r.priority||[]).filter(p=>!hidden().includes(p.id)));setError(null);}).catch(fail),[fail]);
 const load=useCallback(()=>apiGet<{legacy?:boolean;ideas?:View[];askCapacity?:boolean;capacity?:Capacity|null;rested?:boolean}>('/api/bear/ideas').then(r=>{if(r.legacy){setLegacy(true);return loadLegacy();}setFeed({ideas:r.ideas||[],askCapacity:!!r.askCapacity,capacity:r.capacity||null,rested:!!r.rested});setError(null);
  try{sessionStorage.setItem('bear-ideas',String((r.ideas||[]).length));window.dispatchEvent(new Event('bear-ideas'));}catch{/* no storage */}}).catch(fail),[fail,loadLegacy]);
 useEffect(()=>{load();},[load]);
 const gone=(id:string,msg:string|null)=>{if(msg)setToast(msg);setTimeout(()=>{setFeed(f=>f?{...f,ideas:f.ideas.filter(x=>x.id!==id)}:f);setLeaving(null);},450);};
 async function act(i:View,a:IdeaAction,extra:{window?:string}={}){
  setLeaving(i.id);
  try{
   if(a.key==='copy'&&i.draft){try{await navigator.clipboard.writeText(i.draft);}catch{/* the text stays visible to copy by hand */}}
   const r=await apiSend<{message:string|null}>('/api/bear/ideas/act',{ideaId:i.id,type:i.type,action:a.key,suggestionId:i.suggestionId||null,taskId:i.taskId||null,projectId:i.projectId||null,...(extra.window?{window:extra.window}:{})});
   // The original Bear Ideas keep exactly where they lead.
   if(a.key==='accept'&&(i.suggestionKind==='missing_expected'||i.suggestionKind==='add_related_areas')){router.push('/bear/capture');return;}
   if(a.key==='accept'&&i.suggestionKind==='bill_increased'&&i.href){router.push(i.href);return;}
   if(a.key==='open'&&i.href){router.push(i.href);return;}
   setRoom(null);
   gone(i.id,a.key==='accept'?"Added. Bear's got it.":a.key==='reject'?'Noted. Bear will suggest less of that.':a.key==='copy'?'Copied. Paste it wherever you message them.':a.key==='dismiss'?'No problem. Bear will leave that for a while.':r.message);
  }catch(e){setError((e as Error).message);setLeaving(null);}
 }
 async function setCap(v:Capacity){try{await apiSend('/api/bear/ideas/capacity',{value:v});setToast(v==='none'?'Got it. Bear will keep things quiet today.':'Thanks. Bear has picked what fits.');load();}catch(e){setError((e as Error).message);}}
 const press=(i:View,a:IdeaAction)=>a.key==='make_room'?setRoom(i):act(i,a);

 async function respond(s:Suggestion,response:'accept'|'reject'){setLeaving(s.id);try{await apiSend('/api/bear/suggestions/respond',{suggestionId:s.id,response});
  if(response==='accept'&&s.kind==='missing_expected'){router.push('/bear/capture');return;}
  if(response==='accept'&&s.kind==='add_related_areas'){router.push('/bear/capture');return;}
  if(response==='accept'&&s.kind==='bill_increased'){router.push(`/bear/bills/${s.payload.billId}`);return;}
  setToast(response==='accept'?"Added. Bear's got it.":"Noted. Bear will suggest less of that.");setTimeout(()=>{setItems(list=>list?list.filter(x=>x.id!==s.id):list);setLeaving(null);},450);}
  catch(e){setError((e as Error).message);setLeaving(null);}}
 async function setAside(p:PriorityIdea){setLeaving(p.id);try{if(p.taskId)await apiSend(`/api/bear/tasks/${p.taskId}/later`,{});try{localStorage.setItem(hiddenKey(),JSON.stringify([...hidden(),p.id]));}catch{/* fine */}setToast('No problem. Bear will bring it back another day.');setTimeout(()=>{setPrio(l=>l.filter(x=>x.id!==p.id));setLeaving(null);},450);}catch(e){setError((e as Error).message);setLeaving(null);}}
 const empty=<div className="card" style={{textAlign:'center'}}><EmptyArt file="empty-ideas"/><p style={{fontWeight:700,fontSize:19}}>Nothing to suggest right now.</p><p className="muted small" style={{marginTop:4}}>When Bear notices a pattern worth acting on, it&rsquo;ll show up here.</p></div>;
 return (
  <main id="main" className="bear-screen">
   <h1>{brand.ideasHeading}</h1><p className="muted" style={{marginTop:6}}>Things Bear spotted that might save you a thought. Nothing happens unless you say so.</p>
   {error&&<div style={{marginTop:14}}><ErrorCard message={error} retry={load}/></div>}
   {!legacy&&<div className="section">
    {!feed&&!error&&<Skeleton/>}
    {feed?.askCapacity&&<div className="card idea-room"><p style={{fontWeight:700}}>What have you got room for?</p><p className="muted small" style={{marginTop:4}}>Only if you’d like to say. It changes which ideas Bear shows today.</p><div className="chips" style={{marginTop:10}}>{rooms.map(r=><Chip key={r.key} label={r.label} selected={false} onToggle={()=>setCap(r.key)}/>)}</div></div>}
    {feed?.capacity&&<p className="small muted" style={{margin:'0 0 10px'}}>Room today: {roomLabel[feed.capacity]}. <button type="button" className="one-thing-link" onClick={()=>setFeed(f=>f?{...f,askCapacity:true,capacity:null}:f)}>Change</button></p>}
    {feed&&feed.ideas.length===0&&(feed.rested?<div className="card" style={{textAlign:'center'}}><EmptyArt file="empty-ideas"/><p style={{fontWeight:700,fontSize:19}}>Nothing else from Bear needs your attention right now.</p></div>:empty)}
    {feed?.ideas.map(i=><div key={i.id} className={`card ${leaving===i.id?'collapse-out':''}`}>
     <p className={`eyebrow ${familyTone[i.family]}`} style={{marginBottom:6}}>{i.eyebrow}</p>
     <p style={{fontWeight:700,fontSize:18}}>{i.title}</p>
     <p className="muted small" style={{marginTop:6}}>{i.body}</p>
     {i.chips&&i.chips.length>0&&<div className="idea-chips">{i.chips.map(c=><span key={c} className="idea-chip">{c}</span>)}</div>}
     {i.draft&&<p className="note plain idea-draft">{i.draft}</p>}
     <div className="btn-row">{i.actions.map(a=><Button key={a.key} className="sm" variant={a.primary?'primary':'quiet'} disabled={leaving===i.id} onClick={()=>press(i,a)}>{a.label}</Button>)}</div>
     {i.why&&i.why.length>0&&<WhyInline reasons={i.why}/>}
    </div>)}
   </div>}
   {legacy&&<div className="section">
    {!items&&!error&&<Skeleton/>}
    {prio.length>0&&<><p className="eyebrow" style={{marginBottom:8}}>Worth a thought</p>{prio.map(p=><div key={p.id} className={`card ${leaving===p.id?'collapse-out':''}`}><p style={{fontWeight:700,fontSize:18}}>{p.title}</p><p className="muted small" style={{marginTop:6}}>{p.body}</p><div className="btn-row"><Button className="sm" variant="primary" href={p.href}>{p.actionLabel}</Button><Button className="sm" variant="quiet" disabled={leaving===p.id} onClick={()=>setAside(p)}>Not now</Button></div></div>)}{items&&items.length>0&&<p className="eyebrow" style={{margin:'18px 0 8px'}}>Bear noticed</p>}</>}
    {items&&items.length===0&&prio.length===0&&empty}
    {items?.map(s=><div key={s.id} className={`card ${leaving===s.id?'collapse-out':''}`}><p style={{fontWeight:700,fontSize:18}}>{s.title}</p><p className="muted small" style={{marginTop:6}}>{s.body}</p><div className="btn-row"><Button className="sm" variant="primary" disabled={leaving===s.id} onClick={()=>respond(s,'accept')}>{s.actionLabel}</Button><Button className="sm" variant="quiet" disabled={leaving===s.id} onClick={()=>respond(s,'reject')}>Not relevant</Button></div></div>)}
   </div>}
   {room&&<Sheet onClose={()=>setRoom(null)} label="Roughly when feels realistic?">
    <h2>Roughly when feels realistic?</h2>
    <p className="small muted" style={{marginTop:6}}>Bear can’t see your calendar. It’ll just check in around then.</p>
    <div className="chips" style={{marginTop:12}}>{windows.map(w=><Chip key={w.key} label={w.label} selected={false} onToggle={()=>act(room,{key:'make_room',label:''},{window:w.key})}/>)}</div>
   </Sheet>}
   <Toast message={toast} onDone={()=>setToast(null)}/>
  </main>
 );
}
