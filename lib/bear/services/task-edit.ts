import {z} from 'zod';
import {reopenLoad,relayLoadDate,retitleLoad} from './load.ts';
import {addDays,formatWhen,localParts,todayISO,zonedDateTime} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import {itemCost,totalCost} from '../domain/items.ts';
import type {Project,Reminder,ReminderPlan,ShoppingItem,Task,TaskDependency} from '../domain/types.ts';
import {newId,stamp,type BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {ProviderError} from '../ai/provider.ts';
import {completeTask} from './completion.ts';
import {ensureProfile} from './profile.ts';
import {ConfirmError} from './task-inference.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';

// Editing a task (open or done), ticking list items off across several trips, estimating the
// cost of a list, splitting a large list into several purchases, and reopening a done task.
const itemSchema=z.object({id:z.string().max(60).optional(),name:z.string().trim().min(1).max(80),quantity:z.string().trim().max(20).nullable().default(null),estimatedCents:z.number().int().min(0).max(100000000).nullable().default(null),done:z.boolean().default(false)}).strict();
export const updateTaskSchema=z.object({
 title:z.string().trim().min(1).max(120).optional(),
 dueAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
 dueTime:z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
 location:z.string().trim().max(160).nullable().optional(),
 notes:z.string().trim().max(1000).nullable().optional(),
 forPerson:z.string().trim().max(80).nullable().optional(),
 items:z.array(itemSchema).max(60).optional(),
}).strict();
export type UpdateTaskInput=z.infer<typeof updateTaskSchema>;

async function loadEditable(store:BearStore,taskId:string){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const bills=await store.list('bills',{where:[{column:'task_id',value:task.id}]});
 if(bills.length)throw new ConfirmError('Bills are changed from the bill page.',400,'is_bill');
 return task;
}
async function winFor(store:BearStore,taskId:string){
 const completion=(await store.list('completions',{where:[{column:'task_id',value:taskId}]}))[0]||null;
 const win=completion?(await store.list('wins',{where:[{column:'completion_id',value:completion.id}]}))[0]||null:null;
 return {completion,win};
}

export async function updateTask(store:BearStore,taskId:string,input:UpdateTaskInput){
 const task=await loadEditable(store,taskId);const patch:Partial<Task>={};
 if(input.title!==undefined)patch.title=input.title;
 if(input.dueAt!==undefined)patch.dueAt=input.dueAt;
 if(input.dueTime!==undefined)patch.dueTime=input.dueTime;
 if(input.location!==undefined)patch.location=input.location;
 if(input.notes!==undefined)patch.notes=input.notes;
 if(input.forPerson!==undefined)patch.forPerson=input.forPerson;
 if(input.items!==undefined){
  const before=new Map((task.items||[]).map(i=>[i.id,i]));const at=new Date().toISOString();
  const items:ShoppingItem[]=input.items.map(i=>{const prev=i.id?before.get(i.id):undefined;return {id:prev?.id||i.id||newId(),name:i.name,quantity:i.quantity,estimatedCents:i.estimatedCents,done:i.done,doneAt:i.done?(prev?.doneAt||at):null};});
  patch.items=items;patch.estimatedCents=totalCost(items);
 }
 let next=await store.update('tasks',task.id,{...patch});
 // A new date is a new fact for the load: Bear re-plans around it (and stops asking for it).
 if(input.dueAt!==undefined&&input.dueAt!==task.dueAt&&next.load&&!next.load.migrated){next=await store.update('tasks',task.id,{load:await relayLoadDate(store,next,input.dueAt)});}
 if(input.title!==undefined&&input.title!==task.title&&next.load&&!next.load.migrated){next=await store.update('tasks',task.id,{load:await retitleLoad(store,next,input.title)});}
 // Keep the project name and any Win in step with an edited title.
 if(input.title!==undefined&&input.title!==task.title){
  const project=await store.get('projects',task.projectId);if(project&&project.title===task.title)await store.update('projects',project.id,{title:input.title});
  if(task.status==='done'){const {win}=await winFor(store,task.id);if(win&&win.title===task.title)await store.update('wins',win.id,{title:input.title});}
 }
 return next;
}

// Tick one item (or everything) on a list. The last tick finishes the task, so a list done in
// one go and a list done over several trips both work. Lists split into purchases finish from
// the purchases instead.
export async function setItemDone(store:BearStore,taskId:string,input:{itemId?:string;done?:boolean;all?:boolean},now=new Date()){
 const task=await loadEditable(store,taskId);const items=task.items||[];
 if(!items.length)throw new ConfirmError('This has no list.',400,'no_items');
 const at=now.toISOString();
 const next=items.map(i=>input.all?{...i,done:true,doneAt:i.doneAt||at}:i.id===input.itemId?{...i,done:input.done!==false,doneAt:input.done!==false?at:null}:i);
 if(!input.all&&!items.some(i=>i.id===input.itemId))throw new Error('not_found');
 const updated=await store.update('tasks',task.id,{items:next});
 const hasSteps=(await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length>0;
 const everything=next.every(i=>i.done);
 if(everything&&updated.status==='open'&&!hasSteps){const result=await completeTask(store,{taskId:task.id,method:null,expectNext:false},now);return {task:{...updated,status:'done' as const},completed:true,win:result.win};}
 return {task:updated,completed:false,win:null};
}

const PRICE_SCHEMA={type:'object',additionalProperties:false,required:['prices'],properties:{prices:{type:'array',items:{type:'object',additionalProperties:false,required:['name','cents'],properties:{name:{type:'string'},cents:{type:'integer',description:'Rough typical Australian retail price for ONE unit in AUD cents. 0 only when truly unknowable.'}}}}}} as const;
const priceOutput=z.object({prices:z.array(z.object({name:z.string(),cents:z.number().int().min(0).max(100000000)}).strict()).max(80)}).strict();
const PRICE_PROMPT=`You help an Australian household budget a shopping or supply list. For each item return a rough typical retail price in Australian dollars (as cents) for ONE unit of that item, at an ordinary supermarket or hardware chain such as Woolworths, Coles or Bunnings. Round sensibly. These are rough estimates, not quotes. Use the exact item names you were given.`;
// Fill in missing per-item prices with the AI service. Existing prices (including ones the user typed) stay.
export async function estimateTaskCost(store:BearStore,provider:StructuredModelProvider|null,taskId:string){
 const task=await loadEditable(store,taskId);const items=task.items||[];
 if(!items.length)throw new ConfirmError('Add a list first, then Bear can estimate it.',400,'no_items');
 if(!provider)throw new ConfirmError('Estimating needs the AI service connected.',503,'ai_unavailable');
 const missing=items.filter(i=>i.estimatedCents===null);
 if(!missing.length)return task;
 let parsed;try{const r=await provider.extract({schema:PRICE_SCHEMA as unknown as Record<string,unknown>,system:PRICE_PROMPT,text:missing.map(i=>i.name).join('\n'),images:[],documents:[],maxOutputTokens:3000});parsed=priceOutput.parse(r.output);}
 catch(e){throw new ConfirmError(e instanceof ProviderError?e.message:'Bear could not estimate that just now.',503,'estimate_failed');}
 const byName=new Map(parsed.prices.map(p=>[p.name.trim().toLowerCase(),p.cents]));
 const next=items.map(i=>{if(i.estimatedCents!==null)return i;const c=byName.get(i.name.trim().toLowerCase());return c&&c>0?{...i,estimatedCents:c}:i;});
 return store.update('tasks',task.id,{items:next,estimatedCents:totalCost(next)});
}

// Split a list into several purchases. Each purchase becomes its own task, with its own
// project, items, cost, date and reminder, so five trips are five things on the list and each
// can be finished (and counted in My Wins) on its own. Items are shared out balanced by cost
// where prices exist and by count otherwise. The original list is archived, not deleted.
export async function splitIntoPurchases(store:BearStore,taskId:string,parts:number,now=new Date()){
 const task=await loadEditable(store,taskId);const items=(task.items||[]).filter(i=>!i.done);
 if(task.status!=='open')throw new ConfirmError('Only open lists can be split.',400,'not_open');
 if(task.part)throw new ConfirmError('This is already one of the purchases.',409,'already_split');
 if((await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length)throw new ConfirmError('This is already split into purchases.',409,'already_split');
 if(items.length<2)throw new ConfirmError('Add at least two items to split a list.',400,'too_few');
 const n=Math.min(Math.max(2,Math.round(parts)),Math.min(8,items.length));
 const priced=items.filter(i=>i.estimatedCents!==null).length>=items.length/2;
 const weight=(i:ShoppingItem)=>priced?Math.max(1,itemCost(i)):1;
 const bins:ShoppingItem[][]=Array.from({length:n},()=>[]);const loads=Array(n).fill(0);
 for(const it of [...items].sort((a,b)=>weight(b)-weight(a))){const k=loads.indexOf(Math.min(...loads));bins[k].push(it);loads[k]+=weight(it);}
 const original=await store.get('projects',task.projectId);const areaKey=original?.areaKey||'me';
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const span=task.dueAt&&task.dueAt>today?Math.max(n,Math.round((new Date(task.dueAt).getTime()-new Date(today).getTime())/86400000)):n*7;
 const base=task.title.replace(/\s*\(\d+ of \d+\)$/,'');const tasks:Task[]=[];
 for(let k=0;k<n;k++){
  const group=bins[k].map(i=>({...i,id:newId(),done:false,doneAt:null}));const cost=totalCost(group);
  const rawDue=addDays(today,Math.max(1,Math.round(((k+1)*span)/n)));const due=task.dueAt&&rawDue>task.dueAt?task.dueAt:rawDue;
  const names=group.slice(0,3).map(i=>i.name).join(', ')+(group.length>3?` +${group.length-3} more`:'');
  const title=`${base}: ${names}`.slice(0,120);
  const project=await store.insert('projects',stamp<Project>(store.userId,{areaKey,title:`${title} (${k+1} of ${n})`.slice(0,120),status:'active',dueAt:due,resourceDocumentIds:original?.resourceDocumentIds||[],billId:null}));
  const t=await store.insert('tasks',stamp<Task>(store.userId,{projectId:project.id,kind:'shopping',title,status:'open',dueAt:due,dueTime:null,location:task.location??null,notes:null,estimatedMinutes:20,cognitiveEffort:'low',forPerson:task.forPerson,isDemo:task.isDemo,items:group,estimatedCents:cost,setupBy:'bear',part:{of:task.id,index:k+1,total:n}}));
  tasks.push(t);
  try{const plan=await recommendPlan(store,null,t,now);if(plan.suggested.when)await acceptPlan(store,{taskId:t.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:false},now);}catch{/* the task stands without a reminder */}
 }
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]}))await store.update('reminders',r.id,{status:'cancelled'});
 const archived=await store.update('tasks',task.id,{status:'archived',notes:`Split into ${n} purchases.`});
 if(original)await store.update('projects',original.id,{status:'archived'});
 return {original:archived,tasks,areaKey};
}

