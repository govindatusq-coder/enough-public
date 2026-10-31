import {addDays,todayISO,zonedDateTime} from '../domain/dates.ts';
import type {Bill,Profile,Reminder,Task} from '../domain/types.ts';
import {applyAction,dateEntityFor,graphState,markResolved,recompute,understand,withEntities,type UnderstandInput} from '../load/engine.ts';
import {learnFromAction} from '../load/loadmap.ts';
import {patterns} from '../load/patterns.ts';
import {legacyGraph} from '../load/migrate.ts';
import {currentCapabilities,type LoadEntities,type LoadGraph,type PatternId} from '../load/types.ts';
import {describe,type LoadView} from '../load/view.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {completeTask} from './completion.ts';
import {ensureProfile} from './profile.ts';

// LoadService: runs every captured thing through the Load Pattern Engine, keeps the load graph
// on the task, keeps exactly one honest "Bear will bring this back" reminder in step with it,
// and closes the task only when the load's real closure condition is met.
export const caps=()=>currentCapabilities(!!process.env.BEAR_VAPID_PUBLIC_KEY);
const tzOf=(p:Profile)=>p.lifeRhythm.timezone||'Australia/Sydney';

export async function attachLoad(store:BearStore,task:Task,input:Omit<UnderstandInput,'today'|'caps'|'loadMap'>,now=new Date()){
 const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);
 const {graph,recognition}=understand({...input,today,caps:caps(),loadMap:profile.loadMap});
 // Library gaps are logged without the person's words: only which patterns came close.
 if(recognition.primary==='UNKNOWN_LOAD')await recordBehaviour(store,'pattern_unknown',{near:recognition.ranked.slice(0,3).map(r=>`${r.id}:${r.confidence}`),length:input.text.length>200?'long':input.text.length>40?'medium':'short'},now);
 const updated=await store.update('tasks',task.id,{load:graph});
 await syncLoadReminder(store,updated,graph,profile,now);
 return {task:updated,graph,recognition};
}

// AI reading → entities. The engine's own extraction runs too; the AI only adds what it saw.
export function entitiesFromReading(g:{kind:string;when:{value:string|null};timeOfDay:{value:string|null};person:{value:string|null};location:{value:string|null};items?:{name:string}[]}):LoadEntities{
 // The reader's "when" is the act-by date; for an appointment or an event that is the day itself.
 const dated=['appointment','event'].includes(g.kind)?{eventDate:g.when.value}:{dueDate:g.when.value};
 return {...dated,time:g.timeOfDay.value,person:g.person.value,location:g.location.value,items:(g.items||[]).map(i=>i.name).slice(0,12)};
}
export function entitiesFromBill(bill:Bill):LoadEntities{
 const f=bill.fields;return {amountCents:bill.amountCents,dueDate:bill.dueAt,provider:bill.biller,reference:f.accountReference.value,flags:[...(f.directDebitActive.value?['autopay']:[]),...(f.alreadyPaid.value?['already_paid']:[])]};
}

export interface LoadRead{graph:LoadGraph;view:LoadView;migrated:boolean}
export async function readLoad(store:BearStore,task:Task,now=new Date()):Promise<LoadRead>{
 const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);
 let graph=task.load;
 if(!graph){const bill=(await store.list('bills',{where:[{column:'task_id',value:task.id}]}))[0]||null;graph=legacyGraph(task,bill,today,caps());await store.update('tasks',task.id,{load:graph});}
 const before=graphState(graph);graph=recompute(graph,today,caps(),profile.loadMap);
 // Time can close a load (the camp happened, with everything it needed done).
 if(graphState(graph)==='resolved'&&before!=='resolved'&&task.status==='open'&&!graph.migrated){await store.update('tasks',task.id,{load:graph});await completeTask(store,{taskId:task.id,method:'load',expectNext:null},now).catch(()=>null);}
 return {graph,view:describe(graph,today,{quiet:task.timing==='flexible'}),migrated:!!graph.migrated};
}

export async function actOnLoad(store:BearStore,taskId:string,input:{stepId:string;evidence?:string|null},now=new Date()){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);
 const graph=task.load||(await readLoad(store,task,now)).graph;
 const result=applyAction(graph,input,today,caps(),profile.loadMap);
 const node=result.graph.nodes.find(n=>n.steps.some(s=>s.id===input.stepId))||result.graph.nodes.find(n=>input.stepId.startsWith(n.id));
 const evidence=input.evidence||node?.steps.find(s=>s.id===input.stepId)?.evidence||null;
 if(node)await store.update('profiles',profile.id,{loadMap:learnFromAction(profile.loadMap||{domains:{}},{pattern:node.pattern as PatternId,evidence,provider:node.entities.provider})});
 await recordBehaviour(store,'load_action',{pattern:node?.pattern,evidence},now);
 let updated=await store.update('tasks',task.id,{load:result.graph});
 let win=null;
 if(graphState(result.graph)==='resolved'&&updated.status==='open'){const done=await completeTask(store,{taskId:task.id,method:'load',expectNext:null},now);win=done.win;updated=(await store.get('tasks',task.id))!;}
 else{
  // Reminders planned for the step just done are finished with; the load's own reminder takes over.
  for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed','delivered']}]}))if(r.plan.windowId!=='load')await store.update('reminders',r.id,{status:'actioned'});
  await syncLoadReminder(store,updated,result.graph,profile,now);
 }
 return {task:updated,view:describe(result.graph,today,{quiet:updated.timing==='flexible'}),said:result.said,win};
}

