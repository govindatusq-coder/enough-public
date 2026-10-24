import {z} from 'zod';
import {addDays,daysBetween,formatWhen,localParts,parseISODate,todayISO,zonedDateTime} from '../domain/dates.ts';
import type {Bill,CapacityWindow,Profile,Reminder,ReminderPlan,Task} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {behaviourSignals} from './behaviour.ts';
import {capacityWindows} from './capacity.ts';
import {bestPlan,scorePlan,type PlanCandidate} from './coordination.ts';
import {activeDayMode,ensureProfile} from './profile.ts';
import {recordBehaviour} from './behaviour.ts';

// ReminderPlanningService. Recommends when Bear should bring a bill back, using the
// capacity map and the coordination engine so the deadline is protected and the
// reminder lands where the user is likely to have room.
export interface PlanOption{key:'bear'|'tomorrow'|'weekend'|'few_days'|'custom';label:string;when:string|null;rationale:string;score:number}
export interface PlanRecommendation{suggested:PlanOption;alternatives:PlanOption[];deadline:string|null;followUpDefault:boolean}

const leadDays={same_day:0,day_before:1,few_days:3,week:7};
function latestSafe(dueAt:string,prefs:Profile['pins']['preferences']){return addDays(dueAt,-Math.max(1,leadDays[prefs.reminderLeadTime]));}

export function candidateWindows(windows:CapacityWindow[],fromIso:string,untilIso:string){return windows.filter(w=>w.start>=fromIso&&w.start<=untilIso&&!w.protected&&w.score>0.25);}

export async function recommendPlan(store:BearStore,bill:Bill|null,task:Task,now=new Date()):Promise<PlanRecommendation>{
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
 const today=todayISO(tz,now);const dueAt=bill?.dueAt||task.dueAt;const prefs=profile.pins.preferences;
 const signals=await behaviourSignals(store);
 const windows=capacityWindows({profile,signals,dayMode:activeDayMode(profile,today),now,days:14});
 const horizonEnd=dueAt?Math.max(0,daysBetween(today,dueAt)??0):7;
 const latest=dueAt?latestSafe(dueAt,prefs):addDays(today,3);
 const untilIso=zonedDateTime(latest>today?latest:today,23*60+59,tz);
 const fromIso=new Date(now.getTime()+30*60000).toISOString();
 const candidates:PlanCandidate[]=candidateWindows(windows,fromIso,untilIso).map(w=>{
  const daysToDue=dueAt?daysBetween(w.start.slice(0,10),dueAt)??0:7;
  const deadlineRisk=daysToDue<=0?1:daysToDue===1?0.6:daysToDue<=2?0.3:0.05;
  const dependenciesPending=0;
  return {id:w.id,window:w,deadlineRisk,timeCost:task.estimatedMinutes/30,cognitiveEffort:task.cognitiveEffort==='high'?0.8:task.cognitiveEffort==='medium'?0.5:0.2,financialCost:0,dependencyReadiness:1-dependenciesPending,interruptionCost:1-w.routineFit*0.5-w.time*0.5,valueAlignment:0.5,delegationOpportunity:0,completionProbability:w.score};
 });
 // Prefer earlier among near-equal windows so the deadline keeps its buffer.
 const scored=candidates.map(c=>({c,s:scorePlan(c)})).sort((a,b)=>b.s.score-a.s.score||(a.c.window.start<b.c.window.start?-1:1));
 const best=scored[0];
 const bearOption:PlanOption=best?{key:'bear',label:formatWhen(best.c.window.start,tz),when:best.c.window.start,rationale:rationaleFor(best.s.reasons,daysBetween(today,dueAt||today)),score:best.s.score}:fallbackOption(today,dueAt,tz,now);
 const tomorrow=zonedDateTime(addDays(today,1),19*60+30,tz);const weekend=nextWeekendEvening(today,tz);const fewDays=dueAt?zonedDateTime(addDays(dueAt,-3)>today?addDays(dueAt,-3):addDays(today,1),19*60+30,tz):null;
 const alt=(key:PlanOption['key'],label:string,when:string|null,rationale:string):PlanOption=>({key,label,when,rationale,score:when?(windows.find(w=>w.start<=when&&w.end>when)?.score??0.3):0});
 const alternatives:PlanOption[]=[alt('tomorrow','Tomorrow evening',tomorrow,'Tomorrow at 7:30 pm'),alt('weekend','This weekend',weekend,'Saturday morning'),...(fewDays&&fewDays!==tomorrow?[alt('few_days','A few days before',fewDays,'Three days before it is due')]:[]),alt('custom','Choose a time',null,'Pick any time that suits')].filter(a=>a.when===null||(dueAt?a.when.slice(0,10)<=dueAt:true));
 return {suggested:bearOption,alternatives,deadline:dueAt,followUpDefault:true};
}
function rationaleFor(reasons:string[],daysToDue:number|null){if(reasons.length>=2)return `${cap(reasons[0])}, and ${reasons[1]}.`;if(reasons.length===1)return cap(reasons[0])+'.';return daysToDue!==null&&daysToDue>3?"This leaves a comfortable gap before it's due.":'This keeps it safely ahead of the due date.';}
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
function nextWeekendEvening(today:string,tz:string){const d=parseISODate(today)!;const add=(6-d.getDay()+7)%7||7;return zonedDateTime(addDays(today,add),9*60+30,tz);}
function fallbackOption(today:string,dueAt:string|null,tz:string,now:Date):PlanOption{
 // No open window before the deadline (e.g. due today): remind in an hour, honestly.
 const soon=new Date(now.getTime()+60*60000).toISOString();const sameDay=dueAt===today||dueAt===null;
 return {key:'bear',label:formatWhen(soon,tz),when:soon,rationale:sameDay?'This is due today, so the sooner the better. Bear will keep it quick.':'There is no quiet window before it is due, so Bear will bring it back soon.',score:0.2};
}
const bearLine=(bill:Bill|null,task:Task)=>bill?`Your ${bill.category.replace('_',' ')} bill is due ${bill.dueAt?'on '+bill.dueAt:'soon'}. Want me to help you sort it now?`:`${task.title}${task.dueAt?' is coming up on '+task.dueAt:''}. Want a hand with it now?`;
export const acceptPlanSchema=z.object({billId:z.string().uuid().optional(),taskId:z.string().uuid().optional(),when:z.string().datetime({offset:true}),label:z.string().max(80),rationale:z.string().max(300).default(''),key:z.enum(['bear','tomorrow','weekend','few_days','custom']),followUpIfUnpaid:z.boolean().default(true)}).strict();
export type AcceptPlanInput=z.infer<typeof acceptPlanSchema>;

