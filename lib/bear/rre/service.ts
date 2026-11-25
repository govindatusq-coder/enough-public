// RRE part 6: storage. One record per responsibility (the task), with Bear's plan kept on it. Drop Bear creates them,
// Got a Moment? asks the engine for one action, Bear Brain shows them all. All three read the same records.
import {z} from 'zod';
import {addDays,todayISO,zonedDateTime} from '../domain/dates.ts';
import {areaLabels} from '../domain/labels.ts';
import type {AIInference,Task} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {ensureProfile} from '../services/profile.ts';
import {completeSchema,completeTask} from '../services/completion.ts';
import {acceptPlan} from '../services/reminder-planning.ts';
import {listsOf,minutesFor,suggestList,type BearList} from '../board/logic.ts';
import {openTasks} from '../board/service.ts';
import type {Kind,Method} from './model.ts';
import {advance,buildPlan,currentStep,RULES_VERSION,resolveWait,selectedPath,statusLabel as baseLabel,statusOf,switchPathway,type Plan,type RStatus} from './plan.ts';
const labelFor=(s:RStatus,p:Plan)=>s==='waiting'?(p.dependencies.some(d=>d.status==='open'&&d.kind==='delivery')?'Waiting for delivery':'Waiting for a response'):baseLabel[s];
import {chooseMoment,nextForHer,type Candidate} from './decide.ts';
import {prepareFor} from './prepare.ts';
import {chooseShare} from './share-pick.ts';
import {recordBehaviour} from '../services/behaviour.ts';
import {describePreference,learn,purchasePreference} from './prefs.ts';

async function ctxOf(store:BearStore,now:Date){
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
 const family=[...(profile.family||[]).map(f=>({name:f.name,relation:f.relation,age:f.age})),...(profile.people||[]).filter(p=>p.name&&!['me','pet'].includes(p.role)).map(p=>({name:p.name,relation:p.role,age:null}))]
  .filter((f,i,a)=>f.name&&a.findIndex(x=>x.name.toLowerCase()===f.name.toLowerCase())===i);
 return {profile,tz,today:todayISO(tz,now),children:family.filter(f=>f.relation==='child').map(f=>f.name),family,lists:listsOf(profile)};
}
type Ctx=Awaited<ReturnType<typeof ctxOf>>;
const basisOf=(t:Task)=>`${t.title}|${t.dueAt||''}|${t.listId||''}|${t.rreChoice||''}`;

// Bear's plan for a task, built the first time it's needed and rebuilt when the task changes. Progress already made
// (a step done, something prepared, a delivery being waited on) is carried over, never thrown away.
export async function ensurePlan(store:BearStore,task:Task,ctx:Ctx,now:Date):Promise<Plan>{
 const cur=task.rre;
 if(cur&&cur.rules===RULES_VERSION&&cur.basis===basisOf(task))return cur;
 const pref=purchasePreference(ctx.profile.preferences);
 let plan=buildPlan({id:task.id,title:task.title,original:task.sorted?.originalInput||task.title,dueAt:task.dueAt,listId:task.listId??null,today:ctx.today,children:ctx.children,minutesGuess:minutesFor(task),prefer:{method:pref.method},chosen:task.rreChoice??cur?.selected??null},now);
 if(cur&&cur.kind===plan.kind&&(cur.stepIndex>0||cur.execution.prepared||cur.dismissed.length)&&plan.pathways.some(p=>p.id===cur.selected)){
  plan={...plan,selected:cur.selected,chosenBy:cur.chosenBy,stepIndex:cur.stepIndex,execution:cur.execution,dependencies:cur.dependencies,dismissed:cur.dismissed,deadlines:{...plan.deadlines,followUp:cur.deadlines.followUp}};
 }
 plan={...plan,basis:basisOf(task)};
 await store.update('tasks',task.id,{rre:plan});
 return plan;
}
// Where it shows in Bear Brain: her own choice always; otherwise Bear's best guess. Bear's guess is never written over hers.
const byKind:Record<Kind,string>={acquire:'night',gifts:'week',appointment:'calls',call:'calls',form:'night',bill:'night',followup:'followup',chore:'spare',aspiration:'aspire',general:'spare'};
export function categoryOf(t:Task,p:Plan,lists:BearList[],learning:Parameters<typeof suggestList>[2]):{id:string;by:'you'|'bear'}{
 const ids=new Set(lists.map(l=>l.id));
 if(t.listId&&ids.has(t.listId))return {id:t.listId,by:'you'};
 const s=t.suggestion&&!t.suggestion.ignored&&ids.has(t.suggestion.listId)?t.suggestion.listId:suggestList(t.title,lists,learning)?.listId;
 if(s&&ids.has(s))return {id:s,by:'bear'};
 const k=byKind[p.kind];return {id:ids.has(k)?k:(lists[0]?.id||'spare'),by:'bear'};
}
async function rows(store:BearStore,now:Date){
 const ctx=await ctxOf(store,now);const tasks=await openTasks(store);
 const out:{task:Task;plan:Plan;status:RStatus}[]=[];
 for(const t of tasks){try{const plan=await ensurePlan(store,t,ctx,now);out.push({task:t,plan,status:statusOf(plan,t.status,ctx.today)});}catch{/* one odd record never stops the rest */}}
 return {ctx,rows:out};
}

