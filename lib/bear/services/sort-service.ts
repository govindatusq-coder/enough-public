// Takes one message through the sorter and into real tasks, using the same steps as anything else given to Bear
// (capture, plan, reminders), then records how Bear sorted it. Repeats are recognised, not duplicated.
import {z} from 'zod';
import {daysBetween,formatAU,isValidISODate,todayISO} from '../domain/dates.ts';
import {areaKeys,type AIInference,type AreaKey,type Task} from '../domain/types.ts';
import {DAILY_LOOKUPS,type Researcher,type Source} from './lookup.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {maybeAutoSetup} from './auto-setup.ts';
import {createCapture} from './capture.ts';
import {ensureProfile} from './profile.ts';
import {lightFor,parseCorrection,segment,soonByNature,sortOne,suggestStart,type Light,type Sorted} from './sorter.ts';
import {setTaskArea,updateTask} from './task-edit.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';

export interface SortedItem{taskId:string|null;title:string;domain:AreaKey;light:Light;reason:string;deadline:string|null;deadlineSource:'stated'|'web'|null;window:string|null;suggestedStart:string|null;when:string;nextAction:string|null;already:boolean;check:string|null;error:string|null}
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
 const web=!!task.dueAt&&s?.deadlineSource==='web';
 return {taskId:task.id,title:task.title,domain:area,light:l.light,reason:l.reason,deadline:task.dueAt,deadlineSource:task.dueAt?(s?.deadlineSource||'stated'):null,window:base.window,suggestedStart:suggested,when:web?`${formatAU(task.dueAt,'short')} · found online`:whenLine(base,today),nextAction:s?.nextAction||null,already:!!extra.already,check:null,error:null};
}
// Anything with a date gets a reminder plan. Most tasks already have one from being set up; this covers the ones that did not.
async function ensureReminder(store:BearStore,task:Task,now:Date){
 if(!task.dueAt||task.status!=='open')return;
 const live=(await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]})).length;
 if(live)return;
 try{const plan=await recommendPlan(store,null,task,now);if(plan.suggested.when)await acceptPlan(store,{taskId:task.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:true},now);}catch{/* held without a reminder; it still shows in the app */}
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
   await ensureReminder(store,task,now);
   return itemFor(task,await areaOf(store,task),today,{already:true});
  }
  const {capture,extraction}=await createCapture(store,null,{method:via,text:s.original});
  if(extraction.kind==='bill')return {...blank,check:`/bear/verify/${capture.id}`};
  const auto=await maybeAutoSetup(store,extraction,now,null);
  if(!auto)return {...blank,check:`/bear/verify/${capture.id}`};
  let task=await updateTask(store,auto.task.id,{title:s.title,...(s.deadline?{dueAt:s.deadline}:{})});
  if(auto.area!==s.domain)await setTaskArea(store,task.id,s.domain);
  task=await store.update('tasks',task.id,{sorted:{originalInput:s.original,via,secondaryDomains:s.secondary,urgency:s.urgency,deadlineSource:s.deadline?'stated':null,window:s.window,windowBy:s.windowBy,suggestedStart:s.suggestedStart,nextAction:s.nextAction,reason:s.reason}});
  await ensureReminder(store,task,now);
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
 if(change.deadline)await ensureReminder(store,task,now);
 if(change.domain)await setTaskArea(store,task.id,change.domain);
 if(change.light)task=await store.update('tasks',task.id,{light:{level:change.light,at:now.toISOString()}});
 return {changed:itemFor(task,await areaOf(store,task),today),index:input.taskIds.indexOf(task.id)};
}

// ---------- finding things out ----------
export interface Found{question:string;answer:string;subject:string;date:string|null;dateLabel:string|null;sources:Source[]}
// Ask the web, within the daily allowance. Every attempt is recorded (counts and token use only, never the question's answer),
// so the owner can see what it costs. Any failure simply means "no finding": the caller keeps the to-do for the person.
export async function lookUp(store:BearStore,researcher:Researcher|null,question:string,today:string,now=new Date()):Promise<{found:Found|null;why:'off'|'limit'|'nothing'|null}>{
 if(!researcher)return {found:null,why:'off'};
 const since=now.getTime()-24*3600000;
 const used=(await store.list('ai_inferences',{where:[{column:'service',value:'WebLookup'}]})).filter(i=>Date.parse(i.createdAt)>=since).length;
 if(used>=DAILY_LOOKUPS)return {found:null,why:'limit'};
 const started=Date.now();
 try{
  const r=await researcher(question,today);
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'WebLookup',provider:'anthropic',model:r.model,promptHash:'web-lookup-1',rawOutput:{found:!!r.finding,searches:r.searches},latencyMs:Date.now()-started,ok:true,error:null,usage:r.usage}));
  if(!r.finding)return {found:null,why:'nothing'};
  return {found:{question,answer:r.finding.answer,subject:r.finding.subject,date:r.finding.date,dateLabel:r.finding.date?formatAU(r.finding.date,'long'):null,sources:r.finding.sources},why:null};
 }catch{
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'WebLookup',provider:'anthropic',model:'',promptHash:'web-lookup-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:'lookup_failed'})).catch(()=>null);
  return {found:null,why:'nothing'};
 }
}
// What Bear says under a to-do it kept because the lookup came back empty. Honest about which it was.
export const keptNote=(why:'off'|'limit'|'nothing'|null)=>why==='limit'?'I’ve done all the looking-up I can for today, so I’ve kept this for you':why==='nothing'?'I couldn’t find a reliable answer online, so I’ve kept this for you':null;

// The person accepted a reminder for a date Bear found online. Only now is anything saved, with where the date came from.
export const acceptSchema=z.object({question:z.string().trim().min(2).max(400),subject:z.string().trim().min(2).max(80),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),answer:z.string().trim().max(600),sources:z.array(z.object({title:z.string().max(160),url:z.string().url().max(500).regex(/^https?:\/\//)}).strict()).min(1).max(3)}).strict();
export async function acceptFound(store:BearStore,input:z.infer<typeof acceptSchema>,now=new Date()):Promise<SortedItem>{
 const {today,children}=await todayFor(store,now);
 if(!isValidISODate(input.date)||input.date<today)throw new Error('invalid_time');
 const base=sortOne(input.question,today,children);const title=input.subject.charAt(0).toUpperCase()+input.subject.slice(1);
 const s:Sorted={...base,title,original:input.question,deadline:input.date,deadlineSource:'stated',window:null,windowBy:null,suggestedStart:null,nextAction:null,...lightFor({deadline:input.date,urgency:null},today)};
 const item=await placeSorted(store,s,'text',today,now);
 if(!item.taskId)return item;
 const note=`${input.answer}\nFound online: ${input.sources.map(x=>x.url).join(' , ')}\nCheck the source before relying on the date.`.slice(0,1000);
 await updateTask(store,item.taskId,{notes:note});
 const task=await store.get('tasks',item.taskId);
 const next=await store.update('tasks',item.taskId,{sorted:{...(task!.sorted||{originalInput:input.question,via:'text' as const,secondaryDomains:[],urgency:null,window:null,windowBy:null,suggestedStart:null,nextAction:null,reason:''}),deadlineSource:'web' as const}});
 return itemFor(next,item.domain,today,{already:item.already});
}
