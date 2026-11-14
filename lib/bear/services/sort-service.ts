// Takes one message through the sorter and into real tasks, using the same steps as anything else given to Bear
// (capture, plan, reminders), then records how Bear sorted it. Repeats are recognised, not duplicated.
import {z} from 'zod';
import {daysBetween,formatAU,todayISO} from '../domain/dates.ts';
import {areaKeys,type AreaKey,type Task} from '../domain/types.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import type {BearStore} from '../store/store.ts';
import {maybeAutoSetup} from './auto-setup.ts';
import {createCapture} from './capture.ts';
import {ensureProfile} from './profile.ts';
import {lightFor,parseCorrection,segment,soonByNature,sortOne,suggestStart,type Light,type Sorted} from './sorter.ts';
import {setTaskArea,updateTask} from './task-edit.ts';

export interface SortedItem{taskId:string|null;title:string;domain:AreaKey;light:Light;reason:string;deadline:string|null;deadlineSource:'stated'|null;window:string|null;suggestedStart:string|null;when:string;nextAction:string|null;already:boolean;check:string|null;error:string|null}
const norm=(s:string)=>s.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\b(the|a|an|my|our|to|for|please)\b/g,' ').replace(/\s+/g,' ').trim();
const weekday=(iso:string)=>formatAU(iso,'weekday').split(' ')[0];
// The one line under a title: a stated date reads as "Due …", a proposal as "Suggested: …", a loose timeframe as the person said it.
export function whenLine(i:{deadline:string|null;window:string|null;suggestedStart:string|null},today:string):string{
 if(i.deadline){const n=daysBetween(today,i.deadline)??0;const due=n<0?'Overdue':n===0?'Today':n===1?'Due tomorrow':n<7?`Due ${weekday(i.deadline)}`:`Due ${formatAU(i.deadline,'short')}`;
  return i.suggestedStart?`${due} · Suggested start: ${weekday(i.suggestedStart)}`:due;}
 if(i.window)return i.window;
 if(i.suggestedStart){const n=daysBetween(today,i.suggestedStart)??0;return `Suggested: ${n<7?weekday(i.suggestedStart):formatAU(i.suggestedStart,'short')}`;}
 return 'No date';
}
// The traffic light for a task as it stands today: it moves by itself as the date nears.
export function taskLight(task:Pick<Task,'title'|'dueAt'|'sorted'|'light'>,today:string){
 return lightFor({deadline:task.dueAt,windowBy:task.sorted?.windowBy||null,urgency:task.sorted?.urgency||null,person:task.light?.level||null,soonByNature:soonByNature(task.title)},today);
}
export function itemFor(task:Task,area:AreaKey,today:string,extra:{already?:boolean}={}):SortedItem{
 const l=taskLight(task,today);const s=task.sorted;
 // A proposal made earlier is dropped once its day has passed, rather than shown as if it were still a plan.
 const suggested=s?.suggestedStart&&s.suggestedStart>=today?s.suggestedStart:null;
 const base={deadline:task.dueAt,window:task.dueAt?null:s?.window||null,suggestedStart:suggested};
 return {taskId:task.id,title:task.title,domain:area,light:l.light,reason:l.reason,deadline:task.dueAt,deadlineSource:task.dueAt?(s?.deadlineSource||'stated'):null,window:base.window,suggestedStart:suggested,when:whenLine(base,today),nextAction:s?.nextAction||null,already:!!extra.already,check:null,error:null};
}
async function areaOf(store:BearStore,task:Task):Promise<AreaKey>{return ((await store.get('projects',task.projectId))?.areaKey||'me') as AreaKey;}

