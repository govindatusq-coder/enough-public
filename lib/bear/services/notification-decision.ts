import {daysBetween,localParts,todayISO} from '../domain/dates.ts';
import type {Bill,DayMode,Profile,Reminder,Task} from '../domain/types.ts';
import type {BehaviourSignals} from './behaviour.ts';

// NotificationDecisionService. The eight questions Bear asks before any optional
// notification. Bear never reminds users that they have failed; it offers to make
// the next step easier. Repeated deferral changes the plan instead of escalating.
export type Decision={deliver:true;message:string;actions:{key:string;label:string}[];essential:boolean;reason:string}|{deliver:false;reason:string;revisitAt:string|null};
export interface DecisionContext{reminder:Reminder;task:Task;bill:Bill|null;profile:Profile;dayMode:DayMode|null;signals:BehaviourSignals;now:Date;quietHours?:boolean}

export const assistanceActions=(bill:Bill|null,minutes:number)=>[{key:'help',label:`${bill?'Pay it':'Do it'} · ~${minutes} min`},{key:'tonight',label:'Tonight'},{key:'another_time',label:'Another time'}];
export const nudgeActions=[{key:'help',label:'Have a look'},{key:'another_time',label:'Not now'},{key:'stop_nudges',label:'Stop reminding me'}];
export const stuckActions=[{key:'break_down',label:'Break it down'},{key:'another_time',label:'Find another time'},{key:'help',label:'Help me do it'},{key:'drop',label:'Not important anymore'}];

export function decide(ctx:DecisionContext):Decision{
 const {reminder,task,bill,profile,dayMode,signals,now}=ctx;
 const tz=profile.lifeRhythm.timezone||'Australia/Sydney';const today=todayISO(tz,now);
 if(task.status!=='open')return {deliver:false,reason:'task_closed',revisitAt:null};
 if(reminder.status!=='scheduled'&&reminder.status!=='snoozed')return {deliver:false,reason:'reminder_'+reminder.status,revisitAt:null};
 const due=task.dueAt?daysBetween(today,task.dueAt):null;
 // 1. Does this require action now? 2. Is the deadline approaching?
 // Flexible things are never urgent, whatever date they mention.
 const flexible=task.timing==='flexible';
 const essential=!flexible&&due!==null&&due<=1;
 if(reminder.scheduledFor>now.toISOString()&&!essential)return {deliver:false,reason:'not_yet',revisitAt:reminder.scheduledFor};
 // Quiet hours: optional reminders wait; essential ones go through in the morning rather than late at night.
 const local=localParts(now,tz);const q=profile.notification;const quiet=q.quietStartMinute>q.quietEndMinute?local.minuteOfDay>=q.quietStartMinute||local.minuteOfDay<q.quietEndMinute:local.minuteOfDay>=q.quietStartMinute&&local.minuteOfDay<q.quietEndMinute;
 if(quiet&&!(essential&&local.minuteOfDay>=6*60))return {deliver:false,reason:'quiet_hours',revisitAt:null};
 // Chaos / wiped: only things that genuinely can't wait.
 if((dayMode==='chaos'||dayMode==='wiped')&&!essential)return {deliver:false,reason:'day_mode_'+dayMode,revisitAt:null};
 // 6. Already nudged? 7. Repeatedly postponed? 8. Does the plan need changing?
 // A gentle nudge stays gentle: no "keeps getting pushed back", no escalation, just an open door.
 if(reminder.kind==='nudge')return {deliver:true,message:reminder.message||`No rush. ${task.title} is here whenever you feel like it.`,actions:nudgeActions,essential:false,reason:'gentle_nudge'};
 const postponed=signals.postponeCountByTask[task.id]||0;
 const stuck=postponed>=2||reminder.attempts>=3;
 if(stuck&&!essential)return {deliver:true,message:"This keeps getting pushed back. Maybe the plan isn't helping. Want Bear to make it easier?",actions:stuckActions,essential:false,reason:'plan_not_helping'};
 if(reminder.deliveredAt&&!essential){const since=(now.getTime()-new Date(reminder.deliveredAt).getTime())/3600000;if(since<20)return {deliver:false,reason:'already_nudged',revisitAt:null};}
 // 3. Capacity: if nothing is urgent and this is a known low-capacity hour, wait for a better window soon (5).
 const hourScore=signals.sampleSize>=5?signals.hourResponsiveness[local.hour]:0;
 if(!essential&&hourScore<-0.5)return {deliver:false,reason:'low_capacity_hour',revisitAt:null};
 // 4. Can Bear make it easier? Build the offer around what Bear can do.
 const minutes=task.estimatedMinutes||2;
 const when=due===null?'':due<0?'':due===0?' today':due===1?' tomorrow':` on ${task.dueAt}`;
 const message=bill?(due!==null&&due<0?`This bill is past its due date. It isn't too late: want me to help you sort it now?`:`Your ${bill.category.replace(/_/g,' ')} bill is due${when}. Want me to help you sort it now?`):(due!==null&&due<0&&!flexible?`${task.title} is past its date. It isn't too late: want a hand with it now?`:reminder.message);
 const actions=due!==null&&due<0?[{key:'help',label:'Help me'},{key:'another_time',label:'Find another time'},{key:'drop',label:'Not important anymore'}]:assistanceActions(bill,minutes);
 return {deliver:true,message,actions,essential,reason:essential?'deadline_near':'planned'};
}
