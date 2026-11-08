import {addDays,daysBetween} from '../domain/dates.ts';
import type {Task} from '../domain/types.ts';
import type {SchoolDetails} from '../load/types.ts';

// Evidence-based anticipation for School Admin. Three kinds, never blurred:
//  1. confirmed: a notice Bear holds says it's happening (shown as definite, elsewhere);
//  2. pattern: it happened around now last year in THIS person's own history (shown as a possibility);
//  3. general seasonal guesses about "Australian schools": never used. Schools differ.
export interface Anticipation{kind:string;title:string;lastYear:string;expectedAround:string;basis:'own_history'}
const ANNUAL=new Set(['photos','book_week','interviews','carnival','camp','fundraiser','concert']);

export function schoolHistory(tasks:Task[]):SchoolDetails[]{
 return tasks.map(t=>t.load?.nodes.find(n=>n.id===t.load!.primaryId)?.entities.school).filter((d):d is SchoolDetails=>!!d&&!!d.date);
}
// Things that happened 330–400 days ago, coming up within the next five weeks, with nothing confirmed yet.
export function anticipateSchool(tasks:Task[],today:string):Anticipation[]{
 const all=schoolHistory(tasks);const out:Anticipation[]=[];
 for(const d of all){
  if(!ANNUAL.has(d.kind))continue;const ago=daysBetween(d.date!,today)??0;if(ago<330||ago>400)continue;
  const expected=addDays(d.date!,364);const ahead=daysBetween(today,expected)??99;if(ahead<-7||ahead>35)continue;
  // Already confirmed this year (a notice for the same kind within a few months): nothing to anticipate.
  if(all.some(x=>x.kind===d.kind&&x.date!==d.date&&Math.abs(daysBetween(x.date!,expected)??999)<=60))continue;
  if(out.some(o=>o.kind===d.kind))continue;
  out.push({kind:d.kind,title:d.event,lastYear:d.date!,expectedAround:expected,basis:'own_history'});
 }
 return out;
}