// ---------- How soon, how big, and how to be reminded ----------
// Bear reads each task two ways: time-sensitive or flexible, and one go or bigger. Only
// time-sensitive tasks get planned reminder times. Flexible ones never get a date or a time
// unless the person chooses one: they pick no reminders, a gentle nudge every so often, or a
// day. Nothing here is a deadline Bear sets for someone.
const NUDGE_DAYS={week:7,fortnight:14,month:30} as const;
export const readSchema=z.object({timing:z.enum(['time_sensitive','flexible']).optional(),size:z.enum(['one_go','bigger']).optional()}).strict();
export const nudgeSchema=z.object({choice:z.enum(['none','every','day']),every:z.enum(['week','fortnight','month']).optional(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict();
const nudgeMessage=(t:{title:string})=>`No rush. ${t.title} is here whenever you feel like it.`;
async function cancelLive(store:BearStore,taskId:string,kinds?:string[]){
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:taskId},{column:'status',op:'in',value:['scheduled','snoozed']}]}))if(!kinds||kinds.includes(r.kind))await store.update('reminders',r.id,{status:'cancelled'});
}
async function tzOf(store:BearStore){return (await ensureProfile(store)).lifeRhythm.timezone||'Australia/Sydney';}
async function scheduleNudge(store:BearStore,task:Task,date:string,tz:string){
 const when=zonedDateTime(date,10*60+30,tz);const plan:ReminderPlan={scheduledFor:when,label:formatWhen(when,tz),rationale:'A gentle nudge, as you asked.',windowId:null,score:0};
 return store.insert('reminders',stamp<Reminder>(store.userId,{taskId:task.id,billId:null,kind:'nudge',status:'scheduled',scheduledFor:when,plan,followUpIfUnpaid:false,attempts:0,deliveredAt:null,deliveredVia:[],message:nudgeMessage(task)}));
}
async function planTimeSensitive(store:BearStore,task:Task,now:Date){
 try{const plan=await recommendPlan(store,null,task,now);if(plan.suggested.when)await acceptPlan(store,{taskId:task.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:true},now);}catch{/* held without a reminder */}
}
export async function setRead(store:BearStore,provider:StructuredModelProvider|null,taskId:string,input:z.infer<typeof readSchema>,now=new Date()){
 let task=await loadEditable(store,taskId);let brokeDown=false;
 if(input.timing&&input.timing!==task.timing){
  await cancelLive(store,task.id);
  task=await store.update('tasks',task.id,{timing:input.timing,nudge:null,nudgeChoice:null});
  if(input.timing==='time_sensitive')await planTimeSensitive(store,task,now);
 }
 if(input.size&&input.size!==task.size){
  task=await store.update('tasks',task.id,{size:input.size});
  if(input.size==='bigger'&&provider&&!(await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length){try{await breakDownTask(store,provider,task.id);brokeDown=true;}catch{/* the Break it down button can try again */}}
 }
 return {task:(await store.get('tasks',task.id))!,brokeDown};
}
export async function setNudge(store:BearStore,taskId:string,input:z.infer<typeof nudgeSchema>,now=new Date()){
 const task=await loadEditable(store,taskId);const tz=await tzOf(store);const today=todayISO(tz,now);
 await cancelLive(store,task.id,['nudge']);
 if(input.choice==='none')return store.update('tasks',task.id,{nudge:null,nudgeChoice:'none'});
 if(input.choice==='day'){
  if(!input.date||input.date<=today)throw new ConfirmError('Pick a day that is still ahead of you.',400,'invalid_date');
  await scheduleNudge(store,task,input.date,tz);return store.update('tasks',task.id,{nudge:null,nudgeChoice:'day'});
 }
 if(!input.every)throw new ConfirmError('Say how often.',400,'invalid_every');
 await scheduleNudge(store,task,addDays(today,NUDGE_DAYS[input.every]),tz);
 return store.update('tasks',task.id,{nudge:{every:input.every},nudgeChoice:'nudge'});
}
// Keeps "now and then" going: when a nudge has been and gone, the next one is lined up for an
// interval after it, never sooner than tomorrow.
export async function ensureNudges(store:BearStore,now=new Date()){
 const tasks=(await store.list('tasks',{where:[{column:'status',value:'open'}]})).filter(t=>t.nudge&&!t.wishlist);if(!tasks.length)return;
 const tz=await tzOf(store);const today=todayISO(tz,now);
 for(const t of tasks){
  const mine=await store.list('reminders',{where:[{column:'task_id',value:t.id}]});
  if(mine.some(r=>r.status==='scheduled'||r.status==='snoozed'))continue;
  const last=mine.map(r=>r.scheduledFor).sort().pop()||t.createdAt;
  const base=localParts(last,tz).date;const target=addDays(base,NUDGE_DAYS[t.nudge!.every]);
  await scheduleNudge(store,t,target>today?target:addDays(today,1),tz);
 }
}

const STEPS_SCHEMA={type:'object',additionalProperties:false,required:['steps'],properties:{steps:{type:'array',items:{type:'string'}}}} as const;
const stepsOutput=z.object({steps:z.array(z.string().trim().min(1).max(120)).min(2).max(8)}).strict();
const STEPS_PROMPT=`You help a busy person get started on something that feels big. Break the task into 3 to 6 small, concrete steps, in order, each doable in a few minutes, written as short plain Australian English instructions ("Find the form", "Ring the school office"). Use only what you were told. Do not add deadlines, dates or pressure.`;
export async function breakDownTask(store:BearStore,provider:StructuredModelProvider|null,taskId:string){
 const task=await loadEditable(store,taskId);
 if(task.status!=='open')throw new ConfirmError('Only open things can be broken down.',400,'not_open');
 if((await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length)throw new ConfirmError('This is already broken into steps.',409,'already_steps');
 if(!provider)throw new ConfirmError('Breaking things down needs the AI service connected.',503,'ai_unavailable');
 let parsed;try{const r=await provider.extract({schema:STEPS_SCHEMA as unknown as Record<string,unknown>,system:STEPS_PROMPT,text:[task.title,task.notes||'',(task.items||[]).map(i=>i.name).join(', ')].filter(Boolean).join('\n'),images:[],documents:[],maxOutputTokens:1500});parsed=stepsOutput.parse(r.output);}
 catch(e){throw new ConfirmError(e instanceof ProviderError?e.message:'Bear could not break that down just now.',503,'breakdown_failed');}
 const steps:Task[]=[];
 for(const title of parsed.steps.slice(0,6)){
  const step=await store.insert('tasks',stamp<Task>(store.userId,{projectId:task.projectId,kind:'custom',title,status:'open',dueAt:task.timing==='flexible'?null:task.dueAt,estimatedMinutes:5,cognitiveEffort:'low',forPerson:task.forPerson,isDemo:task.isDemo,timing:task.timing,setupBy:'bear'}));
  await store.insert('task_dependencies',stamp<TaskDependency>(store.userId,{taskId:task.id,dependsOnTaskId:step.id}));steps.push(step);
 }
 await store.update('tasks',task.id,{size:'bigger'});
 return steps;
}

// ---------- The person's own steps ----------
// Anyone can add their own small steps to a task, with or without the AI service, and remove any step.
// Adding a step makes the task "bigger". Steps never get a date of their own unless the task is
// time-sensitive, in which case they share its date.
export const stepSchema=z.object({title:z.string().trim().min(1).max(120)}).strict();
const MAX_STEPS=12;
export async function addStep(store:BearStore,taskId:string,title:string){
 const task=await loadEditable(store,taskId);
 if(task.status!=='open')throw new ConfirmError('Only open things can have steps.',400,'not_open');
 const deps=await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]});
 if(deps.length>=MAX_STEPS)throw new ConfirmError(`That is plenty of steps. Bear keeps up to ${MAX_STEPS} per task.`,400,'too_many_steps');
 const step=await store.insert('tasks',stamp<Task>(store.userId,{projectId:task.projectId,kind:'custom',title,status:'open',dueAt:task.timing==='flexible'?null:task.dueAt,estimatedMinutes:5,cognitiveEffort:'low',forPerson:task.forPerson,isDemo:task.isDemo,timing:task.timing,setupBy:'user'}));
 await store.insert('task_dependencies',stamp<TaskDependency>(store.userId,{taskId:task.id,dependsOnTaskId:step.id}));
 if(task.size!=='bigger')await store.update('tasks',task.id,{size:'bigger'});
 return step;
}
export async function removeStep(store:BearStore,taskId:string,stepId:string){
 const task=await loadEditable(store,taskId);
 const dep=(await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).find(d=>d.dependsOnTaskId===stepId);
 if(!dep)throw new Error('not_found');
 await store.remove('task_dependencies',dep.id);await store.remove('tasks',stepId);
}