// ---------- Got a moment? ----------
export const momentSchema=z.object({minutes:z.number().int().min(1).max(240),exclude:z.array(z.string().uuid()).max(50).default([])}).strict();
export async function recommend(store:BearStore,input:z.infer<typeof momentSchema>,now=new Date()){
 const {ctx,rows:r}=await rows(store,now);
 const items:Candidate[]=r.map(({task,plan})=>({taskId:task.id,title:task.title,listId:categoryOf(task,plan,ctx.lists,ctx.profile.listLearning).id,plan,status:task.status,readiness:task.readiness??null,blockedByShare:task.sharedOut?.mode==='transfer'&&task.readiness==='waiting'}));
 const res=chooseMoment(items,{minutes:input.minutes,now,today:ctx.today,timeZone:ctx.tz,exclude:input.exclude,last:ctx.profile.rreLast??null});
 // The decision trace is kept (last 10) for checking how Bear decided; it is not shown in the app.
 await store.update('profiles',ctx.profile.id,{rreTrace:[res.trace,...(ctx.profile.rreTrace||[])].slice(0,10),// Browsing alternatives ("Something else") doesn't replace the main suggestion for this window.
  ...(res.recommendation&&!input.exclude.length?{rreLast:{taskId:res.recommendation.taskId,minutes:input.minutes,at:now.toISOString()}}:{})});
 return {recommendation:res.recommendation,message:res.message,suggestMinutes:res.suggestMinutes,waiting:res.waiting};
}
// "No time? Hand something off": one task someone else could do, or null (Bear says so honestly).
export const sharePickSchema=z.object({exclude:z.array(z.string().uuid()).max(50).default([])}).strict();
export async function recommendShare(store:BearStore,input:z.infer<typeof sharePickSchema>,now=new Date()){
 const {ctx,rows:r}=await rows(store,now);
 return {suggestion:chooseShare(r,{today:ctx.today,exclude:input.exclude})};
}
// What she did with a Got a Moment? suggestion, kept so we can see whether handing off helps: did she ask someone, ask for
// another, or say not now. Only the choice and the task id are kept; never her words.
export const momentFeedbackSchema=z.object({taskId:z.string().uuid(),surface:z.enum(['finish','share']),response:z.enum(['do_it','ask_someone','another','not_now'])}).strict();
export async function momentFeedback(store:BearStore,input:z.infer<typeof momentFeedbackSchema>,now=new Date()){
 const accepted=input.response==='do_it'||input.response==='ask_someone';
 await recordBehaviour(store,accepted?'suggestion_accepted':'suggestion_rejected',{kind:`moment_${input.surface}`,response:input.response,taskId:input.taskId},now);
}
export async function skip(store:BearStore,taskId:string,now=new Date()){
 const t=await store.get('tasks',taskId);if(!t)throw new Error('not_found');const ctx=await ctxOf(store,now);const plan=await ensurePlan(store,t,ctx,now);
 // A skip means "not now", not "not important": it's only held back for a day, and never if a deadline is close.
 await store.update('tasks',t.id,{rre:{...plan,dismissed:[...plan.dismissed,now.toISOString()].slice(-10)}});
 const p=await store.get('profiles',ctx.profile.id);if(p?.rreLast?.taskId===taskId)await store.update('profiles',p.id,{rreLast:null});
}

