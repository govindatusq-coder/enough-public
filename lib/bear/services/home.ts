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

// My Bear assembly. Deliberately not a task list: what needs you, what Bear is
// handling, the three value ledgers and Chaos mode.
export interface OverdueItem{taskId:string;billId:string|null;title:string;amount:string|null;days:number;label:string}
export interface NeedsYouItem{soft:boolean;overdueDays:number;taskId:string;billId:string|null;kind:string;title:string;amount:string|null;due:string|null;dueLabel:string;minutes:number;reminderId:string|null;message:string|null;actions:{key:string;label:string}[];essential:boolean;isDemo:boolean}
export interface HomeView{
 greeting:string;name:string;coveredCount:number;dayMode:DayMode|null;today:string;
 needsYou:NeedsYouItem[];overdue:OverdueItem[];areas:AreaTile[];wishlist:{count:number;next:string|null};handling:{watching:number;held:number;remindersReady:number;expectedSoon:number;lines:string[]};
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
 const needsYou=needsYouItems(bills,tasks,due,today,dayMode);
 const overdue=overdueItems(bills,tasks,today);
 const needsTaskIds=new Set(needsYou.map(n=>n.taskId));
 const watching=bills.filter(b=>!needsTaskIds.has(b.taskId)).length;
 const otherHeld=tasks.filter(t=>t.kind!=='pay_bill'&&!needsTaskIds.has(t.id)).length;
 const expectedSoon=expectations.filter(e=>{const d=daysBetween(today,e.expectedFrom);return d!==null&&d<=10;}).length;
 const lines:string[]=[];
 if(watching)lines.push(`${watching} ${watching===1?'bill':'bills'} being watched`);
 if(otherHeld)lines.push(`${otherHeld} other ${otherHeld===1?'thing':'things'} being held for you`);
 const ready=scheduled.filter(r=>!needsYou.some(n=>n.reminderId===r.id)).length;if(ready)lines.push(`${ready} ${ready===1?'reminder':'reminders'} ready`);
 if(expectedSoon)lines.push(`${expectedSoon} recurring ${expectedSoon===1?'bill':'bills'} expected soon`);
 const ledgerRows=await store.list('value_ledger',{orderBy:{column:'occurred_at',ascending:false},limit:200});
 const covered=bills.length+otherHeld+scheduled.length+expectations.length+suggestions.length;
 const hour=localParts(now,tz).hour;
 return {greeting:greeting(hour,profile.name||fallbackName),name:profile.name||fallbackName,coveredCount:covered,dayMode,today,needsYou,overdue,areas:await areaTiles(store,profile.areas,attentionByArea(needsYou,overdue,allOpen,await store.list('projects'))),wishlist:{count:wished.length,next:wished.map(t=>t.wishlist!.checkBackAt).filter((d):d is string=>!!d).sort()[0]||null},handling:{watching,held:otherHeld,remindersReady:ready,expectedSoon,lines},ledgers:ledgers(ledgerRows,today,tasks),ideasCount:suggestions.length,demoAvailable:!profile.demoOffered&&bills.length===0&&!(await store.list('bills',{limit:1})).length,hasAnyBill:(await store.list('bills',{limit:1})).length>0};
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
function overdueItems(bills:Bill[],tasks:Task[],today:string):OverdueItem[]{
 const out:OverdueItem[]=[];const billTasks=new Set(bills.map(b=>b.taskId));
 for(const b of bills){const days=overdueDays(b.dueAt,today);if(days>0)out.push({taskId:b.taskId,billId:b.id,title:`${categoryWord(b.category)} bill`,amount:formatAUD(b.amountCents),days,label:overdueLabel(days)});}
 for(const t of tasks){if(billTasks.has(t.id))continue;const days=overdueDays(t.dueAt,today,t.timing);if(days>0)out.push({taskId:t.id,billId:null,title:t.title,amount:null,days,label:overdueLabel(days)});}
 return out.sort((a,b)=>b.days-a.days);
}
function needsYouItems(bills:Bill[],tasks:Task[],due:DueReminder[],today:string,dayMode:DayMode|null):NeedsYouItem[]{
 const items:NeedsYouItem[]=[];
 for(const d of due){
  const bill=d.billId?bills.find(b=>b.id===d.billId):undefined;const task=tasks.find(t=>t.id===d.reminder.taskId);
  items.push({soft:d.reminder.kind==='nudge',overdueDays:overdueDays(bill?.dueAt||task?.dueAt||null,today,task?.timing),taskId:d.reminder.taskId,billId:d.billId,kind:task?.kind||'custom',title:bill?`${categoryWord(bill.category)} bill`:d.taskTitle,amount:bill?formatAUD(bill.amountCents):null,due:bill?.dueAt||task?.dueAt||null,dueLabel:dueLabel(bill?.dueAt||task?.dueAt||null,today),minutes:task?.estimatedMinutes||2,reminderId:d.reminder.id,message:d.decision.message,actions:d.decision.actions,essential:d.decision.essential,isDemo:!!bill?.isDemo});
 }
 // Anything due within two days always needs you, even without a reminder firing yet (deadline protection).
 for(const task of tasks){
  if(items.some(i=>i.taskId===task.id))continue;
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