// ---------- Deleting ----------
// A real delete, for anything the person no longer wants in Bear at all (different from "not important
// anymore", which keeps a record). It takes the task's steps, reminders, its win and any saving counted
// for it, its bill if it is one, and its project when nothing else is left in it. The original photo or
// text the person gave Bear is kept with the capture history, not shown anywhere.
export async function deleteTask(store:BearStore,taskId:string){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 // Steps (and a step's own link, if a step is deleted directly)
 for(const d of await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})){await store.remove('task_dependencies',d.id);if(await store.get('tasks',d.dependsOnTaskId))await store.remove('tasks',d.dependsOnTaskId);}
 for(const d of await store.list('task_dependencies',{where:[{column:'depends_on_task_id',value:task.id}]}))await store.remove('task_dependencies',d.id);
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id}]}))await store.remove('reminders',r.id);
 for(const c of await store.list('completions',{where:[{column:'task_id',value:task.id}]})){
  for(const w of await store.list('wins',{where:[{column:'completion_id',value:c.id}]}))await store.remove('wins',w.id);
  await store.remove('completions',c.id);
 }
 for(const e of await store.list('value_ledger',{where:[{column:'kind',value:'wealth'}]}))if(e.sourceTaskId===task.id)await store.remove('value_ledger',e.id);
 for(const b of await store.list('bills',{where:[{column:'task_id',value:task.id}]}))await store.remove('bills',b.id);
 await store.remove('tasks',task.id);
 const left=(await store.list('tasks',{where:[{column:'project_id',value:task.projectId}]})).length;
 if(!left)await store.remove('projects',task.projectId);
}

