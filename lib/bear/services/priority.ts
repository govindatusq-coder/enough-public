import {z} from 'zod';
import {localParts,todayISO,addDays} from '../domain/dates.ts';
import type {AreaKey,Profile,Task,Weekday} from '../domain/types.ts';
import {recompute} from '../load/engine.ts';
import type {PatternId} from '../load/types.ts';
import {prioritise,selectAction} from '../priority/engine.ts';
import {inputFromGraph} from '../priority/input.ts';
import {importancePrior,isLowLeverage,roleOf} from '../priority/importance.ts';
import {flags} from '../flags.ts';
import {futureSelf,interpret,otherPeople,pastSelfEvidence,presentSelf,relationalAdjust,type PresentSelfState,type RelationalAdjustment} from '../priority/relational.ts';
import type {PriorityContext,PriorityResult,ValuesGoalsMap} from '../priority/types.ts';
import {effectiveValues} from '../priority/values.ts';
import type {BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {caps} from './load.ts';
import {activeDayMode,ensureProfile} from './profile.ts';

// Feature flag: on unless BEAR_PRIORITY_ENGINE_V1=off (for comparison and rollback).
export const priorityEnabled=flags.priorityEngineV1;

// How much room right now, from the person's own weekly rhythm (if they set one). Unknown is fine.
function availableMinutes(profile:Profile,now:Date):number|null{
 const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const {minuteOfDay,weekday}=localParts(now,tz);
 if(minuteOfDay>=21*60+30||minuteOfDay<6*60)return 10;
 const block=profile.lifeRhythm.blocks.find(b=>b.days.includes(weekday as Weekday)&&(b.endMinute>b.startMinute?minuteOfDay>=b.startMinute&&minuteOfDay<b.endMinute:minuteOfDay>=b.startMinute||minuteOfDay<b.endMinute));
 if(!block)return profile.lifeRhythm.blocks.length?30:null;
 return {none:5,low:10,some:30,good:60}[block.capacity];
}
export async function priorityContext(store:BearStore,profile:Profile,tasks:Task[],now:Date):Promise<PriorityContext>{
 const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const counts:Partial<Record<PatternId,number>>={};for(const t of tasks)if(t.load){const p=t.load.nodes[0]?.pattern;if(p)counts[p]=(counts[p]||0)+1;}
 return {today,availableMinutes:availableMinutes(profile,now),dayMode:activeDayMode(profile,today),values:effectiveValues(profile.valuesMap,profile.loadMap,counts),struggles:profile.loadMap?.struggles||[],strengths:profile.pins.strengths,learned:profile.loadMap?.learned?.choices||{},otherDeadlines:[]};
}

// An imperative to-do ("Review Maya's chapter") rather than a note to keep.
const TODO=/^(review|reply|respond|send|draft|write|fix|book|call|ring|phone|email|put|take|go|buy|pay|finish|start|read|comment|prepare|organi[sz]e|plan|sort|clean|check|ask|tell|follow up|submit|update|make|get|arrange|confirm|complete|do|give|return|share|mark|edit|apply|visit|see)\b/i;
export interface Prioritised{results:Map<string,PriorityResult>;top:PriorityResult|null;needs:number;ctx:PriorityContext;present:PresentSelfState|null;relational:Map<string,RelationalAdjustment>}
export async function prioritiseOpen(store:BearStore,now=new Date()):Promise<Prioritised>{
 const profile=await ensureProfile(store);
 const [tasks,projects,deps,completions]=await Promise.all([store.list('tasks'),store.list('projects'),store.list('task_dependencies'),store.list('completions',{limit:500})]);
 const stepIds=new Set(deps.map(d=>d.dependsOnTaskId));
 const ctx=await priorityContext(store,profile,tasks,now);
 const projectOf=new Map(projects.map(p=>[p.id,p]));
 const open=tasks.filter(t=>t.status==='open'&&!t.wishlist&&!stepIds.has(t.id)&&t.load&&!t.load.migrated);
 // A brain-dump project offers only its next to-do; the rest stay quietly held.
 const nextOf=new Map<string,string>();for(const t of open){const p=projectOf.get(t.projectId);if(!p?.captureId)continue;const cur=nextOf.get(p.id);const curT=cur?open.find(x=>x.id===cur):null;if(!curT||(t.order??0)<(curT.order??0))nextOf.set(p.id,t.id);}
 const v2=flags.priorityEngineV2();
 // Area prior (V2): a soft lean from the projects the person has rated in that area. Weak on purpose.
 const areaPrior=new Map<string,number>();
 if(v2){const by=new Map<string,number[]>();for(const p of projects)if(p.importance&&p.status==='active'){const a=by.get(p.areaKey)||[];a.push(importancePrior[p.importance]);by.set(p.areaKey,a);}for(const [k,a] of by)areaPrior.set(k,a.reduce((x,y)=>x+y,0)/a.length);}
 const inputs=open.map(t=>{const p=projectOf.get(t.projectId);const g=recompute(t.load!,ctx.today,caps(),profile.loadMap);
  const input=inputFromGraph(g,{id:t.id,title:t.title,area:(p?.areaKey||'me') as AreaKey,createdAt:t.createdAt,postpones:t.postpones,snoozedUntil:t.snoozedUntil,importanceOverride:t.importance||null,projectPriority:p?.captureId?(p.priority||null):null,notes:t.notes,dueAt:t.dueAt});
  if(p?.captureId&&nextOf.get(p.id)!==t.id)input.queued=true;
  // "No rush" items are never pushed at the person unless they set a date themselves.
  if(t.timing==='flexible'&&!input.flags.some(f=>['urgent','safety','overdue'].includes(f)))input.quiet=true;
  // A plain to-do Bear can only hold (write, review, reply...) is still the person's to do, not Bear's.
  if(flags.relationalPriorityV1()&&!input.human&&input.pattern==='UNKNOWN_LOAD'&&!input.resolved&&!input.waitingOn&&TODO.test(t.title))input.human={kind:'information',label:t.title,dueAt:t.dueAt,surfaceFrom:null};
  if(v2){
   const r=roleOf(input.pattern,`${t.title} ${t.notes||''}`,p?.role||null,null);
   Object.assign(input,{projectImportance:p?.importance||null,areaPrior:areaPrior.get(p?.areaKey||'')??null,role:r.role,roleExplicit:r.explicit,lowLeverage:isLowLeverage(t.title),bearSupport:t.bearSupport||null});
   // A paused project, or one set aside for this week, is held quietly; its importance is untouched.
   if(p?.paused||(p?.deferredUntil&&p.deferredUntil>ctx.today))input.quiet=true;
  }
  return input;});
 // Relational Priority (relationalPriorityV1): people, past self, meaning. Derived, never asked for.
 const relational=new Map<string,RelationalAdjustment>();let present:PresentSelfState|null=null;
 if(flags.relationalPriorityV1()){
  const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const dayOf=(iso:string)=>todayISO(tz,new Date(iso));
  const actedToday=Object.values(profile.ideaHistory||{}).filter(h=>h.status==='accepted'&&dayOf(h.at)===ctx.today).length;
  present=presentSelf({tasks,completions,areaOf:t=>(projectOf.get(t.projectId)?.areaKey||'me') as AreaKey,today:ctx.today,actedToday,dayOf});
  const ptm=flags.ptmInterpretationV1();
  for(const input of inputs){const t=open.find(x=>x.id===input.id)!;const text=`${t.title} ${t.notes||''}`;
   const people=otherPeople(text,input.pattern,t.reliance||null);
   const c={itemId:t.id,otherPeople:people,pastSelf:pastSelfEvidence(input.pattern,t.kind,tasks,completions,t.id),futureSelf:futureSelf(text),ptm:ptm?interpret(text,input.pattern,people,input.flags):null};
   const band=prioritise(input,{...ctx,otherDeadlines:[]}).importanceSignal.inferredScore;
   const adj=relationalAdjust(c,{ptm,explicitImportance:!!t.importance,importanceBand:band,reliance:t.reliance||null});
   relational.set(t.id,adj);input.relational=adj;
   // Someone is clearly blocked on this: Bear's own "no rush" guess doesn't hide it (the person's choices still do).
   if(adj.waiting&&adj.leverage>=0.6&&t.reliance!=='no'&&t.timing==='flexible'&&t.timingBy!=='user'&&!(projectOf.get(t.projectId)?.paused))input.quiet=false;}
 }
 const run=()=>new Map(inputs.map(i=>[i.id,prioritise(i,{...ctx,otherDeadlines:inputs.filter(o=>o.id!==i.id).map(o=>o.deadline).filter((d):d is string=>!!d)})]));
 let results=run();
 // Bottom-up (V2): a project the person hasn't rated borrows a little from its strongest tasks
 // (confidence decays upward), then its tasks are read again with that lean.
 if(v2){let changed=false;
  for(const p of projects){if(p.importance)continue;const kids=inputs.filter(i=>open.find(t=>t.id===i.id)?.projectId===p.id);if(kids.length<2)continue;
   const top=kids.map(k=>results.get(k.id)!.importanceSignal.inferredScore).sort((a,b)=>b-a).slice(0,3);const v=0.8*top.reduce((a,b)=>a+b,0)/top.length;
   for(const k of kids){k.projectInferred=v;changed=true;}}
  if(changed)results=run();}
 // Within a brain-dump project the next to-do is the most worthwhile one, not the first one written down
 // (relationalPriorityV1). The rest wait their turn quietly.
 if(flags.relationalPriorityV1()){let moved=false;const rank:Record<string,number>={'Worth doing now':0,'Good to do this week':1,'Coming up':2,'Later is fine':3,'Nothing needed yet':4,'Waiting':5,'Bear is handling it':6,'Sorted':7};
  for(const pid of new Set([...nextOf.keys()])){const kids=inputs.filter(i=>open.find(t=>t.id===i.id)?.projectId===pid);
   const best=kids.map(k=>({k,r:results.get(k.id)!,o:open.find(t=>t.id===k.id)!.order??0})).sort((a,b)=>(rank[a.r.ownLabel]??9)-(rank[b.r.ownLabel]??9)||b.r.actionPriority-a.r.actionPriority||b.r.importance-a.r.importance||a.o-b.o)[0];
   if(best&&nextOf.get(pid)!==best.k.id){nextOf.set(pid,best.k.id);for(const k of kids)k.queued=k.id!==best.k.id;moved=true;}}
  if(moved)results=run();}
 const sel=selectAction([...results.values()]);
 return {results,top:sel.top,needs:sel.needs,ctx,present,relational};
}

// ---------- "Not today", importance and learning ----------
export const laterSchema=z.object({reason:z.enum(['no_time','no_energy','need_first','dont_want','not_important','changed']).nullable().optional()}).strict();
export async function notToday(store:BearStore,taskId:string,reason:z.infer<typeof laterSchema>['reason'],now=new Date()){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const pattern=task.load?.nodes[0]?.pattern||'UNKNOWN_LOAD';
 const postpones=reason?(task.postpones||0):(task.postpones||0)+1;
 await store.update('tasks',task.id,{snoozedUntil:addDays(today,1),postpones});
 // Learning: put off is information, not failure. Only the person's stated reason changes importance.
 const map=structuredClone(profile.loadMap||{domains:{}});map.learned??={};const c=map.learned.choices??={};
 if(!reason)c[`postpone:${pattern}`]=(c[`postpone:${pattern}`]||0)+1;
 if(reason==='not_important')c[`not_important:${pattern}`]=(c[`not_important:${pattern}`]||0)+1;
 if(reason==='dont_want')c[`avoid:${pattern}`]=(c[`avoid:${pattern}`]||0)+1;
 if(reason==='not_important')await store.update('tasks',task.id,{importance:'not'});
 await store.update('profiles',profile.id,{loadMap:map});
 await recordBehaviour(store,'priority_later',{pattern,reason:reason||null,postpones},now);
 // Ask why only when it has happened before and the answer would change what Bear does.
 return {askWhy:!reason&&postpones>=2};
}
// level null = "Bear decide": the person's own say is cleared and Bear's inference applies again.
export const importanceSchema=z.object({level:z.enum(['very','nice','not']).nullable()}).strict();
export async function setImportance(store:BearStore,taskId:string,level:'very'|'nice'|'not'|null,now=new Date()){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 await store.update('tasks',task.id,{importance:level});
 await recordBehaviour(store,'priority_importance',{pattern:task.load?.nodes[0]?.pattern,level},now);
}
// The person chose to do something Bear ranked low: maybe it matters more than Bear understands.
export async function noteChoice(store:BearStore,task:Task,now=new Date()){
 if(!priorityEnabled()||!task.load)return;
 const pr=await prioritiseOpen(store,now).catch(()=>null);const r=pr?.results.get(task.id);
 if(!r||r.surfaceNow||r.importance>=0.4)return;
 const profile=await ensureProfile(store);const map=structuredClone(profile.loadMap||{domains:{}});map.learned??={};const c=map.learned.choices??={};
 const k=`chose_low:${task.load.nodes[0].pattern}`;c[k]=(c[k]||0)+1;await store.update('profiles',profile.id,{loadMap:map});
}

// ---------- Values and goals (editable in Settings) ----------
export {valuesMapSchema} from '../priority/schema.ts';
export async function valuesView(store:BearStore):Promise<{saved:ValuesGoalsMap;effective:ValuesGoalsMap}>{
 const profile=await ensureProfile(store);const tasks=await store.list('tasks');const ctx=await priorityContext(store,profile,tasks,new Date());
 return {saved:profile.valuesMap||{values:[],goals:[]},effective:ctx.values};
}

// ---------- what the task page shows ----------
// Minimal by default: a calm label, minutes, one short line, and at most ONE question.
export function priorityView(r:PriorityResult,relationalAsk:'reliance'|null){
 const label=r.relationalStatus==='closing_loop'&&r.surfaceNow?'Worth closing the loop':r.timingLabel;
 const ask:'importance'|'reliance'|null=relationalAsk?'reliance':r.askImportance?'importance':null;
 return {label,minutes:r.action?r.minutes:0,shortReason:r.explanation.shortReason||null,ask,surfaceNow:r.surfaceNow};
}
export function whyView(r:PriorityResult){
 return {reasons:r.explanation.reasons.slice(0,4),latestComfortable:r.latestComfortableActionAt,latestSafe:r.latestSafeActionAt,deadline:r.deadline,firstStep:r.firstStep};
}
export const relianceSchema=z.object({reliance:z.enum(['yes','little','no']).nullable()}).strict();
export async function setReliance(store:BearStore,taskId:string,reliance:'yes'|'little'|'no'|null){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');await store.update('tasks',task.id,{reliance});
}
