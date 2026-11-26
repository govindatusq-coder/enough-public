// Got a Moment?, "No time? Hand something off": one task from Bear Brain that someone else could reasonably do.
// A plain rule, not a judgement about her life: errands, buying things, chores, calls and bookings that are coming up, and
// not anything personal, anything she has already started, anything already handed to someone, or bills and forms that need
// her own logins. She always decides; if nothing fits, Bear says so rather than forcing one.
import {daysBetween,formatAU} from '../domain/dates.ts';
import type {Task} from '../domain/types.ts';
import type {Kind} from './model.ts';
import {selectedPath,type Plan} from './plan.ts';

export interface ShareSuggestion{taskId:string;title:string;why:string;dueAt:string|null;dueTime:string|null}
const SHAREABLE:Partial<Record<Kind,{weight:number;reason:string}>>={
 acquire:{weight:2,reason:'anyone could pick it up'},chore:{weight:2,reason:'someone else could take care of it'},
 call:{weight:1,reason:'someone else could make the call'},appointment:{weight:1,reason:'someone else could make the booking'},
 general:{weight:0,reason:'someone else could take care of it'},
};
// Her own health, body and inner life stay hers; so do presents for the people Bear would be asking.
const PERSONAL=/\b(my|me|myself|i)\b[^.]{0,30}\b(doctor|gp|dentist|psych\w*|therap\w*|counsell\w*|hair|nails|gym|physio|pap|mammogram|massage|smear)\b|\b(journal\w*|meditat\w*)\b|\b(present|gift)s?\b/i;
const ACTIVE=new Set(['DRAFT','PENDING_SEND','SENT','ACCEPTED']);
const NOT_NOW=new Set(['waiting','completed','blocked']);

// Could someone else reasonably do this? The same rule Bear uses everywhere (hand-off suggestions, the engine's attributes).
export function delegationEligible(t:Task,p:Plan,status:string):{ok:boolean;reason:string|null}{
 if(t.status!=='open'||NOT_NOW.has(status))return {ok:false,reason:null};
 if(t.sharedOut||t.sharedIn||(t.delegation&&ACTIVE.has(t.delegation.status)))return {ok:false,reason:null};
 if(t.readiness==='waiting'||t.readiness==='needs_info')return {ok:false,reason:null};
 const rule=SHAREABLE[p.kind];if(!rule)return {ok:false,reason:null};
 if(PERSONAL.test(`${t.title} ${t.sorted?.originalInput||''}`))return {ok:false,reason:null};
 // Already started by her: a saved draft or notes, or one of her own steps done.
 const steps=selectedPath(p).steps;
 if(t.progress?.savedAt||steps.slice(0,p.stepIndex).some(s=>s.who==='you'))return {ok:false,reason:null};
 if(p.kind==='general'&&!(p.deadlines.outcome||t.dueAt))return {ok:false,reason:null};
 return {ok:true,reason:rule.reason};
}
export function chooseShare(items:{task:Task;plan:Plan;status:string}[],ctx:{today:string;exclude?:string[]}):ShareSuggestion|null{
 const pool:{s:ShareSuggestion;score:number;days:number|null}[]=[];
 for(const {task:t,plan:p,status} of items){
  if(ctx.exclude?.includes(t.id))continue;
  const e=delegationEligible(t,p,status);if(!e.ok)continue;const rule=SHAREABLE[p.kind]!;
  const due=p.deadlines.outcome||t.dueAt||null;const days=due?daysBetween(ctx.today,due):null;
  const soon=days===null?0:days<=2?3:days<=7?2:1;
  const errand=selectedPath(p).method==='in_person'?1:0;
  const when=days===null?'':days<0?'It’s overdue':days===0?'Due today':days===1?'Due tomorrow':days<=6?`Due ${formatAU(due,'weekday')}`:`Due ${formatAU(due,'short')}`;
  const why=when?`${when}, and ${rule.reason}.`:`${rule.reason[0].toUpperCase()}${rule.reason.slice(1)}.`;
  pool.push({s:{taskId:t.id,title:t.title,why,dueAt:t.dueAt||due,dueTime:t.dueTime??null},score:rule.weight+soon+errand,days});
 }
 pool.sort((a,b)=>b.score-a.score||(a.days??999)-(b.days??999)||a.s.title.localeCompare(b.s.title));
 return pool[0]?.s||null;
}