// ---------- Give it to Bear ----------
export const DAILY_GIFT_IDEAS=10;
async function giftIdeas(store:BearStore,provider:StructuredModelProvider|null,family:Ctx['family'],now:Date):Promise<Record<string,string[]>|null>{
 if(!provider||!family.length)return null;
 const since=now.getTime()-24*3600000;const used=(await store.list('ai_inferences',{where:[{column:'service',value:'GiftIdeas'}]})).filter(i=>Date.parse(i.createdAt)>=since).length;if(used>=DAILY_GIFT_IDEAS)return null;
 const schema={type:'object',additionalProperties:false,required:['people'],properties:{people:{type:'array',items:{type:'object',additionalProperties:false,required:['name','ideas'],properties:{name:{type:'string'},ideas:{type:'array',items:{type:'string'}}}}}}};
 const started=Date.now();
 try{
  const r=await provider.extract({schema,system:'You suggest Christmas gift ideas for an Australian family. Give two or three short, general gift ideas per person (types of gift, not specific products, brands, prices or shops). Use only the details given. Australian English.',text:family.map(f=>`${f.name} (${f.relation}${f.age?`, age ${f.age}`:''})`).join('\n'),images:[],documents:[],maxOutputTokens:800,effort:'low'});
  const out=r.output as {people?:{name:string;ideas:string[]}[]};const names=new Set(family.map(f=>f.name));
  const ideas=Object.fromEntries((out.people||[]).filter(p=>names.has(p.name)&&Array.isArray(p.ideas)).map(p=>[p.name,p.ideas.filter(x=>typeof x==='string').map(x=>x.slice(0,60)).slice(0,3)]));
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'GiftIdeas',provider:r.provider,model:r.model,promptHash:'gifts-1',rawOutput:null,latencyMs:r.latencyMs,ok:true,error:null}));
  return Object.keys(ideas).length?ideas:null;
 }catch(e){await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'GiftIdeas',provider:provider.name,model:provider.model,promptHash:'gifts-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:String((e as Error)?.message||e).slice(0,200)})).catch(()=>null);return null;}
}
// Bear does its part of the current step (prepares), then it's her turn. Tapping twice never prepares twice.
export async function giveToBear(store:BearStore,provider:StructuredModelProvider|null,taskId:string,now=new Date()){
 const t=await store.get('tasks',taskId);if(!t||t.status!=='open')throw new Error('not_found');
 const ctx=await ctxOf(store,now);let plan=await ensurePlan(store,t,ctx,now);
 const s=currentStep(plan);
 if(s&&s.who==='bear'){
  if(!plan.execution.prepared){
   const bill=(await store.list('bills',{where:[{column:'task_id',value:t.id}]}))[0]||null;
   const ideas=plan.kind==='gifts'?await giftIdeas(store,provider,ctx.family,now):null;
   const prepared=prepareFor(plan,t,bill,{name:(ctx.profile.name||'').split(/\s+/)[0]||'',family:ctx.family,giftIdeas:ideas},now);
   plan={...plan,execution:{...plan.execution,state:'preparing',prepared,key:`${t.id}:${plan.selected}:${plan.stepIndex}`,log:[...plan.execution.log,{at:now.toISOString(),text:`Bear prepared: ${prepared.title}`}]}};
  }
  plan=advance(plan,now,ctx.today,'Ready for you');
  plan={...plan,execution:{...plan.execution,state:'ready_for_review'}};
  await store.update('tasks',t.id,{rre:plan});
 }
 return detailFrom(t,plan,ctx);
}