// ---------- Big spends: when could this comfortably be bought? ----------
// Asked once, for a spend of BIG_SPEND_CENTS or more. "Now" keeps it current. Anything else moves
// it to the wishlist, which lives with the areas and stays off the busy screens until its check-back
// day, when it comes back as one gentle reminder.
export const affordSchema=z.object({mode:z.enum(['now','date','check_back','wishlist']),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),days:z.number().int().min(1).max(730).optional()}).strict();
export type AffordInput=z.infer<typeof affordSchema>;
export async function answerAfford(store:BearStore,taskId:string,input:AffordInput,now=new Date()){
 const task=await loadEditable(store,taskId);
 if(task.status!=='open')throw new ConfirmError('Only open things can go on the wishlist.',400,'not_open');
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const today=todayISO(tz,now);
 // Whatever was planned before no longer applies.
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]}))await store.update('reminders',r.id,{status:'cancelled'});
 if(input.mode==='now'){
  const next=await store.update('tasks',task.id,{buyWhen:'now',wishlist:null});
  try{const plan=await recommendPlan(store,null,next,now);if(plan.suggested.when)await acceptPlan(store,{taskId:next.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:true},now);}catch{/* held without a reminder */}
  return next;
 }
 let checkBackAt:string|null=null;
 if(input.mode==='date'){if(!input.date||input.date<=today)throw new ConfirmError('Pick a day that is still ahead of you.',400,'invalid_date');checkBackAt=input.date;}
 if(input.mode==='check_back'){if(!input.days)throw new ConfirmError('Say how long to wait.',400,'invalid_days');checkBackAt=addDays(today,input.days);}
 const next=await store.update('tasks',task.id,{buyWhen:null,wishlist:{since:task.wishlist?.since||today,checkBackAt}});
 if(checkBackAt){
  const when=zonedDateTime(checkBackAt,10*60,tz);const cost=next.estimatedCents?` It came to about ${formatAUD(next.estimatedCents)}.`:'';
  const plan:ReminderPlan={scheduledFor:when,label:formatWhen(when,tz),rationale:'You asked Bear to check back.',windowId:null,score:0};
  await store.insert('reminders',stamp<Reminder>(store.userId,{taskId:task.id,billId:null,kind:'planned',status:'scheduled',scheduledFor:when,plan,followUpIfUnpaid:false,attempts:0,deliveredAt:null,deliveredVia:[],message:`Is now a good time to buy ${task.title}?${cost}`}));
 }
 return next;
}