// ---------- optional help from a model: wording and telling things apart only ----------
const modelSchema=z.object({tasks:z.array(z.object({original:z.string().min(2).max(400),title:z.string().min(3).max(90),domain:z.enum(areaKeys)}).strict()).min(1).max(12)}).strict();
export const sortJsonSchema={type:'object',additionalProperties:false,required:['tasks'],properties:{tasks:{type:'array',items:{type:'object',additionalProperties:false,required:['original','title','domain'],properties:{original:{type:'string'},title:{type:'string'},domain:{type:'string',enum:[...areaKeys]}}}}}};
export const sortSystemPrompt=`You sort what a busy parent just said into separate responsibilities. Return one entry per distinct thing they need to do.
- original: the exact words from their message for that one thing (copy them; do not paraphrase), including any date or urgency words they used for it.
- title: action verb + the specific thing + the outcome, under 12 words. Use only details they gave. Never add names, dates, amounts or places they did not say.
- domain: exactly one of work, family, home, money, health, me, by what the thing is mainly FOR (paying a bill is money; a child's school form is family; anyone's medical or dental care is health; the house, car or pets is home; the person's own friends, hobbies and self-care is me).
A shopping list is one thing. Do not split one thing into steps. Do not add things they did not mention.`;
const words=(s:string)=>new Set(norm(s).split(' ').filter(w=>w.length>3));
const properNouns=(s:string)=>(s.match(/\b[A-Z][a-z]{2,}\b/g)||[]).slice(1);   // skip the first word (sentence case)
async function modelParts(provider:StructuredModelProvider,text:string):Promise<{original:string;title:string;domain:AreaKey}[]|null>{
 try{
  const r=await provider.extract({schema:sortJsonSchema as unknown as Record<string,unknown>,system:sortSystemPrompt,text,images:[],documents:[],maxOutputTokens:2000});
  const parsed=modelSchema.safeParse(r.output);if(!parsed.success)return null;
  const said=words(text);const low=text.toLowerCase();
  for(const t of parsed.data.tasks){
   // Nothing invented: its "original" must be the person's own words, and the title may not name anyone they didn't.
   const w=[...words(t.original)];if(!w.length||w.some(x=>!said.has(x)))return null;
   if(properNouns(t.title).some(n=>!low.includes(n.toLowerCase())))return null;
  }
  return parsed.data.tasks;
 }catch{return null;}
}

export async function sortParts(text:string,provider:StructuredModelProvider|null,today:string,children:string[]):Promise<Sorted[]>{
 const rules=segment(text).map(p=>sortOne(p,today,children));
 // Short single things are sorted by the rules alone; the model is only asked when there is something to tell apart.
 if(!provider||text.trim().length<40)return rules;
 const m=await modelParts(provider,text);if(!m)return rules;
 return m.map(t=>{const s=sortOne(t.original,today,children);const title=t.title.replace(/[\s.]+$/,'');return {...s,title,domain:t.domain,secondary:[s.domain,...s.secondary].filter((d,i,a)=>d!==t.domain&&a.indexOf(d)===i),suggestedStart:suggestStart(title,s.deadline,s.light,today),...lightFor({deadline:s.deadline,windowBy:s.windowBy,urgency:s.urgency,soonByNature:soonByNature(title)},today)};});
}

// Make (or recognise) the task for one sorted thing.
export async function placeSorted(store:BearStore,s:Sorted,via:'text'|'voice',today:string,now=new Date()):Promise<SortedItem>{
 const blank={taskId:null,title:s.title,domain:s.domain,light:s.light,reason:s.reason,deadline:s.deadline,deadlineSource:s.deadlineSource,window:s.window,suggestedStart:s.suggestedStart,when:whenLine(s,today),nextAction:s.nextAction,already:false,check:null,error:null} satisfies SortedItem;
 try{
  // Seen before? The same responsibility told twice (chat, voice, again tomorrow) stays one task.
  const open=await store.list('tasks',{where:[{column:'status',value:'open'}]});const key=norm(s.title),okey=norm(s.original);
  const same=open.find(t=>norm(t.title)===key||(!!t.sorted&&norm(t.sorted.originalInput)===okey));
  if(same){
   // A date said this time that wasn't known before is new information, and is taken.
   const task=s.deadline&&!same.dueAt?await updateTask(store,same.id,{dueAt:s.deadline}):same;
   return itemFor(task,await areaOf(store,task),today,{already:true});
  }
  const {capture,extraction}=await createCapture(store,null,{method:via,text:s.original});
  if(extraction.kind==='bill')return {...blank,check:`/bear/verify/${capture.id}`};
  const auto=await maybeAutoSetup(store,extraction,now,null);
  if(!auto)return {...blank,check:`/bear/verify/${capture.id}`};
  let task=await updateTask(store,auto.task.id,{title:s.title,...(s.deadline?{dueAt:s.deadline}:{})});
  if(auto.area!==s.domain)await setTaskArea(store,task.id,s.domain);
  task=await store.update('tasks',task.id,{sorted:{originalInput:s.original,via,secondaryDomains:s.secondary,urgency:s.urgency,deadlineSource:s.deadline?'stated':null,window:s.window,windowBy:s.windowBy,suggestedStart:s.suggestedStart,nextAction:s.nextAction,reason:s.reason}});
  return itemFor(task,s.domain,today);
 }catch(e){return {...blank,error:e instanceof Error&&e.message?e.message:'Bear could not take that one.'};}
}
export async function sortAndPlace(store:BearStore,provider:StructuredModelProvider|null,text:string,via:'text'|'voice',now=new Date()):Promise<SortedItem[]>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const children=(profile.people||[]).filter(p=>p.role==='child').map(p=>p.name).filter(Boolean);
 const parts=await sortParts(text,provider,today,children);const out:SortedItem[]=[];
 for(const p of parts)out.push(await placeSorted(store,p,via,today,now));
 return out;
}

