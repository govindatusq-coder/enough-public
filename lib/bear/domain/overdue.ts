// Overdue means: it has a real due date, that date has passed, and it is still open. Things marked
// "no rush" can never be overdue, however old their date. Pure, so screens and services agree.
import {daysBetween} from './dates.ts';
export function overdueDays(dueAt:string|null|undefined,today:string,timing?:'time_sensitive'|'flexible'|null):number{
 if(!dueAt||timing==='flexible')return 0;
 const d=daysBetween(dueAt,today);return d!==null&&d>0?d:0;
}
// Calm, factual wording. It says what is true and what can happen next, never who is to blame.
export function overdueLabel(days:number):string{return days<=0?'':days===1?'Overdue by a day':`Overdue by ${days} days`;}
