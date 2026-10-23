import {z} from 'zod';
import {addDays,daysBetween,formatAU,todayISO} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import type {Bill,Profile,Suggestion} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {behaviourSignals,recordBehaviour} from './behaviour.ts';
import {createExpectation} from './completion.ts';
import {activeDayMode,ensureProfile} from './profile.ts';

// SuggestionService (Bear Ideas). Generates bill suggestions from real data only and
// learns from "Not relevant". Suppressed entirely in Chaos mode.
const addRelated:Record<string,{suggest:string;label:string}>={electricity:{suggest:'water',label:'water'},internet:{suggest:'mobile',label:'mobile phone'},gas:{suggest:'electricity',label:'electricity'}};
export async function refreshSuggestions(store:BearStore,now=new Date()):Promise<Suggestion[]>{
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const today=todayISO(tz,now);
 const signals=await behaviourSignals(store);
 const bills=await store.list('bills',{where:[{column:'status',op:'in',value:['watching','due_soon','paid']}]});
 const existing=await store.list('suggestions');
 const have=(key:string)=>existing.find(s=>s.dedupeKey===key);
 const rejectedKind=(kind:string)=>(signals.rejectedSuggestionKinds[kind]||0)>=3;
 const propose=async(kind:Suggestion['kind'],key:string,title:string,body:string,actionLabel:string,payload:Record<string,unknown>)=>{if(have(key)||rejectedKind(kind))return;await store.insert('suggestions',stamp<Suggestion>(store.userId,{kind,status:'open',dedupeKey:key,title,body,actionLabel,payload}));};
 for(const bill of bills){
  const f=bill.fields;
  // Bill increased vs. previous bill from the same biller.
  if(bill.previousBillId){const prev=await store.get('bills',bill.previousBillId);if(prev&&prev.amountCents>0&&bill.amountCents-prev.amountCents>=2000)await propose('bill_increased',`increase:${bill.id}`,`This ${bill.category.replace('_',' ')} bill is ${formatAUD(bill.amountCents-prev.amountCents)} more than the last one.`,`Want to look at why? Bear can line up the two bills and draft a question for ${bill.biller}.`,'Look at why',{billId:bill.id,previousBillId:prev.id});}
  // Early-payment discount with a deadline that has not passed.
  if(bill.status!=='paid'&&f.earlyDiscountCents.value&&f.discountDeadline.value&&f.discountDeadline.value>=today)await propose('discount_available',`discount:${bill.id}`,`${bill.biller} offers ${formatAUD(f.earlyDiscountCents.value)} off for paying by ${formatAU(f.discountDeadline.value,'short')}.`,'Want Bear to remind you before it expires?','Add to Bear',{billId:bill.id,deadline:f.discountDeadline.value});
  // Recurring bill not yet expected.
  if(bill.status!=='paid'&&f.isRecurring.value===true&&f.expectedRecurrence.value&&f.expectedRecurrence.value!=='unknown'&&!bill.recurringExpectationId){const label=f.expectedRecurrence.value.replace('_',' ');await propose('expect_recurring',`expect:${bill.billerKey||bill.biller}`,`Your ${bill.category.replace('_',' ')} bill looks ${label}.`,`Want Bear to expect the next one? I'll watch for it and tell you if it doesn't turn up.`,'Add to Bear',{billId:bill.id});}
  // Related categories.
  const related=addRelated[bill.category];
  if(related&&!bills.some(b=>b.category===related.suggest)&&!bill.isDemo)await propose('add_related_areas',`related:${related.suggest}`,`You've added ${bill.category.replace('_',' ')}. Want to add ${related.label} too?`,'Give Bear the next one when it arrives and it will keep them together.','Add to Bear',{category:related.suggest});
 }
 // Missing expected bills.
 for(const e of await store.list('recurring_expectations',{where:[{column:'status',value:'expecting'}]})){
  if(today>e.expectedTo){await store.update('recurring_expectations',e.id,{status:'missing'});await propose('missing_expected',`missing:${e.id}:${e.expectedTo}`,`Your ${e.biller} bill usually arrives around the ${ordinal(e.expectedTo)}. I haven't seen this one yet.`,'Want to check? If it has arrived, give it to Bear.','Check now',{expectationId:e.id});}
 }
 // Annual pattern: a yearly bill paid last year around now.
 for(const bill of bills.filter(b=>b.status==='paid'&&b.fields.expectedRecurrence.value==='yearly'&&b.dueAt)){const d=daysBetween(today,addDays(bill.dueAt!,365));if(d!==null&&d>=0&&d<=45&&!bill.recurringExpectationId)await propose('watch_annual',`annual:${bill.billerKey||bill.biller}:${bill.dueAt!.slice(0,4)}`,`You paid your ${bill.category.replace('_',' ')} around this time last year.`,'Want Bear to watch for it?','Add to Bear',{billId:bill.id});}
 const open=await store.list('suggestions',{where:[{column:'status',value:'open'}],orderBy:{column:'created_at',ascending:false}});
 return activeDayMode(profile,today)==='chaos'?[]:open;
}
const ordinal=(iso:string)=>{const d=+iso.slice(8,10);const s=d%10===1&&d!==11?'st':d%10===2&&d!==12?'nd':d%10===3&&d!==13?'rd':'th';return d+s;};

export const respondSchema=z.object({suggestionId:z.string().uuid(),response:z.enum(['accept','reject'])}).strict();
export async function respondToSuggestion(store:BearStore,input:z.infer<typeof respondSchema>,now=new Date()){
 const s=await store.get('suggestions',input.suggestionId);if(!s)throw new Error('not_found');
 if(s.status!=='open')return s;
 if(input.response==='reject'){await recordBehaviour(store,'suggestion_rejected',{kind:s.kind});return store.update('suggestions',s.id,{status:'rejected'});}
 await recordBehaviour(store,'suggestion_accepted',{kind:s.kind});
 if(s.kind==='expect_recurring'||s.kind==='watch_annual'){const bill=await store.get('bills',String(s.payload.billId));if(bill)await createExpectation(store,bill);}
 if(s.kind==='discount_available'){const bill=await store.get('bills',String(s.payload.billId));if(bill){const {acceptPlan}=await import('./reminder-planning.ts');const profile=await ensureProfile(store);const {zonedDateTime}=await import('../domain/dates.ts');const when=zonedDateTime(addDays(String(s.payload.deadline),-1),19*60,profile.lifeRhythm.timezone||'Australia/Sydney');if(new Date(when).getTime()>now.getTime())await acceptPlan(store,{billId:bill.id,when,label:'The evening before the discount ends',rationale:'So the discount is not missed.',key:'custom',followUpIfUnpaid:true},now);}}
 if(s.kind==='missing_expected'){const e=await store.get('recurring_expectations',String(s.payload.expectationId));if(e)await store.update('recurring_expectations',e.id,{status:'expecting',expectedTo:addDays(e.expectedTo,14)});}
 return store.update('suggestions',s.id,{status:'accepted'});
}
export function suggestionWeight(profile:Profile){return profile.pins.preferences.proactiveSuggestions==='often'?3:profile.pins.preferences.proactiveSuggestions==='rarely'?1:2;}
export type {Bill};
