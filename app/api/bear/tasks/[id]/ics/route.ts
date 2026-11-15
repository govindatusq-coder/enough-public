import {HttpError,withBear} from '@/lib/bear/server/context';
import {calendarEventIcs} from '@/lib/bear/engine/prepare';
import {eventForTask} from '@/lib/bear/engine/calendar-event';
export const dynamic='force-dynamic';
// "Add to calendar" for any dated task: the event Bear recognised if there is one, otherwise the task on its due date (with its
// time if known). Served as text/calendar so phones offer to add it; nothing is added to anyone's calendar by Bear itself.
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const task=await store.get('tasks',id);if(!task)throw new HttpError('Bear couldn’t find that.',404);
 const ev=eventForTask(task)||(task.dueAt?{uid:task.id,title:task.title,date:task.dueAt,time:task.dueTime||null,location:task.location||null,description:'From Load Bear.'}:null);
 if(!ev)throw new HttpError('That has no date yet. Give it one with “Change something”.',404);
 const slug=(ev.title||'event').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'event';
 return new Response(calendarEventIcs({...ev,stamp:new Date()}),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`inline; filename="load-bear-${slug}.ics"`,'Cache-Control':'private, no-store'}});
});
