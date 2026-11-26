// How she asked Bear to help through the day decides which reminders reach her phone. Nothing is hidden: every reminder still
// shows in the app; only the push is held back. Never switches notifications on.
import {daysBetween,todayISO} from '../domain/dates.ts';
import type {COMMS} from './profile.ts';
type Item={reminder:{scheduledFor:string};task:{dueAt:string|null}};
// An interruption budget for everyone: at most three pushes a day. Anything due within a day always gets through; the rest
// wait in the app rather than pile up on her phone.
export const DAILY_PUSH_BUDGET=3;
function budget<T extends Item>(items:T[],tz:string):T[]{
 const byDay=new Map<string,T[]>();for(const i of items){const d=todayISO(tz,new Date(i.reminder.scheduledFor));(byDay.get(d)||byDay.set(d,[]).get(d)!).push(i);}
 const out:T[]=[];for(const [day,list] of byDay){const urgent=list.filter(i=>i.task.dueAt&&(daysBetween(day,i.task.dueAt)??9)<=1);const rest=list.filter(i=>!urgent.includes(i)).sort((a,b)=>(a.task.dueAt||'9999').localeCompare(b.task.dueAt||'9999'));
  out.push(...urgent,...rest.slice(0,Math.max(0,DAILY_PUSH_BUDGET-urgent.length)));}
 return items.filter(i=>out.includes(i));
}
export function commsFilter<T extends Item>(items:T[],comms:typeof COMMS[number]|null|undefined,tz:string):T[]{
 if(!comms||comms==='as_i_go')return budget(items,tz);
 if(comms==='only_when_open')return [];
 if(comms==='important_only')return items.filter(i=>{if(!i.task.dueAt)return false;const d=daysBetween(todayISO(tz,new Date(i.reminder.scheduledFor)),i.task.dueAt);return d!==null&&d<=1;});
 // A gentle daily check-in: at most one push a day (the earliest); the rest wait in the app.
 const seen=new Set<string>();return [...items].sort((a,b)=>a.reminder.scheduledFor.localeCompare(b.reminder.scheduledFor)).filter(i=>{const day=todayISO(tz,new Date(i.reminder.scheduledFor));if(seen.has(day))return false;seen.add(day);return true;});
}
