import {z} from 'zod';
import {localParts,todayISO,addDays} from '../domain/dates.ts';
import type {AreaKey,Profile,Task,Weekday} from '../domain/types.ts';
import {recompute} from '../load/engine.ts';
import type {PatternId} from '../load/types.ts';
import {prioritise,selectAction} from '../priority/engine.ts';
import {inputFromGraph} from '../priority/input.ts';
import type {PriorityContext,PriorityResult,ValuesGoalsMap} from '../priority/types.ts';
import {effectiveValues} from '../priority/values.ts';
import type {BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {caps} from './load.ts';
import {activeDayMode,ensureProfile} from './profile.ts';

// Feature flag: on unless BEAR_PRIORITY_ENGINE_V1=off (for comparison and rollback).
export const priorityEnabled=()=>process.env.BEAR_PRIORITY_ENGINE_V1!=='off';

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

export interface Prioritised{results:Map<string,PriorityResult>;top:PriorityResult|null;needs:number;ctx:PriorityContext}
export async function prioritiseOpen(store:BearStore,now=new Date()):Promise<Prioritised>{
 const profile=await ensureProfile(store);
 const [tasks,projects,deps]=await Promise.all([store.list('tasks'),store.list('projects'),store.list('task_dependencies')]);
 const stepIds=new Set(deps.map(d=>d.dependsOnTaskId));
 const ctx=await priorityContext(store,profile,tasks,now);
 const projectOf=new Map(projects.map(p=>[p.id,p]));
 const open=tasks.filter(t=>t.status==='open'&&!t.wishlist&&!stepIds.has(t.id)&&t.load&&!t.load.migrated);
 // A brain-dump project offers only its next to-do; the rest stay quietly held.
 const nextOf=new Map<string,string>();for(const t of open){const p=projectOf.get(t.projectId);if(!p?.captureId)continue;const cur=nextOf.get(p.id);const curT=cur?open.find(x=>x.id===cur):null;if(!curT||(t.order??0)<(curT.order??0))nextOf.set(p.id,t.id);}
 const inputs=open.map(t=>{const p=projectOf.get(t.projectId);const g=recompute(t.load!,ctx.today,caps(),profile.loadMap);
  const input=inputFromGraph(g,{id:t.id,title:t.title,area:(p?.areaKey||'me') as AreaKey,createdAt:t.createdAt,postpones:t.postpones,snoozedUntil:t.snoozedUntil,importanceOverride:t.importance||null,projectPriority:p?.captureId?(p.priority||null):null,notes:t.notes,dueAt:t.dueAt});
  if(p?.captureId&&nextOf.get(p.id)!==t.id)input.human=null;
  // "No rush" items are never pushed at the person unless they set a date themselves.
  if(t.timing==='flexible'&&!input.flags.some(f=>['urgent','safety','overdue'].includes(f)))input.quiet=true;
  return input;});
 const results=new Map(inputs.map(i=>[i.id,prioritise(i,{...ctx,otherDeadlines:inputs.filter(o=>o.id!==i.id).map(o=>o.deadline).filter((d):d is string=>!!d)})]));
 const sel=selectAction([...results.values()]);
 return {results,top:sel.top,needs:sel.needs,ctx};
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
export const importanceSchema=z.object({level:z.enum(['very','nice','not'])}).strict();
export async function setImportance(store:BearStore,taskId:string,level:'very'|'nice'|'not',now=new Date()){
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
