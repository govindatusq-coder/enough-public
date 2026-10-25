import {z} from 'zod';
import {addDays,todayISO} from '../domain/dates.ts';
import {itemCost,totalCost} from '../domain/items.ts';
import type {ShoppingItem,Task,TaskDependency} from '../domain/types.ts';
import {newId,stamp,type BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {ProviderError} from '../ai/provider.ts';
import {completeTask} from './completion.ts';
import {ensureProfile} from './profile.ts';
import {ConfirmError} from './task-inference.ts';

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
 const next=await store.update('tasks',task.id,{...patch});
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

// Split a list into several purchases: each becomes a step (with its own items, cost and date),
// balanced by cost where prices exist and by count otherwise.
export async function splitIntoPurchases(store:BearStore,taskId:string,parts:number,now=new Date()){
 const task=await loadEditable(store,taskId);const items=(task.items||[]).filter(i=>!i.done);
 if(task.status!=='open')throw new ConfirmError('Only open lists can be split.',400,'not_open');
 if((await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length)throw new ConfirmError('This is already split into purchases.',409,'already_split');
 const n=Math.min(Math.max(2,Math.round(parts)),Math.min(6,items.length));
 if(items.length<2)throw new ConfirmError('Add at least two items to split a list.',400,'too_few');
 const priced=items.filter(i=>i.estimatedCents!==null).length>=items.length/2;
 const weight=(i:ShoppingItem)=>priced?Math.max(1,itemCost(i)):1;
 const bins:ShoppingItem[][]=Array.from({length:n},()=>[]);const loads=Array(n).fill(0);
 for(const it of [...items].sort((a,b)=>weight(b)-weight(a))){const k=loads.indexOf(Math.min(...loads));bins[k].push(it);loads[k]+=weight(it);}
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const span=task.dueAt&&task.dueAt>today?Math.max(n,Math.round((new Date(task.dueAt).getTime()-new Date(today).getTime())/86400000)):n*7;
 const steps:Task[]=[];
 for(let k=0;k<n;k++){
  const group=bins[k];const cost=totalCost(group);
  const due=addDays(today,Math.max(1,Math.round(((k+1)*span)/n)));
  const names=group.slice(0,3).map(i=>i.name).join(', ')+(group.length>3?` +${group.length-3} more`:'');
  const step=await store.insert('tasks',stamp<Task>(store.userId,{projectId:task.projectId,kind:'shopping',title:`Purchase ${k+1} of ${n}: ${names}`,status:'open',dueAt:task.dueAt&&due>task.dueAt?task.dueAt:due,estimatedMinutes:20,cognitiveEffort:'low',forPerson:task.forPerson,isDemo:task.isDemo,items:group,estimatedCents:cost,setupBy:'bear'}));
  await store.insert('task_dependencies',stamp<TaskDependency>(store.userId,{taskId:task.id,dependsOnTaskId:step.id}));steps.push(step);
 }
 return {task,steps};
}

// Undo "done": the task, its project and its dependencies open again; the Win and Completion are
// removed so My Wins stays honest.
export async function reopenTask(store:BearStore,taskId:string){
 const task=await loadEditable(store,taskId);
 if(task.status!=='done')throw new ConfirmError("That one isn't marked done.",400,'not_done');
 const {completion,win}=await winFor(store,task.id);
 if(win)await store.remove('wins',win.id);
 if(completion)await store.remove('completions',completion.id);
 const items=task.items?.map(i=>({...i,done:false,doneAt:null}));
 const next=await store.update('tasks',task.id,{status:'open',...(items?{items}:{})});
 const project=await store.get('projects',task.projectId);if(project)await store.update('projects',project.id,{status:'active'});
 for(const d of await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})){const dep=await store.get('tasks',d.dependsOnTaskId);if(dep&&dep.status==='done')await store.update('tasks',dep.id,{status:'open'});}
 return next;
}
