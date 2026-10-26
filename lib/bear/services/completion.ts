import {z} from 'zod';
import {addDays,addMonths,daysBetween,todayISO} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import type {Bill,Completion,RecurringExpectation,Suggestion,ValueLedgerEntry,Win} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {ensureProfile} from './profile.ts';
import {resolveLoad,syncNextInProject} from './load.ts';

// CompletionService + ValueLedgerService + recurring intelligence.
// Marking a bill paid closes the task, writes the Completion and Win, records a
// Wealth entry ONLY when a defensible saving exists, and (if the user agreed, or
// to ask) sets up the recurring expectation.
export const completeSchema=z.object({taskId:z.string().uuid(),method:z.string().max(40).nullable().default(null),paidOn:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),expectNext:z.boolean().nullable().default(null)}).strict();
export type CompleteInput=z.infer<typeof completeSchema>;

export async function completeTask(store:BearStore,input:CompleteInput,now=new Date()){
 const task=await store.get('tasks',input.taskId);if(!task)throw new Error('not_found');
 if(task.status==='done')throw new Error('already_done');
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
 const today=input.paidOn||todayISO(tz,now);
 const bills=await store.list('bills',{where:[{column:'task_id',value:task.id}]});const bill=bills[0]||null;
 const daysBeforeDue=task.dueAt?daysBetween(today,task.dueAt):null;
 await store.update('tasks',task.id,{status:'done'});
 if(input.method!=='load')await resolveLoad(store,task,now);
 await syncNextInProject(store,task.projectId,now);
 const completion=await store.insert('completions',stamp<Completion>(store.userId,{taskId:task.id,billId:bill?.id||null,completedAt:now.toISOString(),daysBeforeDue,method:input.method}));
 // Cancel outstanding reminders quietly and close dependencies.
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed','delivered']}]}))await store.update('reminders',r.id,{status:'actioned'});
 for(const d of await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})){const dep=await store.get('tasks',d.dependsOnTaskId);if(dep&&dep.status==='open')await store.update('tasks',dep.id,{status:'done'});}
 const lastDelivered=(await store.list('reminders',{where:[{column:'task_id',value:task.id}]})).map(r=>r.deliveredAt).filter(Boolean).sort().pop();
 await recordBehaviour(store,'task_completed',{taskId:task.id,billId:bill?.id,daysBeforeDue,minutesSinceReminder:lastDelivered?Math.round((now.getTime()-new Date(lastDelivered).getTime())/60000):undefined},now);
 let win:Win|null=null;const ledger:ValueLedgerEntry[]=[];let expectation:RecurringExpectation|null=null;let suggestion:Suggestion|null=null;
 if(bill){
  await store.update('bills',bill.id,{status:'paid',paidAt:now.toISOString()});
  await store.update('projects',bill.projectId,{status:'done'});
  const wealth=defensibleSaving(bill,today);
  for(const w of wealth)ledger.push(await store.insert('value_ledger',stamp<ValueLedgerEntry>(store.userId,{kind:'wealth',reason:w.reason,label:w.label,amountCents:w.cents,minutes:null,occurredAt:now.toISOString(),sourceTaskId:task.id,sourceBillId:bill.id,defensible:true,isDemo:bill.isDemo})));
  const timing=daysBeforeDue===null?'Done':daysBeforeDue>1?`${daysBeforeDue} days early`:daysBeforeDue===1?'1 day early':daysBeforeDue===0?'On the day':'Done';
  win=await store.insert('wins',stamp<Win>(store.userId,{completionId:completion.id,category:'handled',title:`${bill.category==='other'?bill.biller:categoryLabel(bill.category)} bill paid`,detail:[timing,...wealth.map(w=>`+${formatAUD(w.cents)} ${w.short}`)].join(' · '),amountCents:wealth.reduce((s,w)=>s+w.cents,0)||null,minutes:null,billId:bill.id,isDemo:bill.isDemo}));
  // Recurring: create the expectation if the user said yes; otherwise ask via a suggestion.
  const recurring=bill.fields.isRecurring.value===true&&bill.fields.expectedRecurrence.value&&bill.fields.expectedRecurrence.value!=='unknown';
  if(recurring&&input.expectNext===true)expectation=await createExpectation(store,bill);
  else if(recurring&&input.expectNext===null)suggestion=await askToExpect(store,bill);
  const existing=bill.recurringExpectationId?await store.get('recurring_expectations',bill.recurringExpectationId):null;
  if(existing&&existing.status==='expecting')await store.update('recurring_expectations',existing.id,{status:'arrived'});
 }else{
  // A finished main task closes its project (the PARA archive); a finished step does not.
  const isStep=(await store.list('task_dependencies',{where:[{column:'depends_on_task_id',value:task.id}]})).length>0;
  if(!isStep)await store.update('projects',task.projectId,{status:'done'});
  const timing=daysBeforeDue===null||isStep?'Done':daysBeforeDue>1?`${daysBeforeDue} days early`:daysBeforeDue===1?'1 day early':daysBeforeDue===0?'On the day':'Done';
  if(!isStep)win=await store.insert('wins',stamp<Win>(store.userId,{completionId:completion.id,category:task.kind==='appointment'&&/me|gp|doctor|dentist|physio/i.test(task.title)&&!task.forPerson?'me':'handled',title:task.title,detail:timing,amountCents:null,minutes:null,billId:null,isDemo:task.isDemo}));
 }
 return {completion,win:win as Win,ledger,expectation,suggestion};
}
export const categoryLabel=(c:string)=>({electricity:'Electricity',gas:'Gas',water:'Water',internet:'Internet',mobile:'Mobile',council_rates:'Council rates',car_registration:'Car registration',insurance:'Insurance',school_fees:'School fee',childcare:'Childcare',sports_fees:'Sports fee',subscription:'Subscription',rent:'Rent',strata:'Strata',medical:'Medical',other:'Bill'} as Record<string,string>)[c]||'Bill';

