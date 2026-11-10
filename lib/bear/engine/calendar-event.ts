import type {Task} from '../domain/types.ts';
import type {CalendarEvent} from './prepare.ts';
// The calendar event Bear can prepare for a responsibility, from what the source stated: a date the thing HAPPENS.
// A deadline is not an event, so a bill's due date never becomes a calendar event. Pure: safe in the browser too.
export function eventForTask(task:Pick<Task,'id'|'title'|'load'|'forPerson'>):CalendarEvent|null{
 const primary=task.load?.nodes.find(n=>n.id===task.load!.primaryId);const e=primary?.entities;
 if(!primary||!e?.eventDate||!/^\d{4}-\d{2}-\d{2}$/.test(e.eventDate))return null;
 if(!['SCHOOL_EVENT','APPOINTMENT','INVITATION_EVENT'].includes(primary.pattern))return null;
 return {uid:task.id,title:primary.title||task.title,date:e.eventDate,endDate:e.eventEndDate||null,time:e.time||null,location:e.location||null,
  description:task.forPerson?`For ${task.forPerson}. Added from Load Bear.`:'Added from Load Bear.'};
}
