import {daysBetween} from '../domain/dates.ts';
import type {Task} from '../domain/types.ts';
import type {SchoolDetails,SchoolObligationDetail} from '../load/types.ts';
import type {BearStore} from '../store/store.ts';
import type {SchoolReading} from './packs/school.ts';

// Matching: a second notice about the same school event (a reminder, a resend, the same PDF again)
// belongs with the first. Bear keeps one item per event, fills in any details it didn't have, and
// only adds what is genuinely new. It never creates a duplicate obligation.
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function sameEvent(a:SchoolDetails,b:{kind:string;title:string;date:string|null},anyDate=false){
 if(a.kind!==b.kind&&norm(a.event)!==norm(b.title))return false;
 // A notice that says the date CHANGED is about the same event even if it is now far from the old date.
 if(anyDate)return true;
 if(a.date&&b.date)return Math.abs(daysBetween(a.date,b.date)??99)<=2;
 return norm(a.event)===norm(b.title);
}
export async function findSchoolMatch(store:BearStore,r:SchoolReading):Promise<{task:Task;details:SchoolDetails}|null>{
 const ev=r.events.find(e=>e.date)||r.events[0];if(!ev)return null;
 const open=await store.list('tasks',{where:[{column:'status',value:'open'}]});
 for(const t of open){const p=t.load?.nodes.find(n=>n.id===t.load!.primaryId);const d=p?.entities.school;if(d&&sameEvent(d,ev,!!r.update))return {task:t,details:d};}
 return null;
}
// What a newer notice says differently, for the same event: the event date and each obligation's due date.
export type ScheduleChange={what:'event'|SchoolObligationDetail['type'];from:string;to:string};
export function scheduleChanges(cur:SchoolDetails,r:SchoolReading):ScheduleChange[]{
 const out:ScheduleChange[]=[];const ev=r.events.find(e=>e.date)||r.events[0];
 if(ev?.date&&cur.date&&ev.date!==cur.date)out.push({what:'event',from:cur.date,to:ev.date});
 for(const n of r.obligations){const o=cur.obligations.find(x=>x.type===n.type);
  if(o&&n.dueDate&&o.dueDate&&n.dueDate!==o.dueDate&&!o.dueInferred&&!n.dueInferred)out.push({what:n.type,from:o.dueDate,to:n.dueDate});}
 return out;
}
// Fill gaps only: a detail Bear already has is kept; a different deadline for the same obligation is
// noted (the earlier, safer date wins) rather than silently overwritten.
export function mergeDetails(cur:SchoolDetails,incoming:SchoolObligationDetail[],update=false,newDate:string|null=null,newEnd:string|null=null):{details:SchoolDetails;added:SchoolObligationDetail[];conflicts:string[]}{
 const obligations=cur.obligations.map(o=>({...o,items:[...o.items]}));const added:SchoolObligationDetail[]=[];const conflicts:string[]=[];
 for(const n of incoming){const o=obligations.find(x=>x.type===n.type);
  if(!o){obligations.push(n);added.push(n);continue;}
  // A notice that says the date CHANGED corrects it; otherwise a different date is a conflict and the earlier, safer date stays.
  if(n.dueDate&&o.dueDate&&n.dueDate!==o.dueDate&&!o.dueInferred&&!n.dueInferred){if(update)o.dueDate=n.dueDate;else{conflicts.push(n.type);if(n.dueDate<o.dueDate)o.dueDate=n.dueDate;}}
  if(!o.dueDate||o.dueInferred&&n.dueDate&&!n.dueInferred){o.dueDate=n.dueDate;o.dueInferred=n.dueInferred;}
  o.amountCents??=n.amountCents;o.reference??=n.reference;o.link??=n.link;o.code??=n.code;o.method??=n.method;
  for(const i of n.items)if(!o.items.some(x=>x.toLowerCase()===i.toLowerCase()))o.items.push(i);}
 return {details:{...cur,obligations,...(update&&newDate?{date:newDate,endDate:newEnd}:{})},added,conflicts};
}
