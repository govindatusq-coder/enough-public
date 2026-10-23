import {z} from 'zod';
import {addDays,todayISO,zonedDateTime} from '../domain/dates.ts';
import type {Reminder,ReminderInteraction} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {behaviourSignals,recordBehaviour} from './behaviour.ts';
import {dropTask} from './completion.ts';
import {decide,type Decision} from './notification-decision.ts';
import {activeDayMode,ensureProfile} from './profile.ts';

// Reminder delivery and interaction. `dueReminders` is what the home screen and the cron
// route call; it returns reminders the decision service says should be delivered now.
export interface DueReminder{reminder:Reminder;decision:Extract<Decision,{deliver:true}>;taskTitle:string;billId:string|null}
export async function dueReminders(store:BearStore,now=new Date()):Promise<DueReminder[]>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);const dayMode=activeDayMode(profile,today);
 const signals=await behaviourSignals(store);
 const horizon=new Date(now.getTime()+36*3600000).toISOString();
 const reminders=await store.list('reminders',{where:[{column:'status',op:'in',value:['scheduled','snoozed']},{column:'scheduled_for',op:'lte',value:horizon}],orderBy:{column:'scheduled_for'}});
 const out:DueReminder[]=[];const seenTasks=new Set<string>();
 for(const reminder of reminders){
  if(seenTasks.has(reminder.taskId))continue;
  const task=await store.get('tasks',reminder.taskId);if(!task)continue;
  const bill=reminder.billId?await store.get('bills',reminder.billId):null;
  const decision=decide({reminder,task,bill,profile,dayMode,signals,now});
  if(decision.deliver){seenTasks.add(reminder.taskId);out.push({reminder,decision,taskTitle:task.title,billId:bill?.id||null});}
 }
 return out;
}
export async function markDelivered(store:BearStore,reminderId:string,via:'in_app'|'local'|'push',now=new Date()){
 const r=await store.get('reminders',reminderId);if(!r)return null;
 if(r.deliveredVia.includes(via)&&r.deliveredAt)return r;
 const next=await store.update('reminders',reminderId,{status:'delivered',deliveredAt:r.deliveredAt||now.toISOString(),deliveredVia:[...new Set([...r.deliveredVia,via])],attempts:r.attempts+(r.deliveredAt?0:1)});
 if(!r.deliveredAt){await store.insert('reminder_interactions',stamp<ReminderInteraction>(store.userId,{reminderId,action:'delivered',detail:via}));await recordBehaviour(store,'reminder_delivered',{reminderId,taskId:r.taskId,via},now);}
 return next;
}
export const interactSchema=z.object({reminderId:z.string().uuid(),action:z.enum(['opened','snoozed','dismissed','helped','not_important','rescheduled']),when:z.string().datetime({offset:true}).optional(),detail:z.string().max(120).optional()}).strict();
export async function interact(store:BearStore,input:z.infer<typeof interactSchema>,now=new Date()){
 const r=await store.get('reminders',input.reminderId);if(!r)throw new Error('not_found');
 await store.insert('reminder_interactions',stamp<ReminderInteraction>(store.userId,{reminderId:r.id,action:input.action,detail:input.detail||null}));
 const profile=await ensureProfile(store);const tz=profile.lifeRhythm.timezone||'Australia/Sydney';
 if(input.action==='opened'){await recordBehaviour(store,'reminder_opened',{reminderId:r.id,taskId:r.taskId},now);return r;}
 if(input.action==='helped'){await recordBehaviour(store,'assist_used',{reminderId:r.id,taskId:r.taskId},now);return store.update('reminders',r.id,{status:'actioned'});}
 if(input.action==='dismissed'){await recordBehaviour(store,'reminder_dismissed',{reminderId:r.id,taskId:r.taskId},now);return store.update('reminders',r.id,{status:'dismissed'});}
 if(input.action==='not_important'){await dropTask(store,r.taskId);return store.update('reminders',r.id,{status:'cancelled'});}
 // snoozed / rescheduled: move the reminder, never escalate.
 const when=input.when?new Date(input.when).toISOString():input.detail==='tonight'?zonedDateTime(todayISO(tz,now),19*60+30,tz):zonedDateTime(addDays(todayISO(tz,now),1),19*60+30,tz);
 const scheduledFor=new Date(when).getTime()<=now.getTime()?new Date(now.getTime()+3*3600000).toISOString():when;
 await recordBehaviour(store,'reminder_snoozed',{reminderId:r.id,taskId:r.taskId,detail:input.detail},now);
 return store.update('reminders',r.id,{status:'snoozed',scheduledFor,deliveredAt:null,plan:{...r.plan,scheduledFor}});
}
