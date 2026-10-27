import {daysBetween,localParts,relativeDay,todayISO} from '../domain/dates.ts';
import {overdueDays,overdueLabel} from '../domain/overdue.ts';
import {areaTiles,type AreaTile} from './areas.ts';
import {formatAUD} from '../domain/money.ts';
import {brand,greeting} from '../domain/copy.ts';
import type {Bill,DayMode,Profile,Reminder,Suggestion,Task,ValueLedgerEntry} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {activeDayMode,ensureProfile} from './profile.ts';
import {dueReminders,type DueReminder} from './reminders.ts';
import {refreshSuggestions} from './suggestions.ts';
import {recompute} from '../load/engine.ts';
import {describe,type LoadView} from '../load/view.ts';
import {caps} from './load.ts';
import {prioritiseOpen,priorityEnabled} from './priority.ts';
import {priorityIdeas} from './priority-ideas.ts';
import type {Reason} from '../priority/types.ts';

// My Bear assembly. Deliberately not a task list: what needs you, what Bear is
// handling, the three value ledgers and Chaos mode.
export interface OverdueItem{taskId:string;billId:string|null;title:string;amount:string|null;days:number;label:string}
export interface NeedsYouItem{soft:boolean;overdueDays:number;taskId:string;billId:string|null;kind:string;title:string;amount:string|null;due:string|null;dueLabel:string;minutes:number;reminderId:string|null;message:string|null;actions:{key:string;label:string}[];essential:boolean;isDemo:boolean}
export interface OneThing{taskId:string;billId:string|null;title:string;action:string;minutes:number;line:string;bearHasRest:boolean;firstStep:string|null;why:{headline:string;reasons:Reason[]}}
export interface HomeView{
 greeting:string;name:string;coveredCount:number;dayMode:DayMode|null;today:string;
 needsYou:NeedsYouItem[];overdue:OverdueItem[];areas:AreaTile[];wishlist:{count:number;next:string|null};handling:{watching:number;held:number;remindersReady:number;expectedSoon:number;lines:string[];covered:number;waiting:number;needs:number;coveredLines:string[]};
 // The Priority Engine's pick: one thing worth doing now, or null (nothing for you to do).
 oneThing:OneThing|null;
 ledgers:{health:{headline:string;lines:string[]};wealth:{headline:string|null;lines:string[]};happiness:{headline:string|null;lines:string[]}};
 ideasCount:number;demoAvailable:boolean;hasAnyBill:boolean;
}
export async function homeView(store:BearStore,now=new Date(),fallbackName=''):Promise<HomeView>{
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const today=todayISO(tz,now);const dayMode=activeDayMode(profile,today);
 const bills=await store.list('bills',{where:[{column:'status',op:'in',value:['watching','due_soon']}],orderBy:{column:'due_at'}});
 const allOpen=await store.list('tasks',{where:[{column:'status',value:'open'}]});
 const stepIds=new Set((await store.list('task_dependencies')).map(d=>d.dependsOnTaskId));
 const wished=allOpen.filter(t=>t.wishlist&&!stepIds.has(t.id));
 const tasks=allOpen.filter(t=>!stepIds.has(t.id)&&!t.wishlist);
 const scheduled=await store.list('reminders',{where:[{column:'status',op:'in',value:['scheduled','snoozed']}]});
 const expectations=await store.list('recurring_expectations',{where:[{column:'status',value:'expecting'}]});
 const due=await dueReminders(store,now);
 const suggestions=await refreshSuggestions(store,now);
 // Loads understood by the engine speak for themselves: what needs the person is their minimum
 // human action, nothing more. Older items keep the date-based rules they always had.
 const loads=new Map<string,LoadView>();
 // "No rush" stays no rush: those loads are held quietly and only nudge if the person asked.
 for(const t of tasks)if(t.load&&!t.load.migrated)loads.set(t.id,describe(recompute(t.load,today,caps(),profile.loadMap),today,{quiet:t.timing==='flexible'}));
 // A brain-dump project brings back only its next to-do, never the whole list.
 const dumpProjects=new Map((await store.list('projects')).filter(p=>p.captureId).map(p=>[p.id,p]));
 const nextInProject=new Set<string>();
 for(const pid of dumpProjects.keys()){const first=tasks.filter(t=>t.projectId===pid).sort((a,b)=>(a.order??0)-(b.order??0))[0];if(first)nextInProject.add(first.id);}
 const urgent=new Map([...loads].filter(([id])=>{const t=tasks.find(x=>x.id===id);return t?.timing!=='flexible'&&(!dumpProjects.has(t?.projectId||'')||nextInProject.has(id));}).map(([id,v])=>{const t=tasks.find(x=>x.id===id)!;const p=dumpProjects.get(t.projectId);return [id,p?{...v,title:p.title}:v];}));
 const quietDump=new Set(tasks.filter(t=>dumpProjects.has(t.projectId)&&!nextInProject.has(t.id)).map(t=>t.id));
 const needsYou=needsYouItems(bills,tasks.filter(t=>!quietDump.has(t.id)),due.filter(d=>!quietDump.has(d.reminder.taskId)),today,dayMode,urgent);
 const overdue=overdueItems(bills,tasks,today,urgent);
 const needsTaskIds=new Set(needsYou.map(n=>n.taskId));
 const watching=bills.filter(b=>!needsTaskIds.has(b.taskId)).length;
 const otherHeld=tasks.filter(t=>t.kind!=='pay_bill'&&!needsTaskIds.has(t.id)).length;
 const expectedSoon=expectations.filter(e=>{const d=daysBetween(today,e.expectedFrom);return d!==null&&d<=10;}).length;
 const lines:string[]=[];
 if(watching)lines.push(`${watching} ${watching===1?'bill':'bills'} being watched`);
 if(otherHeld)lines.push(`${otherHeld} other ${otherHeld===1?'thing':'things'} being held for you`);
 const ready=scheduled.filter(r=>!needsYou.some(n=>n.reminderId===r.id)).length;if(ready)lines.push(`${ready} ${ready===1?'reminder':'reminders'} ready`);
 if(expectedSoon)lines.push(`${expectedSoon} recurring ${expectedSoon===1?'bill':'bills'} expected soon`);
 const loadViews=[...loads.values()];
 let waitingCount=loadViews.filter(v=>v.state==='waiting'&&!v.needsYou).length;
 let needsCount=new Set(needsYou.filter(n=>!n.soft).map(n=>n.taskId)).size;
 // Priority Engine: the Need-you number is what genuinely benefits from the person now, kept small.
 let oneThing:OneThing|null=null;
 if(priorityEnabled()){
  const pr=await prioritiseOpen(store,now);const engine=new Set(pr.results.keys());
  needsCount=pr.needs+new Set(needsYou.filter(n=>!n.soft&&!engine.has(n.taskId)).map(n=>n.taskId)).size;
  waitingCount=[...pr.results.values()].filter(r=>r.timingLabel==='Waiting').length;
  const t=pr.top?tasks.find(x=>x.id===pr.top!.id):null;
  if(pr.top&&t){const r=pr.top;const proj=dumpProjects.get(t.projectId);const bill=bills.find(b=>b.taskId===t.id)||null;
   const pressure=r.explanation.reasons.find(x=>x.key==='pressure'||x.key==='lead'||x.key==='deadline'||x.key==='safety');
   oneThing={taskId:t.id,billId:bill?.id||null,title:proj?`${proj.title}: ${t.title}`:(loads.get(t.id)?.title||t.title),action:loads.get(t.id)?.needsYou?.headline||r.action||t.title,minutes:r.minutes,line:pressure?pressure.text:r.explanation.primaryReason,bearHasRest:r.bearSteps>0,firstStep:r.firstStep,why:{headline:r.explanation.headline,reasons:r.explanation.reasons}};}
 }
 const coveredCount=Math.max(0,tasks.length-needsCount-waitingCount);
 const coveredLines=loadViews.filter(v=>!v.needsYou).flatMap(v=>v.waiting.length?[`${v.title}: waiting on ${v.waiting[0].who}`]:v.covered.slice(0,1)).slice(0,8);
 const ledgerRows=await store.list('value_ledger',{orderBy:{column:'occurred_at',ascending:false},limit:200});
 const covered=bills.length+otherHeld+scheduled.length+expectations.length+suggestions.length;
 const hour=localParts(now,tz).hour;
 return {greeting:greeting(hour,profile.name||fallbackName),name:profile.name||fallbackName,coveredCount:covered,dayMode,today,needsYou,overdue,areas:await areaTiles(store,profile.areas,attentionByArea(needsYou,overdue,allOpen,await store.list('projects'))),wishlist:{count:wished.length,next:wished.map(t=>t.wishlist!.checkBackAt).filter((d):d is string=>!!d).sort()[0]||null},handling:{watching,held:otherHeld,remindersReady:ready,expectedSoon,lines,covered:coveredCount,waiting:waitingCount,needs:needsCount,coveredLines},oneThing,ledgers:ledgers(ledgerRows,today,tasks),ideasCount:suggestions.length+(priorityEnabled()?(await priorityIdeas(store,now).catch(()=>[])).length:0),demoAvailable:!profile.demoOffered&&bills.length===0&&!(await store.list('bills',{limit:1})).length,hasAnyBill:(await store.list('bills',{limit:1})).length>0};
}
// Which areas have something that needs the person: things due soon or overdue, and due reminders. Gentle
// "no rush" nudges never make a number; they only mark the area with a quiet dot.
function attentionByArea(needs:NeedsYouItem[],overdue:OverdueItem[],open:Task[],projects:{id:string;areaKey:string}[]){
 const areaOfProject=new Map(projects.map(p=>[p.id,p.areaKey]));const areaOf=(taskId:string)=>{const t=open.find(x=>x.id===taskId);return (t&&areaOfProject.get(t.projectId))||'me';};
 const out=new Map<string,{needs:Set<string>;overdue:Set<string>;soft:boolean}>();
 const entry=(k:string)=>{let e=out.get(k);if(!e){e={needs:new Set(),overdue:new Set(),soft:false};out.set(k,e);}return e;};
 for(const n of needs){const e=entry(areaOf(n.taskId));if(n.soft){e.soft=true;continue;}e.needs.add(n.taskId);if(n.overdueDays>0)e.overdue.add(n.taskId);}
 for(const o of overdue){const e=entry(areaOf(o.taskId));e.needs.add(o.taskId);e.overdue.add(o.taskId);}
 return out;
}
function overdueItems(bills:Bill[],tasks:Task[],today:string,loads:Map<string,LoadView>):OverdueItem[]{
 const out:OverdueItem[]=[];const billTasks=new Set(bills.map(b=>b.taskId));
 // A load is overdue when the thing that needs the person has passed its date, not the event itself.
 for(const t of tasks){const v=loads.get(t.id);if(!v||billTasks.has(t.id))continue;const due=v.needsYou?(v.needsYou.dueAt||t.dueAt):null;const days=due?overdueDays(due,today):0;if(days>0)out.push({taskId:t.id,billId:null,title:v.title,amount:null,days,label:overdueLabel(days)});}
 for(const b of bills){const days=overdueDays(b.dueAt,today);if(days>0)out.push({taskId:b.taskId,billId:b.id,title:`${categoryWord(b.category)} bill`,amount:formatAUD(b.amountCents),days,label:overdueLabel(days)});}
 for(const t of tasks){if(billTasks.has(t.id)||loads.has(t.id))continue;const days=overdueDays(t.dueAt,today,t.timing);if(days>0)out.push({taskId:t.id,billId:null,title:t.title,amount:null,days,label:overdueLabel(days)});}
 return out.sort((a,b)=>b.days-a.days);
}
function needsYouItems(bills:Bill[],tasks:Task[],due:DueReminder[],today:string,dayMode:DayMode|null,loads:Map<string,LoadView>=new Map()):NeedsYouItem[]{
 const items:NeedsYouItem[]=[];
 for(const [taskId,v] of loads){
  if(!v.needsYou)continue;const task=tasks.find(t=>t.id===taskId)!;const bill=bills.find(b=>b.taskId===taskId)||null;const d=v.needsYou.dueAt;
  // Chaos day: only what genuinely can't wait (due today or tomorrow, or overdue).
  if(dayMode==='chaos'&&d&&(daysBetween(today,d)??99)>1)continue;
  items.push({soft:false,overdueDays:d?overdueDays(d,today):0,taskId,billId:bill?.id||null,kind:task.kind,title:v.title,amount:bill?formatAUD(bill.amountCents):null,due:d,dueLabel:dueLabel(d,today),minutes:task.estimatedMinutes||2,reminderId:null,message:v.needsYou.headline,actions:[],essential:!!d&&(daysBetween(today,d)??99)<=1,isDemo:task.isDemo});
 }
 for(const d of due){
  const bill=d.billId?bills.find(b=>b.id===d.billId):undefined;const task=tasks.find(t=>t.id===d.reminder.taskId);
  // A load's reminder only matters when the load itself has something for the person.
  if(loads.has(d.reminder.taskId)){const it=items.find(i=>i.taskId===d.reminder.taskId);if(it&&!it.reminderId)it.reminderId=d.reminder.id;continue;}
  items.push({soft:d.reminder.kind==='nudge',overdueDays:overdueDays(bill?.dueAt||task?.dueAt||null,today,task?.timing),taskId:d.reminder.taskId,billId:d.billId,kind:task?.kind||'custom',title:bill?`${categoryWord(bill.category)} bill`:d.taskTitle,amount:bill?formatAUD(bill.amountCents):null,due:bill?.dueAt||task?.dueAt||null,dueLabel:dueLabel(bill?.dueAt||task?.dueAt||null,today),minutes:task?.estimatedMinutes||2,reminderId:d.reminder.id,message:d.decision.message,actions:d.decision.actions,essential:d.decision.essential,isDemo:!!bill?.isDemo});
 }
 // Anything due within two days always needs you, even without a reminder firing yet (deadline protection).
 for(const task of tasks){
  if(items.some(i=>i.taskId===task.id)||loads.has(task.id))continue;
  const bill=bills.find(b=>b.taskId===task.id)||null;const due=bill?.dueAt||task.dueAt;
  const d=due&&task.timing!=='flexible'?daysBetween(today,due):null;
  if(d!==null&&d<=2){if(dayMode==='chaos'&&d>1)continue;items.push({soft:false,overdueDays:overdueDays(due,today,task.timing),taskId:task.id,billId:bill?.id||null,kind:task.kind,title:bill?`${categoryWord(bill.category)} bill`:task.title,amount:bill?formatAUD(bill.amountCents):null,due,dueLabel:dueLabel(due,today),minutes:task.estimatedMinutes||2,reminderId:null,message:null,actions:[],essential:true,isDemo:bill?bill.isDemo:task.isDemo});}
 }
 return items.sort((a,b)=>(a.due||'')<(b.due||'')?-1:1);
}
export const categoryWord=(c:string)=>({electricity:'Electricity',gas:'Gas',water:'Water',internet:'Internet',mobile:'Mobile',council_rates:'Council rates',car_registration:'Car registration',insurance:'Insurance',school_fees:'School fee',childcare:'Childcare',sports_fees:'Sports fee',subscription:'Subscription',rent:'Rent',strata:'Strata',medical:'Medical',other:'Bill'} as Record<string,string>)[c]||'Bill';
function dueLabel(due:string|null,today:string){if(!due)return 'No due date yet';const d=daysBetween(today,due);if(d===null)return '';if(d<0)return 'Past the due date';const rel=relativeDay(due,today);return 'Due '+(rel==='today'||rel==='tomorrow'?rel:rel);}
function ledgers(rows:ValueLedgerEntry[],today:string,tasks:Task[]):HomeView['ledgers']{
 const month=today.slice(0,7);
 const wealth=rows.filter(r=>r.kind==='wealth'&&r.defensible&&!r.isDemo&&r.occurredAt.slice(0,7)===month);
 const wealthTotal=wealth.reduce((s,r)=>s+(r.amountCents||0),0);
 const health=rows.filter(r=>r.kind==='health'&&!r.isDemo&&r.occurredAt>=weekStart(today));
 const happiness=rows.filter(r=>r.kind==='happiness'&&!r.isDemo&&r.occurredAt>=weekStart(today));
 const happyMinutes=happiness.reduce((s,r)=>s+(r.minutes||0),0);
 return {
  health:{headline:health.length?`${health.length} ${health.length===1?'thing':'things'} for you this week`:'Nothing for you yet this week',lines:health.slice(0,3).map(r=>r.label)},
  wealth:{headline:wealthTotal>0?`${formatAUD(wealthTotal)} protected this month`:null,lines:wealth.slice(0,3).map(r=>`${formatAUD(r.amountCents)} ${shortReason(r.reason)}`)},
  happiness:{headline:happyMinutes>0?`${Math.floor(happyMinutes/60)}h ${happyMinutes%60}m protected`:null,lines:happiness.slice(0,3).map(r=>r.label)},
 };
}
const shortReason=(r:string)=>({late_fee_avoided:'late fee avoided',early_discount_used:'early payment discount',subscription_cancelled:'subscription cancelled',better_price:'better price',discount_used:'discount used',duplicate_charge:'duplicate charge found'} as Record<string,string>)[r]||r;
function weekStart(today:string){const d=new Date(today+'T12:00:00');const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d.toISOString().slice(0,10);}
export type {Profile,Reminder,Suggestion};
export const emptyCopy=brand;
