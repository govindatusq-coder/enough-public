// How she asked Bear to help through the day decides which reminders reach her phone. Nothing is hidden: every reminder still
// shows in the app; only the push is held back. Never switches notifications on.
import {daysBetween,todayISO} from '../domain/dates.ts';
import type {COMMS} from './profile.ts';
type Item={reminder:{scheduledFor:string};task:{dueAt:string|null}};
export function commsFilter<T extends Item>(items:T[],comms:typeof COMMS[number]|null|undefined,tz:string):T[]{
 if(!comms||comms==='as_i_go')return items;
 if(comms==='only_when_open')return [];
 if(comms==='important_only')return items.filter(i=>{if(!i.task.dueAt)return false;const d=daysBetween(todayISO(tz,new Date(i.reminder.scheduledFor)),i.task.dueAt);return d!==null&&d<=1;});
 // A gentle daily check-in: at most one push a day (the earliest); the rest wait in the app.
 const seen=new Set<string>();return [...items].sort((a,b)=>a.reminder.scheduledFor.localeCompare(b.reminder.scheduledFor)).filter(i=>{const day=todayISO(tz,new Date(i.reminder.scheduledFor));if(seen.has(day))return false;seen.add(day);return true;});
}
