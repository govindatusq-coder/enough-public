import type {BearStore} from '../store/store.ts';
import {eventForTask} from '../engine/calendar-event.ts';
import {appendEvent} from '../engine/events.ts';
import {calendarEventIcs} from '../engine/prepare.ts';
// Prepare the calendar file for a responsibility. This is PREPARED, never "added to your calendar": the person
// opens the file themselves. The history records that it was prepared (not that anything was created).
export async function calendarFileFor(store:BearStore,taskId:string,now=new Date()):Promise<{filename:string;ics:string}|null>{
 const task=await store.get('tasks',taskId);if(!task)return null;
 const ev=eventForTask(task);if(!ev)return null;
 await appendEvent(store,{responsibilityId:task.id,eventType:'action_prepared',actor:'system',at:now.toISOString(),metadata:{actionType:'create_calendar_event',prepared:true,sent:false}});
 const slug=(ev.title||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';
 return {filename:`load-bear-${slug}.ics`,ics:calendarEventIcs({...ev,stamp:now})};
}