export interface WishlistView{items:{taskId:string;title:string;estimate:string|null;checkBackAt:string|null;since:string;areaKey:string|null}[]}
export async function wishlistView(store:BearStore):Promise<WishlistView>{
 const [tasks,projects]=await Promise.all([store.list('tasks',{where:[{column:'status',value:'open'}]}),store.list('projects')]);
 const area=new Map(projects.map(p=>[p.id,p.areaKey]));
 return {items:tasks.filter(t=>t.wishlist).map(t=>({taskId:t.id,title:t.title,estimate:t.estimatedCents?formatAUD(t.estimatedCents):null,checkBackAt:t.wishlist!.checkBackAt,since:t.wishlist!.since,areaKey:area.get(t.projectId)||null})).sort((a,b)=>(a.checkBackAt||'9999')<(b.checkBackAt||'9999')?-1:1)};
}

// Undo "done": the task, its project and its dependencies open again; the Win and Completion are
// removed so My Wins stays honest.
export async function reopenTask(store:BearStore,taskId:string){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 if(task.status!=='done')throw new ConfirmError("That one isn't marked done.",400,'not_done');
 const {completion,win}=await winFor(store,task.id);
 if(win)await store.remove('wins',win.id);
 if(completion)await store.remove('completions',completion.id);
 // Savings counted for this completion go with it, so totals never include something that is no longer done.
 for(const e of await store.list('value_ledger',{where:[{column:'kind',value:'wealth'}]}))if(e.sourceTaskId===task.id)await store.remove('value_ledger',e.id);
 const bill=(await store.list('bills',{where:[{column:'task_id',value:task.id}]}))[0]||null;
 if(bill)await store.update('bills',bill.id,{status:'watching',paidAt:null});
 const items=task.items?.map(i=>({...i,done:false,doneAt:null}));
 const next=await store.update('tasks',task.id,{status:'open',...(items?{items}:{})});
 await reopenLoad(store,next);
 const project=await store.get('projects',task.projectId);if(project)await store.update('projects',project.id,{status:'active'});
 for(const d of await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})){const dep=await store.get('tasks',d.dependsOnTaskId);if(dep&&dep.status==='done')await store.update('tasks',dep.id,{status:'open'});}
 return next;
}
