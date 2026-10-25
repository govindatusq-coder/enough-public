import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';

// Bear follows the phone's clock. When the phone's zone differs from the saved one, the saved
// zone changes and any reminder still waiting is planned again for the new zone, so nothing
// lands at a time that only made sense somewhere else.
export function isValidTimeZone(tz:unknown):tz is string{if(typeof tz!=='string'||!tz||tz.length>60)return false;try{new Intl.DateTimeFormat('en-AU',{timeZone:tz});return true;}catch{return false;}}

export async function setTimeZone(store:BearStore,timeZone:string,now=new Date()):Promise<{changed:boolean;from:string;to:string;replanned:number}>{
 const profile=await ensureProfile(store);const from=profile.lifeRhythm.timezone||'Australia/Sydney';
 if(from===timeZone)return {changed:false,from,to:timeZone,replanned:0};
 await store.update('profiles',profile.id,{lifeRhythm:{...profile.lifeRhythm,timezone:timeZone}});
 let replanned=0;
 const waiting=await store.list('reminders',{where:[{column:'status',op:'in',value:['scheduled','snoozed']}]});
 const taskIds=[...new Set(waiting.filter(r=>r.kind==='planned').map(r=>r.taskId))];
 for(const taskId of taskIds){
  const task=await store.get('tasks',taskId);if(!task||task.status!=='open')continue;
  const billId=waiting.find(r=>r.taskId===taskId)?.billId||null;const bill=billId?await store.get('bills',billId):null;
  try{
   const plan=await recommendPlan(store,bill,task,now);
   if(plan.suggested.when){await acceptPlan(store,{...(bill?{billId:bill.id}:{taskId}),when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:waiting.find(r=>r.taskId===taskId&&r.kind==='planned')?.followUpIfUnpaid??true},now);replanned++;}
  }catch{/* leave the old reminder rather than lose it */}
 }
 return {changed:true,from,to:timeZone,replanned};
}
