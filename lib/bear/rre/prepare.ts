// RRE part 5: what "Give it to Bear" actually produces. Bear prepares (level 1) and coordinates with its own calendar and
// reminders (level 2). It never buys, sends, books or submits anything: there is no integration that could, and it never
// pretends there is. Every prepared item says plainly what she still does herself.
import type {Bill,Task} from '../domain/types.ts';
import {formatAU} from '../domain/dates.ts';
import {helpFor} from '../board/help.ts';
import {selectedPath,type Plan,type Prepared} from './plan.ts';
import {withA} from './model.ts';

const enc=encodeURIComponent;
export function prepareFor(p:Plan,task:Task,bill:Bill|null,ctx:{name:string;family:{name:string;relation:string}[];giftIdeas?:Record<string,string[]>|null},now:Date):Prepared{
 const at=now.toISOString();const path=selectedPath(p);const item=p.item||task.title;const due=p.deadlines.outcome;
 const byDay=due?`${formatAU(due,'weekday')} ${formatAU(due,'short')}`:null;
 if(p.kind==='acquire'&&path.method==='online')return {kind:'shopping',title:`Where to order ${withA(item)}`,at,
  lines:[`What: ${withA(item)}${p.people[0]?` for ${p.people[0]}`:''}`,byDay?`Needed by: ${byDay}`:'No date given',`Delivery: pick an option that arrives${byDay?` before ${byDay}`:' in time'}.`],
  links:[{label:`Search shops for “${item}”`,url:`https://www.google.com/search?tbm=shop&q=${enc(item+' Australia')}`}],
  note:'Bear can’t see live stock, prices or delivery dates, and it doesn’t buy anything. Check the delivery date at checkout, then tell Bear once it’s ordered.'};
 if(p.kind==='acquire'&&path.method==='in_person')return {kind:'note',title:'Shopping note',at,lines:[`□ ${item}${p.people[0]?` (for ${p.people[0]})`:''}${byDay?`, before ${byDay}`:''}`],links:[],note:'Pick it up on a trip you’re already making.'};
 if(p.kind==='acquire'&&path.method==='borrow'){const body=`Hi! Do you happen to have ${withA(item)}${p.people[0]?` ${p.people[0]} could borrow`:' I could borrow'}${byDay?` for ${formatAU(due,'weekday')}`:''}? Thank you!${ctx.name?` ${ctx.name}`:''}`;
  return {kind:'draft',title:'A message asking to borrow it',at,lines:[],links:[],draft:{to:'',subject:'',body},note:'Send it from your own phone. Bear never sends messages.'};}
 if(p.kind==='gifts'){
  const people=ctx.family.length?ctx.family:[];const ideas=ctx.giftIdeas||{};
  const lines=people.length?people.map(f=>`${f.name}: ${(ideas[f.name]||[]).join(', ')||'(add a few ideas)'}`):['Who are you buying for? Add each person with an idea or two.'];
  return {kind:'shortlist',title:'Christmas gift shortlist',at,lines:[...lines,byDay?`Aim to have everything by: ${byDay}`:''].filter(Boolean),links:[],
   note:ctx.giftIdeas?'These are ideas only. Bear hasn’t checked prices or stock and won’t buy anything.':'Bear only knows the family details you’ve given it. Add or change anyone.'};
 }
 // Everything else uses the drafts, call notes and steps Bear already prepares on its work page.
 const h=helpFor(task,bill,ctx.name);
 if(!h)return {kind:'steps',title:'Steps',at,lines:path.steps.filter(s=>s.who==='you').map(s=>s.text),links:[],note:'Nothing for Bear to prepare here; these are the steps.'};
 if(h.bill)return {kind:'bill',title:'Payment details',at,lines:[h.bill.amount?`Amount: ${h.bill.amount}`:'Amount not read yet',h.bill.dueAt?`Due: ${formatAU(h.bill.dueAt,'short')}`:''].filter(Boolean),links:[{label:'Open the bill',url:h.bill.href}],note:'Pay through your bank or the biller’s site. Bear can’t pay for you.'};
 if(h.formHref)return {kind:'form',title:'The prepared form',at,lines:['Bear has filled in what it knows.'],links:[{label:'Check the form',url:h.formHref}],note:'You check, sign and send it.'};
 if(h.draft)return {kind:'draft',title:h.label,at,lines:[],links:[],draft:h.draft,note:'Send it from your own Mail or Messages. Bear never sends anything.'};
 if(h.points)return {kind:'call',title:'Call notes',at,lines:h.points,links:h.searchFor?[{label:'Find their number',url:`https://www.google.com/search?q=${enc(h.searchFor)}`}]:[],note:'Bear can’t make calls. Most businesses answer weekdays, about 9 to 5.'};
 return {kind:'steps',title:'Small steps',at,lines:h.steps||[],links:[],note:'Tick them off on the work page as you go.'};
}