// "Done, it's sorted" from the person is the strongest closure evidence there is.
export async function resolveLoad(store:BearStore,task:Task,now=new Date()){
 if(!task.load)return;const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);
 await store.update('tasks',task.id,{load:markResolved(task.load,today,caps(),profile.loadMap)});
}
export async function reopenLoad(store:BearStore,task:Task,now=new Date()){
 if(!task.load)return;const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);
 // Making something current again undoes what closed it, so Bear carries it again.
 const g=structuredClone(task.load);
 for(const n of g.nodes){const closing=new Set(['user_resolved',...patterns[n.pattern].closure.evidence]);n.evidence=n.evidence.filter(e=>!closing.has(e.key)||e.source==='system');n.steps=n.steps.map(st=>st.evidence&&closing.has(st.evidence)&&st.status==='done'?{...st,status:'pending'}:st);}
 await store.update('tasks',task.id,{load:recompute(g,today,caps(),profile.loadMap)});
}

// One reminder, honest and in step: the morning before the thing that needs the person is due,
// or the morning Bear said it would bring something back. Bear only ever says "I'll bring this
// back on X" because this reminder exists.
export async function syncLoadReminder(store:BearStore,task:Task,graph:LoadGraph,profile:Profile,now=new Date()){
 if(task.status!=='open'||graph.migrated)return;
 // In a brain-dump project only the next to-do is ever brought back.
 const project=await store.get('projects',task.projectId);
 if(project?.captureId){const open=(await store.list('tasks',{where:[{column:'project_id',value:project.id},{column:'status',value:'open'}]})).sort((a,b)=>(a.order??0)-(b.order??0));
  if(open[0]&&open[0].id!==task.id){for(const r of (await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]})).filter(r=>r.plan.windowId==='load'))await store.update('reminders',r.id,{status:'cancelled'});return;}}
 const tz=tzOf(profile);const today=todayISO(tz,now);
 // "No rush" items get no reminder from Bear; the person chooses nudges themselves.
 const view=describe(graph,today,{quiet:task.timing==='flexible'});
 if(task.timing==='flexible'&&!view.needsYou?.dueAt){for(const r of (await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]})).filter(r=>r.plan.windowId==='load'))await store.update('reminders',r.id,{status:'cancelled'});return;}
 const due=view.needsYou?.dueAt;
 const target=view.needsYou?(due&&addDays(due,-1)>today?addDays(due,-1):null):view.nextBringBack;
 const active=await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]});
 const existing=active.filter(r=>r.plan.windowId==='load');
 // A reminder the person (or the planner) already set for a future moment covers it: never two for one thing.
 const planned=active.some(r=>r.plan.windowId!=='load'&&r.scheduledFor>now.toISOString());
 const when=target&&target>today&&!planned?zonedDateTime(target,9*60,tz):null;
 if(existing.some(r=>r.scheduledFor===when))return;
 for(const r of existing)await store.update('reminders',r.id,{status:'cancelled'});
 if(!when)return;
 const line=view.needsYou?view.needsYou.headline:(view.comingUp[0]?.line.replace(/ will come back .*/,'')||(view.waiting[0]?`Heard from ${view.waiting[0].who}?`:view.title));
 await store.insert('reminders',stamp<Reminder>(store.userId,{taskId:task.id,billId:null,kind:'planned',status:'scheduled',scheduledFor:when,plan:{scheduledFor:when,label:'Bear brings it back',rationale:'Bear said it would bring this back now.',windowId:'load',score:0},followUpIfUnpaid:false,attempts:0,deliveredAt:null,deliveredVia:[],message:`${view.title}: ${line}`}));
}

export async function relayLoadDate(store:BearStore,task:Task,date:string|null,now=new Date()){
 const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);const g=task.load!;
 const primary=g.nodes.find(n=>n.id===g.primaryId)!;
 const graph=withEntities(g,primary.id,{[dateEntityFor(primary)]:date},today,caps(),profile.loadMap);
 await syncLoadReminder(store,{...task,load:graph},graph,profile,now);
 return graph;
}

// When a to-do in a brain-dump project is done, the next one takes its place.
export async function syncNextInProject(store:BearStore,projectId:string,now=new Date()){
 const project=await store.get('projects',projectId);if(!project?.captureId)return;
 const next=(await store.list('tasks',{where:[{column:'project_id',value:projectId},{column:'status',value:'open'}]})).sort((a,b)=>(a.order??0)-(b.order??0))[0];
 if(next?.load)await syncLoadReminder(store,next,next.load,await ensureProfile(store),now);
}

// A renamed task renames its load too, so "I've got …" and every step read the new name.
export async function retitleLoad(store:BearStore,task:Task,title:string,now=new Date()){
 const profile=await ensureProfile(store);const today=todayISO(tzOf(profile),now);const g=task.load!;
 const primary=g.nodes.find(n=>n.id===g.primaryId)!;
 // Bills are named from the action ("Pay electricity bill" → "Electricity bill").
 const name=primary.pattern==='BILL_PAYMENT'?title.replace(/^pay\s+(?:the\s+)?/i,'').replace(/^\w/,c=>c.toUpperCase()):title;
 const graph=withEntities(g,primary.id,{},today,caps(),profile.loadMap,name);
 await syncLoadReminder(store,{...task,load:graph},graph,profile,now);
 return graph;
}
