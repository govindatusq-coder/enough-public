// The delivery outbox: a small copy of what is needed to decide and send one person's reminders while they are away.
// It is rebuilt from the person's own data whenever they use Bear, and read by the scheduled job. It holds only what the
// decision needs (titles, dates, reminder wording, notification settings, push addresses): never documents or notes.
import type {Bill,Profile,Reminder,Task} from '../domain/types.ts';
import {todayISO} from '../domain/dates.ts';
import type {BearStore} from '../store/store.ts';
import {behaviourSignals,type BehaviourSignals} from './behaviour.ts';
import {decide} from './notification-decision.ts';
import {activeDayMode,ensureProfile} from './profile.ts';
import {reminderUrl,type PushSender} from './delivery.ts';
import {markDelivered} from './reminders.ts';

export type OutboxSub={endpoint:string;keys:{p256dh:string;auth:string}};
export interface OutboxItem{reminder:Pick<Reminder,'id'|'taskId'|'billId'|'status'|'scheduledFor'|'kind'|'message'|'attempts'|'deliveredAt'|'deliveredVia'>;task:Pick<Task,'id'|'title'|'status'|'dueAt'|'timing'|'estimatedMinutes'>;bill:Pick<Bill,'id'|'category'>|null}
export interface Outbox{v:1;userId:string;builtAt:string;subs:OutboxSub[];profile:Pick<Profile,'lifeRhythm'|'notification'|'dayMode'|'dayModeSetAt'>;signals:BehaviourSignals;items:OutboxItem[];
 // reminder id -> the scheduled time it was sent for (a snoozed reminder has a new time, so it can be sent again)
 sent:Record<string,{for:string;at:string;task?:string}>}
const MAX_ITEMS=150;
const sentKey=(r:{id:string;scheduledFor:string})=>r.id;

// Built in the person's own session. `previous` carries over what the job already sent, and those sends are written back
// to the person's own reminder rows here (the job itself cannot touch them).
export async function buildOutbox(store:BearStore,previous:Outbox|null,now=new Date()):Promise<Outbox|null>{
 const subs=(await store.list('push_subscriptions')).filter(s=>/^https:\/\//.test(s.endpoint)).map(s=>({endpoint:s.endpoint,keys:s.keys}));
 if(!subs.length)return null;
 const sent:Outbox['sent']={};
 for(const [id,s] of Object.entries(previous?.sent||{})){
  if(now.getTime()-new Date(s.at).getTime()>7*86400000)continue;   // old sends are forgotten
  const r=await store.get('reminders',id);if(!r)continue;
  if(r.scheduledFor===s.for){if(!r.deliveredVia.includes('push')&&(r.status==='scheduled'||r.status==='snoozed'))await markDelivered(store,id,'push',new Date(s.at)).catch(()=>null);sent[id]=s;}
 }
 const profile=await ensureProfile(store);const signals=await behaviourSignals(store);
 const reminders=await store.list('reminders',{where:[{column:'status',op:'in',value:['scheduled','snoozed']}],orderBy:{column:'scheduled_for'},limit:MAX_ITEMS});
 const items:OutboxItem[]=[];
 for(const r of reminders){
  const t=await store.get('tasks',r.taskId);if(!t||t.status!=='open')continue;
  const b=r.billId?await store.get('bills',r.billId):null;
  items.push({reminder:{id:r.id,taskId:r.taskId,billId:r.billId,status:r.status,scheduledFor:r.scheduledFor,kind:r.kind,message:r.message,attempts:r.attempts,deliveredAt:r.deliveredAt,deliveredVia:r.deliveredVia},
   task:{id:t.id,title:t.title,status:t.status,dueAt:t.dueAt,timing:t.timing,estimatedMinutes:t.estimatedMinutes},bill:b?{id:b.id,category:b.category}:null});
 }
 return {v:1,userId:store.userId,builtAt:now.toISOString(),subs,profile:{lifeRhythm:profile.lifeRhythm,notification:profile.notification,dayMode:profile.dayMode,dayModeSetAt:profile.dayModeSetAt},signals,items,sent};
}

// Run by the scheduled job for one person. Same decision as the app itself (quiet hours, hard days, deadlines), one
// reminder per task, never the same reminder twice, a failed send is retried next run, dead push addresses are dropped.
export async function deliverOutbox(box:Outbox,send:PushSender,now=new Date()):Promise<{box:Outbox;delivered:number;failed:number;changed:boolean}>{
 const profile=box.profile as Profile;const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);const dayMode=activeDayMode(profile,today);
 let delivered=0,failed=0,changed=false;const seenTasks=new Set<string>();const gone=new Set<string>();const sent={...box.sent};
 const items=box.items.map(i=>({...i,reminder:{...i.reminder}}));
 for(const item of items){
  if(seenTasks.has(item.task.id))continue;
  const prior=sent[sentKey(item.reminder)];if(prior&&prior.for===item.reminder.scheduledFor)continue;
  // One push per task per day at most: a task with several reminders lined up never buzzes again and again.
  if(Object.values(sent).some(s=>s.task===item.task.id&&now.getTime()-new Date(s.at).getTime()<20*3600000)){seenTasks.add(item.task.id);continue;}
  const d=decide({reminder:item.reminder as Reminder,task:item.task as Task,bill:item.bill as Bill|null,profile,dayMode,signals:box.signals,now});
  if(!d.deliver)continue;
  seenTasks.add(item.task.id);let ok=false;
  for(const s of box.subs){if(gone.has(s.endpoint))continue;
   let r:'sent'|'gone'|'failed';try{r=await send(s,{title:'Load Bear',body:d.message,url:reminderUrl({billId:item.bill?.id||null,reminder:item.reminder as Reminder}),tag:item.reminder.id});}catch{r='failed';}
   if(r==='sent')ok=true;else if(r==='gone')gone.add(s.endpoint);}
  if(ok){delivered++;changed=true;sent[item.reminder.id]={for:item.reminder.scheduledFor,at:now.toISOString(),task:item.task.id};item.reminder.deliveredAt=item.reminder.deliveredAt||now.toISOString();item.reminder.deliveredVia=[...new Set([...item.reminder.deliveredVia,'push' as const])];}
  else failed++;
 }
 if(gone.size)changed=true;
 return {box:{...box,items,sent,subs:box.subs.filter(s=>!gone.has(s.endpoint))},delivered,failed,changed};
}