// A task the usual capture path has just made (one thing, possibly a school notice Bear read with its own reader): record how
// it was sorted. `retitle` is off for things Bear's specialist readers named, so their wording and dates stand.
export async function adoptSorted(store:BearStore,taskId:string,s:Sorted,via:'text'|'voice',today:string,retitle:boolean):Promise<SortedItem>{
 let task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 if(retitle){task=await updateTask(store,task.id,{title:s.title,...(s.deadline&&!task.dueAt?{dueAt:s.deadline}:{})});if((await areaOf(store,task))!==s.domain)await setTaskArea(store,task.id,s.domain);}
 const stated=!!task.dueAt;
 task=await store.update('tasks',task.id,{sorted:{originalInput:s.original.slice(0,600),via,secondaryDomains:s.secondary,urgency:s.urgency,deadlineSource:stated?'stated':null,window:stated?null:s.window,windowBy:stated?null:s.windowBy,suggestedStart:suggestStart(task.title,task.dueAt,lightFor({deadline:task.dueAt,windowBy:s.windowBy,urgency:s.urgency,soonByNature:soonByNature(task.title)},today).light,today),nextAction:s.nextAction,reason:s.reason}});
 return itemFor(task,await areaOf(store,task),today);
}
export const looksLikeDocument=(text:string)=>text.length>700||/\b(?:subject:|from:|dear\b|hi (?:parents|families|all|everyone)|regards|newsletter|account number|bpay|biller code|unsubscribe)\b/i.test(text);
export async function todayFor(store:BearStore,now=new Date()){const profile=await ensureProfile(store);return {today:todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now),children:(profile.people||[]).filter(p=>p.role==='child').map(p=>p.name).filter(Boolean)};}

// ---------- changing one thing, by a tap or by a sentence ----------
export const changeSchema=z.object({taskIds:z.array(z.string().uuid()).min(1).max(20),text:z.string().trim().min(2).max(300).optional(),taskId:z.string().uuid().optional(),light:z.enum(['red','amber','green']).optional(),domain:z.enum(areaKeys).optional()}).strict();
export async function changeSorted(store:BearStore,input:z.infer<typeof changeSchema>,now=new Date()):Promise<{changed:SortedItem|null;index:number}>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const tasks=(await Promise.all(input.taskIds.map(id=>store.get('tasks',id)))).filter((t):t is Task=>!!t&&t.status==='open');
 let target:Task|undefined;let change:{light?:Light;domain?:AreaKey;deadline?:string|null}={};
 if(input.taskId){target=tasks.find(t=>t.id===input.taskId);change={light:input.light,domain:input.domain};}
 else if(input.text){const c=parseCorrection(input.text,tasks.map(t=>({title:t.title})),today);if(c){target=tasks[c.index];change=c;}}
 if(!target)return {changed:null,index:-1};
 let task=target;
 if(change.deadline)task=await updateTask(store,task.id,{dueAt:change.deadline});
 if(change.domain)await setTaskArea(store,task.id,change.domain);
 if(change.light)task=await store.update('tasks',task.id,{light:{level:change.light,at:now.toISOString()}});
 return {changed:itemFor(task,await areaOf(store,task),today),index:input.taskIds.indexOf(task.id)};
}