export async function acceptPlan(store:BearStore,input:AcceptPlanInput,now=new Date()){
 const bill=input.billId?await store.get('bills',input.billId):null;if(input.billId&&!bill)throw new Error('not_found');
 const task=await store.get('tasks',bill?bill.taskId:(input.taskId||''));if(!task)throw new Error('not_found');
 const when=new Date(input.when);if(Number.isNaN(when.getTime())||when.getTime()<now.getTime()-60000)throw new Error('invalid_time');
 // Replace any earlier scheduled reminders for this task.
 const existing=await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]});
 for(const r of existing)await store.update('reminders',r.id,{status:'cancelled'});
 const plan:ReminderPlan={scheduledFor:when.toISOString(),label:input.label,rationale:input.rationale,windowId:null,score:0};
 const reminder=await store.insert('reminders',stamp<Reminder>(store.userId,{taskId:task.id,billId:bill?.id||null,kind:'planned',status:'scheduled',scheduledFor:plan.scheduledFor,plan,followUpIfUnpaid:input.followUpIfUnpaid,attempts:0,deliveredAt:null,deliveredVia:[],message:bearLine(bill,task)}));
 const reminders=[reminder];
 const dueAt=bill?.dueAt||task.dueAt;
 if(input.followUpIfUnpaid&&dueAt){
  const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
  const dayBefore=zonedDateTime(addDays(dueAt,-1),18*60+30,tz);
  if(new Date(dayBefore).getTime()>when.getTime()+6*3600000)reminders.push(await store.insert('reminders',stamp<Reminder>(store.userId,{taskId:task.id,billId:bill?.id||null,kind:'deadline',status:'scheduled',scheduledFor:dayBefore,plan:{scheduledFor:dayBefore,label:'The evening before',rationale:bill?'Only if it still is not paid.':'Only if it is still open.',windowId:null,score:0},followUpIfUnpaid:false,attempts:0,deliveredAt:null,deliveredVia:[],message:bill?`Your ${bill.category.replace('_',' ')} bill is due tomorrow. Want me to help you sort it now?`:`${task.title} is tomorrow. Want a hand getting it done?`})));
 }
 await recordBehaviour(store,input.key==='bear'?'plan_accepted':'plan_changed',{billId:bill?.id,taskId:task.id,key:input.key,hour:localParts(when).hour});
 return reminders;
}