// ---------- Her steps ----------
export const stepSchema=z.object({action:z.enum(['done','arrived','not_arrived','replied','switch']),pathway:z.string().max(40).optional(),explicit:z.boolean().optional()}).strict();
export async function stepAction(store:BearStore,taskId:string,input:z.infer<typeof stepSchema>,now=new Date()){
 const t=await store.get('tasks',taskId);if(!t||t.status!=='open')throw new Error('not_found');
 const ctx=await ctxOf(store,now);let plan=await ensurePlan(store,t,ctx,now);const s=currentStep(plan);
 if(input.action==='switch'){
  if(!input.pathway)throw new Error('not_found');const target=plan.pathways.find(p=>p.id===input.pathway);if(!target||target.feasibility==='infeasible')throw new Error('not_found');
  plan=switchPathway(plan,input.pathway,now,`You chose: ${target.label}`,'you');
  // Her choice is remembered for this responsibility, and (for buying things) as a preference: explicit if she said so.
  await store.update('tasks',t.id,{rreChoice:input.pathway});
  if(plan.kind==='acquire'&&['online','in_person'].includes(target.method))await store.update('profiles',ctx.profile.id,{preferences:learn(ctx.profile.preferences,'purchase_method',target.method,input.explicit?'explicit':'observed',now)});
 }else if(input.action==='not_arrived'){
  // The pathway failed. Keep the responsibility, record why, and move to the next feasible way.
  const alt=plan.pathways.filter(p=>p.id!==plan.selected&&p.feasibility!=='infeasible')[0];
  plan=alt?switchPathway({...plan,execution:{...plan.execution,state:'failed'}},alt.id,now,`It didn’t arrive. Next: ${alt.label.toLowerCase()}`,'bear'):{...plan,execution:{...plan.execution,state:'failed',log:[...plan.execution.log,{at:now.toISOString(),text:'It didn’t arrive, and there’s no other way left that works in time'}]}};
 }else if(input.action==='arrived'||input.action==='replied'){
  plan=resolveWait(plan,now,ctx.today,input.action==='arrived'?'It arrived':'They replied');
  // For a delivery, "it arrived" is the outcome itself, so it needs no second confirmation.
  if(input.action==='arrived'&&currentStep(plan)?.kind==='confirm')plan=advance(plan,now,ctx.today,'Outcome confirmed');
 }else{
  if(!s)throw new Error('already_done');
  plan=advance(plan,now,ctx.today,`Done: ${s.text}`);
  const nxt=currentStep(plan);
  // Waiting on a delivery or a reply: a real reminder (the durable reminder job) brings it back on the expected day.
  if(nxt?.kind==='wait'&&plan.deadlines.followUp){try{await acceptPlan(store,{taskId:t.id,when:zonedDateTime(plan.deadlines.followUp,9*60,ctx.tz),label:'Bear checks back',rationale:nxt.text,key:'custom',followUpIfUnpaid:false},now);}catch{/* still shown in Bear Brain on the day */}}
 }
 await store.update('tasks',t.id,{rre:plan});
 // Only when the outcome itself is confirmed is the responsibility complete (an order placed isn't "it's here").
 if(!currentStep(plan)){await completeTask(store,completeSchema.parse({taskId:t.id,method:null}),now);}
 const fresh=(await store.get('tasks',t.id))||t;return detailFrom(fresh,plan,ctx);
}

