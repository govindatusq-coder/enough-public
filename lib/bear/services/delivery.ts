import type {BearStore} from '../store/store.ts';
import {dueReminders,markDelivered,type DueReminder} from './reminders.ts';

// Deliver one person's due reminders by push. Safe to run again at any time:
//  - a reminder already delivered by push is skipped (so a second run doesn't double-send);
//  - a failed send is NOT marked delivered, so the next run tries again (at-least-once: a missed reminder is worse than a repeat);
//  - one bad subscription or failure never stops the rest.
export type PushSender=(sub:{endpoint:string;keys:{p256dh:string;auth:string}},payload:{title:string;body:string;url:string;tag:string})=>Promise<'sent'|'gone'|'failed'>;
// Opens the right thing: a bill opens its bill, everything else opens the task itself (never just "home").
export const reminderUrl=(d:Pick<DueReminder,'billId'|'reminder'>)=>d.billId?`/bear/bills/${d.billId}?reminder=${d.reminder.id}`:`/bear/tasks/${d.reminder.taskId}?reminder=${d.reminder.id}`;
export interface UserDelivery{delivered:number;failed:number;gone:string[]}
export async function deliverForUser(store:BearStore,subs:{endpoint:string;keys:{p256dh:string;auth:string}}[],send:PushSender,now=new Date()):Promise<UserDelivery>{
 const out:UserDelivery={delivered:0,failed:0,gone:[]};
 for(const due of await dueReminders(store,now)){
  if(due.reminder.deliveredVia.includes('push'))continue;
  let sent=false;
  for(const s of subs){
   let r:'sent'|'gone'|'failed';try{r=await send(s,{title:'Load Bear',body:due.decision.message,url:reminderUrl(due),tag:due.reminder.id});}catch{r='failed';}
   if(r==='sent')sent=true;else if(r==='gone')out.gone.push(s.endpoint);
  }
  if(sent){await markDelivered(store,due.reminder.id,'push',now);out.delivered++;}else if(subs.length)out.failed++;
 }
 return out;
}