// A Wealth entry is only defensible when the bill states a specific fee or discount and the
// payment timing actually earned it. Nothing is estimated.
export function defensibleSaving(bill:Bill,paidOn:string){
 const out:{reason:ValueLedgerEntry['reason'];label:string;short:string;cents:number}[]=[];const f=bill.fields;
 if(f.lateFeeCents.value&&f.lateFeeCents.value>0&&bill.dueAt&&paidOn<=bill.dueAt)out.push({reason:'late_fee_avoided',label:`${bill.biller} late fee avoided`,short:'late fee avoided',cents:f.lateFeeCents.value});
 if(f.earlyDiscountCents.value&&f.earlyDiscountCents.value>0&&(f.discountDeadline.value?paidOn<=f.discountDeadline.value:bill.dueAt?paidOn<=bill.dueAt:false))out.push({reason:'early_discount_used',label:`${bill.biller} early payment discount`,short:'early payment discount',cents:f.earlyDiscountCents.value});
 return out;
}
const monthsFor:Record<string,number>={monthly:1,quarterly:3,half_yearly:6,yearly:12};
export function nextWindow(lastDue:string,recurrence:string){
 if(recurrence==='weekly')return {from:addDays(lastDue,5),to:addDays(lastDue,9),centre:addDays(lastDue,7)};
 if(recurrence==='fortnightly')return {from:addDays(lastDue,12),to:addDays(lastDue,16),centre:addDays(lastDue,14)};
 const m=monthsFor[recurrence]||1;const centre=addMonths(lastDue,m);return {from:addDays(centre,-7),to:addDays(centre,7),centre};
}
export async function createExpectation(store:BearStore,bill:Bill){
 const recurrence=bill.fields.expectedRecurrence.value||'monthly';const lastDue=bill.dueAt||todayISO();
 const prior=bill.billerKey?(await store.list('recurring_expectations',{where:[{column:'biller_key',value:bill.billerKey},{column:'status',op:'in',value:['expecting','arrived','missing']}]}))[0]:undefined;
 const observed=[...(prior?.observedDueDates||[]),lastDue].filter((d,i,a)=>a.indexOf(d)===i).sort();
 // Learn the typical arrival from observed due dates (median gap) rather than the label alone.
 const win=learnedWindow(observed,recurrence);
 const payload={billerKey:bill.billerKey||bill.biller.toLowerCase(),biller:bill.biller,category:bill.category,recurrence,status:'expecting' as const,lastDueAt:lastDue,expectedFrom:win.from,expectedTo:win.to,typicalAmountCents:null,observedDueDates:observed,lastBillId:bill.id};
 const expectation=prior?await store.update('recurring_expectations',prior.id,payload):await store.insert('recurring_expectations',stamp<RecurringExpectation>(store.userId,payload));
 await store.update('bills',bill.id,{recurringExpectationId:expectation.id});
 await recordBehaviour(store,'suggestion_accepted',{kind:'expect_recurring',billId:bill.id});
 return expectation;
}
export function learnedWindow(observed:string[],recurrence:string){
 if(observed.length>=2){const gaps=observed.slice(1).map((d,i)=>daysBetween(observed[i],d)||0).sort((a,b)=>a-b);const gap=gaps[Math.floor(gaps.length/2)];if(gap>=5){const last=observed[observed.length-1];return {from:addDays(last,gap-4),to:addDays(last,gap+4),centre:addDays(last,gap)};}}
 return nextWindow(observed[observed.length-1],recurrence);
}
async function askToExpect(store:BearStore,bill:Bill){
 const key=`expect:${bill.billerKey||bill.biller}`;
 const existing=await store.list('suggestions',{where:[{column:'dedupe_key',value:key}]});if(existing.length)return existing[0];
 const label=(bill.fields.expectedRecurrence.value||'monthly').replace('_',' ').replace('ly','');
 return store.insert('suggestions',stamp<Suggestion>(store.userId,{kind:'expect_recurring',status:'open',dedupeKey:key,title:`Looks like this happens every ${label==='year'?'year':label==='quarter'?'quarter':label==='fortnight'?'fortnight':label==='week'?'week':'month'}.`,body:`Want me to expect the next ${bill.biller} bill? I'll watch for it and let you know if it doesn't turn up.`,actionLabel:'Add to Bear',payload:{billId:bill.id}}));
}
export async function dropTask(store:BearStore,taskId:string){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 await store.update('tasks',taskId,{status:'dropped'});
 for(const r of await store.list('reminders',{where:[{column:'task_id',value:taskId},{column:'status',op:'in',value:['scheduled','snoozed','delivered']}]}))await store.update('reminders',r.id,{status:'cancelled'});
 for(const b of await store.list('bills',{where:[{column:'task_id',value:taskId}]})){await store.update('bills',b.id,{status:'dropped'});await store.update('projects',b.projectId,{status:'archived'});}
 await recordBehaviour(store,'task_dropped',{taskId});
}