// ---------- Views ----------
function detailFrom(t:Task,plan:Plan,ctx:Ctx){
 const status=statusOf(plan,t.status,ctx.today);const cat=categoryOf(t,plan,ctx.lists,ctx.profile.listLearning);const list=ctx.lists.find(l=>l.id===cat.id)||null;
 const n=nextForHer(plan);const path=selectedPath(plan);
 return {id:t.id,title:t.title,original:t.sorted?.originalInput||null,outcome:plan.outcome,kind:plan.kind,status,statusLabel:labelFor(status,plan),
  deadlines:plan.deadlines,deadlineSource:plan.deadlineSource,category:list?{id:list.id,title:list.title,icon:list.icon,by:cat.by}:null,
  pathway:{id:path.id,label:path.label,description:path.description,minutes:path.userMinutes,feasibility:path.feasibility,why:path.why,evidence:path.evidence,chosenBy:plan.chosenBy},
  steps:path.steps.map((s,i)=>({...s,state:i<plan.stepIndex?'done':i===plan.stepIndex?'now':'later'})),
  next:n?{text:n.step.text,minutes:n.step.userMinutes,needsBear:n.needsBear}:null,current:currentStep(plan),
  prepared:plan.execution.prepared,log:plan.execution.log,dependencies:plan.dependencies,opportunities:plan.opportunities,
  alternatives:plan.pathways.filter(p=>p.id!==path.id).map(p=>({id:p.id,label:p.label,description:p.description,minutes:p.userMinutes,feasibility:p.feasibility,why:p.why})),
  executionState:plan.execution.state,taskStatus:t.status,dueAt:t.dueAt||null,dueTime:t.dueTime||null,delegation:t.delegation||null};
}
export async function detailView(store:BearStore,taskId:string,now=new Date()){
 const t=await store.get('tasks',taskId);if(!t)throw new Error('not_found');const ctx=await ctxOf(store,now);
 const plan=await ensurePlan(store,t,ctx,now);return detailFrom(t,plan,ctx);
}
export interface BrainItem{id:string;title:string;category:string;categoryBy:'you'|'bear';domain:string;when:string|null;dot:'red'|'amber'|'green'|'grey';status:RStatus;statusLabel:string;reason:string|null;minutes:number|null;rank:number;createdAt:string}
export async function brainView(store:BearStore,now=new Date()){
 const {ctx,rows:r}=await rows(store,now);
 const projects=new Map((await store.list('projects')).map(p=>[p.id,p.areaKey]));
 const items:BrainItem[]=r.filter(x=>!(x.task.sharedOut?.mode==='transfer'&&x.task.readiness==='waiting')).map(({task,plan,status})=>{
  const cat=categoryOf(task,plan,ctx.lists,ctx.profile.listLearning);
  const d=plan.deadlines.opportunity&&plan.deadlines.opportunity>=ctx.today?plan.deadlines.opportunity:plan.deadlines.outcome;
  const left=d?Math.round((Date.parse(d)-Date.parse(ctx.today))/86400000):null;
  const dep=plan.dependencies.find(x=>x.status==='open');
  const opp=plan.opportunities.find(o=>o.status==='expiring'&&(o.id!=='order-online'||plan.selected==='online'));
  // Why it needs attention, if it does: a real deadline, a closing opportunity, something ready to check, an overdue reply.
  const reason=plan.kind==='aspiration'?null:left!==null&&left<=1?(left<0?'Past its date':left===0?'Needed today':'Needed tomorrow'):opp?'Opportunity closing':status==='awaiting_approval'?'Ready for you to check':dep&&dep.expectedBy&&dep.expectedBy<ctx.today?'No answer yet: check in':left!==null&&left<=3?'Coming up':null;
  return {id:task.id,title:task.title,category:cat.id,categoryBy:cat.by,domain:areaLabels[projects.get(task.projectId)||'']||'Me',when:d,dot:reason?(left!==null&&left<=1?'red':'amber'):status==='waiting'?'grey':'green',status,statusLabel:labelFor(status,plan),reason,minutes:nextForHer(plan)?.step.userMinutes??null,rank:task.listId?task.rank??0:Number.MAX_SAFE_INTEGER,createdAt:task.createdAt};
 });
 const rank=(i:BrainItem)=>(i.dot==='red'?0:1)+(i.when?0:0.5);
 const priority=items.filter(i=>i.reason).sort((a,b)=>rank(a)-rank(b)||(a.when||'9999').localeCompare(b.when||'9999'));
 return {total:items.length,waiting:items.filter(i=>i.status==='waiting').length,priority,categories:ctx.lists.map(l=>({id:l.id,title:l.title,icon:l.icon,items:items.filter(i=>i.category===l.id).sort((a,b)=>(a.rank-b.rank)||String(a.createdAt).localeCompare(String(b.createdAt)))})),lists:ctx.lists};
}

// ---------- What Bear has learned ----------
export async function preferencesView(store:BearStore){const p=await ensureProfile(store);return (p.preferences||[]).map(x=>({...x,text:describePreference(x)}));}
export async function removePreference(store:BearStore,id:string){const p=await ensureProfile(store);await store.update('profiles',p.id,{preferences:(p.preferences||[]).filter(x=>x.id!==id)});}
export const preferenceSchema=z.object({dimension:z.enum(['purchase_method']),value:z.enum(['online','in_person'])}).strict();
export async function setPreference(store:BearStore,input:z.infer<typeof preferenceSchema>,now=new Date()){const p=await ensureProfile(store);await store.update('profiles',p.id,{preferences:learn(p.preferences,input.dimension,input.value as Method,'explicit',now)});}
// After Drop Bear: plans for what was just added, and the one thing worth knowing straight away (if anything).
export async function afterDrop(store:BearStore,ids:string[],now=new Date()){
 const ctx=await ctxOf(store,now);let tip:{taskId:string;text:string}|null=null;
 for(const id of ids){const t=await store.get('tasks',id);if(!t)continue;const plan=await ensurePlan(store,t,ctx,now);
  // Only something genuinely time-sensitive is worth mentioning straight away: an opportunity closing within three days.
  const soon=(u:string|null)=>!!u&&u<=addDays(ctx.today,3);
  const o=plan.opportunities.find(x=>(x.status==='available'||x.status==='expiring')&&x.avoids&&soon(x.until)&&(x.id!=='order-online'||plan.selected==='online'));
  if(o&&!tip){const what=plan.item?`${plan.people[0]?`${plan.people[0]}’s `:''}${plan.item.replace(/^(a|an|some) /,'')}`:t.title.toLowerCase();
   tip={taskId:t.id,text:o.id==='order-online'?`One thing worth knowing: ordering ${what} today could save you a shopping trip.`:`One thing worth knowing: ${o.description.charAt(0).toLowerCase()}${o.description.slice(1)}`};}}
 return tip;
}
