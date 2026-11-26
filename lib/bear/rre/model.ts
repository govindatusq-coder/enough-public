// Responsibility Resolution Engine (RRE), part 1: understanding a responsibility and the ways it could be resolved.
// Pure functions only (no storage), so every rule is testable. Nothing here invents facts: estimates are ranges,
// labelled as estimates, with where they came from. Unknown stays unknown.
import {addDays,daysBetween,formatAU,parseISODate} from '../domain/dates.ts';

export type Kind='acquire'|'gifts'|'appointment'|'call'|'form'|'bill'|'followup'|'chore'|'aspiration'|'general';
export type Method='online'|'phone'|'in_person'|'delegate'|'make'|'borrow'|'other';
export type Feasibility='feasible'|'uncertain'|'infeasible';
export interface Evidence{kind:'rule'|'user'|'web'|'document';note:string;url?:string}
// What Bear can do for a step: 0 explain, 1 prepare, 2 coordinate (its own calendar and reminders), 3 execute with approval.
// Level 3 and 4 are not available in this app: there is no purchasing, sending or submitting integration.
export type BearLevel=0|1|2|3;
export interface Step{id:string;text:string;who:'you'|'bear';kind:'prepare'|'decide'|'act'|'wait'|'confirm';userMinutes:number;waitDays?:number;context?:'phone'|'online'|'errand'|'home'|'any'}
export interface Pathway{id:string;method:Method;label:string;description:string;userMinutes:[number,number];elapsedDays:[number,number]|null;cost:string|null;
 reliability:'high'|'medium'|'low';disruption:'low'|'medium'|'high';needs:string[];leadDays:number;feasibility:Feasibility;why:string|null;evidence:Evidence[];confidence:number;bearLevel:BearLevel;steps:Step[]}
export interface Opportunity{id:string;description:string;until:string|null;savedMinutes:number|null;avoids:string|null;confidence:number;status:'available'|'expiring'|'expired'|'uncertain';evidence:Evidence[]}
export interface Deadlines{outcome:string|null;action:string|null;opportunity:string|null;followUp:string|null;window:string|null}
export interface Dependency{id:string;what:string;kind:'external'|'person'|'delivery'|'approval'|'task';expectedBy:string|null;status:'open'|'met'}
export interface Understood{kind:Kind;outcome:string;people:string[];item:string|null;deadline:string|null;deadlineSource:'stated'|'known_date'|null}

const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
// "red scrunchie" -> "a red scrunchie"; plurals and "some ..." are left alone.
export const withA=(item:string)=>/^(a|an|the|some|my|her|his|their)\s/i.test(item)||/s$/i.test(item)?item:`${/^[aeiou]/i.test(item)?'an':'a'} ${item}`;
const clean=(s:string)=>s.replace(/\s+/g,' ').replace(/[.!?]+$/,'').trim();
const STOP_NAMES=new Set(['I','Me','My','Mum','Mom','Dad','The','A','An','Call','Book','Pay','Order','Buy','Get','Need','Remind','Follow','Organise','Organize','Renew','Fix','Build','Email','Ring','Sign','Christmas','Friday','Monday','Tuesday','Wednesday','Thursday','Saturday','Sunday','Bear']);
export function peopleIn(text:string,children:string[]=[]):string[]{
 const found=new Set<string>();
 for(const c of children)if(c&&new RegExp(`\\b${c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(text))found.add(c);
 for(const m of text.matchAll(/\b([A-Z][a-z]{2,})(?:[’']s)?\b/g)){const n=m[1];if(!STOP_NAMES.has(n)&&m.index!==0)found.add(n);}
 const lead=text.match(/^([A-Z][a-z]{2,})\s+(?:needs|wants|has|is)\b/);if(lead&&!STOP_NAMES.has(lead[1]))found.add(lead[1]);
 return [...found].slice(0,4);
}
// Which kind of responsibility this is. Order matters: the most specific patterns come first.
export function kindOf(title:string,original:string,listId:string|null):Kind{
 const t=`${title} ${original}`;
 if(listId==='aspire'||/\b(eventually|one day|someday|some day|learn to|take up|start (?:a|my) (?:hobby|business|side)|get fit|improve (?:my )?fitness|dream)\b/i.test(t))return 'aspiration';
 if(/\b(follow[- ]?up|chase|check (?:in|on|back) with|hear back|waiting (?:on|for))\b/i.test(t))return 'followup';
 if(/\b(christmas|xmas|birthday|present|presents|gift|gifts)\b/i.test(t)&&/\b(organi[sz]e|buy|get|sort|plan|presents?|gifts?)\b/i.test(t)&&!/\b(party|cake)\b/i.test(t))return 'gifts';
 if(/\b(book|make|schedule|reschedule)\b.*\b(appointment|dentist|doctor|gp|physio\w*|podiatrist|optometrist|haircut|hairdresser|vet|service|check-?up|massage)\b/i.test(t))return 'appointment';
 if(/\b(pay|bill|invoice|rates|fine)\b/i.test(t))return 'bill';
 if(/\b(form|permission|sign|register|enrol|enroll|renew|rego|registration|apply|application|tax return|passport)\b/i.test(t))return 'form';
 if(/\b(call|ring|phone)\b/i.test(t))return 'call';
 if(/\b(needs?|buy|get|order|pick up|grab|find)\b/i.test(t)&&!/\b(get back to|get fit|get rid)\b/i.test(t))return 'acquire';
 if(/\b(fix|clean|tidy|declutter|organi[sz]e|sort out|clear out|paint|mow|wash|repair)\b/i.test(t))return 'chore';
 return 'general';
}
// The thing to get, from "Sarah needs a red scrunchie for Friday" -> "a red scrunchie".
export function itemOf(text:string):string|null{
 const m=clean(text).match(/\b(?:needs?|buy|get|order|pick up|grab|find)\s+(?:some |a |an |the |new )?(.+?)(?:\s+(?:for|by|before|on|this|next|from|at)\b.*)?$/i);
 if(!m)return null;const item=m[1].replace(/^(?:me|her|him|them|us)\s+/i,'').trim();return item&&item.length<=60?item:null;
}
function when(deadline:string|null){return deadline?`by ${formatAU(deadline,'weekday')} ${formatAU(deadline,'short')}`:'';}
export function understand(input:{title:string;original:string;dueAt:string|null;listId:string|null;today:string;children?:string[]}):Understood{
 const {title,original,today}=input;const kind=kindOf(title,original,input.listId);const people=peopleIn(original||title,input.children||[]);
 let deadline=input.dueAt;let deadlineSource:Understood['deadlineSource']=deadline?'stated':null;
 // Christmas is a known date. Gifts may be needed earlier for some celebrations; the person can change it.
 if(!deadline&&kind==='gifts'&&/\b(christmas|xmas)\b/i.test(`${title} ${original}`)){const y=Number(today.slice(0,4));const d=`${y}-12-24`;deadline=d>=today?d:`${y+1}-12-24`;deadlineSource='known_date';}
 if(kind==='aspiration')deadline=null,deadlineSource=null;
 const item=kind==='acquire'?itemOf(original||title)||itemOf(title):null;
 const who=people[0]||null;const by=when(deadline);
 const outcome=({
  acquire:`${who?`${who} has`:'You have'} ${item?withA(item):'what’s needed'}${by?` ${by}`:''}`,
  gifts:`Gifts are chosen, bought and ready${by?` ${by}`:' in time'}`,
  appointment:`The appointment is booked${by?` ${by}`:''}`,
  call:`You’ve spoken to ${clean(title).replace(/^.*?\b(?:call|ring|phone)\s+(?:the\s+)?/i,'')||'them'}${by?` ${by}`:''}`,
  form:`${cap(clean(title).replace(/^(?:sign|fill in|complete|submit|renew|do)\s+/i,''))} is done${by?` ${by}`:''}`,
  bill:`The bill is paid${by?` ${by}`:' on time'}`,
  followup:`You have an answer${who?` from ${who}`:''}, and it’s sorted`,
  chore:`${cap(clean(title))}: done${by?` ${by}`:', when there’s time'}`,
  aspiration:`${cap(clean(title))}: a step closer, at your own pace`,
  general:`${cap(clean(title))}${by?` ${by}`:''}`,
 } as Record<Kind,string>)[kind];
 return {kind,outcome,people,item,deadline,deadlineSource};
}

// ---------- Ways to resolve it ----------
const step=(id:string,text:string,who:Step['who'],kind:Step['kind'],userMinutes:number,extra:Partial<Step>={}):Step=>({id,text,who,kind,userMinutes,...extra});
const rule=(note:string):Evidence=>({kind:'rule',note});
// Typical online delivery in Australia is a few business days. This is an estimate, never a promise.
export const ONLINE_LEAD_DAYS=4;
function weekdayName(iso:string){return formatAU(iso,'weekday');}
export function pathwaysFor(u:Understood,ctx:{title:string;today:string;minutesGuess:number}):Pathway[]{
 const {today}=ctx;const left=u.deadline?daysBetween(today,u.deadline):null;
 const P=(p:Omit<Pathway,'feasibility'|'why'|'confidence'>&{feasibility?:Feasibility;why?:string|null;confidence?:number}):Pathway=>({feasibility:'uncertain',why:null,confidence:0.5,...p});
 const thing=u.item?withA(u.item):'it';const forWho=u.people[0]?` for ${u.people[0]}`:'';
 switch(u.kind){
  case 'acquire':{
   const online=P({id:'online',method:'online',label:'Order online',description:`Order ${thing}${forWho} online and have it delivered.`,userMinutes:[2,5],elapsedDays:[2,5],cost:null,reliability:'medium',disruption:'low',needs:['A store that has it','Delivery before the day it’s needed','Your OK to buy'],leadDays:ONLINE_LEAD_DAYS,bearLevel:1,
    evidence:[rule('Online delivery usually takes 2–5 business days (an estimate; check the date at checkout).')],
    steps:[step('find','Find a few places to order it','bear','prepare',1),step('order',`Order ${u.people[0]?`${u.people[0]}’s `:''}${(u.item||'it').replace(/^(a|an|some) /,'')}`,'you','act',2,{context:'online'}),step('deliver','Delivery','you','wait',0,{waitDays:3}),step('arrived','Check it’s arrived','you','confirm',1)]});
   const shop=P({id:'shop',method:'in_person',label:'Buy it locally',description:`Pick up ${thing} on a trip you’re already making.`,userMinutes:[15,60],elapsedDays:[0,1],cost:null,reliability:'high',disruption:'medium',needs:['A shop that has it','Time to get there'],leadDays:0,bearLevel:1,
    evidence:[rule('A shop trip takes your own time; best combined with a trip you’re already making.')],
    steps:[step('note','Add it to a shopping note','bear','prepare',1),step('buy',`Buy ${thing} while you’re out`,'you','act',30,{context:'errand'}),step('got','Got it','you','confirm',1)]});
   const borrow=P({id:'borrow',method:'borrow',label:'Borrow one',description:`Ask a friend or family member if they have ${thing} to lend.`,userMinutes:[3,10],elapsedDays:[0,2],cost:'Free',reliability:'low',disruption:'low',needs:['Someone who has one'],leadDays:1,bearLevel:1,
    evidence:[rule('Depends on someone else having one.')],
    steps:[step('draft','Draft a quick message asking to borrow it','bear','prepare',1),step('ask','Send the message','you','act',2,{context:'any'}),step('reply','Wait for a reply','you','wait',0,{waitDays:1}),step('got','Collected it','you','confirm',1)]});
   const have=P({id:'have',method:'other',label:'Use one you have',description:`Check whether there’s ${thing} at home already.`,userMinutes:[2,5],elapsedDays:null,cost:'Free',reliability:'low',disruption:'low',needs:['Having one already'],leadDays:0,bearLevel:0,
    evidence:[rule('Only you know what’s at home.')],steps:[step('check','Check if there’s one at home','you','act',3,{context:'home'}),step('got','Found one','you','confirm',1)]});
   if(left!==null){
    // Online needs the lead time; buying locally needs at least today. Unknown stays "uncertain", never "feasible".
    if(left<2){online.feasibility='infeasible';online.why=`Delivery is unlikely before ${weekdayName(u.deadline!)}.`;}
    else if(left<ONLINE_LEAD_DAYS){online.feasibility='uncertain';online.why='Delivery might not arrive in time. Check the delivery date before ordering.';online.confidence=0.4;}
    else{online.feasibility='feasible';online.confidence=0.7;}
    if(left<0){shop.feasibility='infeasible';shop.why='The day has passed.';}else shop.feasibility='feasible';
    if(left<1){borrow.feasibility='infeasible';borrow.why='Not enough time to arrange.';}
   }else{online.feasibility='feasible';online.confidence=0.6;shop.feasibility='feasible';}
   return [online,shop,borrow,have];
  }
  case 'gifts':return [P({id:'shortlist',method:'online',label:'Shortlist, then buy',description:'Bear lists who you’re buying for and some ideas; you pick, then buy online or in person.',userMinutes:[5,10],elapsedDays:[3,14],cost:null,reliability:'medium',disruption:'low',needs:['Who you’re buying for','A rough budget'],leadDays:10,bearLevel:1,feasibility:'feasible',confidence:0.6,
    evidence:[rule('Choosing early leaves time for delivery and avoids last-minute shopping.')],
    steps:[step('ideas','Prepare a gift shortlist','bear','prepare',1),step('review','Review Christmas gift shortlist','you','decide',5,{context:'any'}),step('buy','Buy the gifts you picked','you','act',20,{context:'online'}),step('wrap','Wrap and label them','you','act',20,{context:'home'}),step('done','All gifts ready','you','confirm',1)]})];
  case 'appointment':return [
   P({id:'phone',method:'phone',label:'Ring to book',description:'Call during opening hours to book a time.',userMinutes:[5,10],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:['Their number','Opening hours'],leadDays:0,bearLevel:1,feasibility:'feasible',confidence:0.6,
    evidence:[rule('Most clinics answer the phone on weekdays, about 9 to 5.')],
    steps:[step('notes','Prepare call notes and find the number','bear','prepare',1),step('call',cap(clean(ctx.title)),'you','act',8,{context:'phone'}),step('booked','Booked (add the time to Bear’s calendar)','you','confirm',1)]}),
   P({id:'online',method:'online',label:'Book online',description:'Some practices take bookings online, any time of day.',userMinutes:[3,5],elapsedDays:null,cost:null,reliability:'medium',disruption:'low',needs:['An online booking page'],leadDays:0,bearLevel:1,
    evidence:[rule('Not every practice has online booking; Bear can’t check this for you yet.')],
    steps:[step('find','Find their booking page','bear','prepare',1),step('book','Book online','you','act',4,{context:'online'}),step('booked','Booked (add the time to Bear’s calendar)','you','confirm',1)]})];
  case 'call':return [P({id:'phone',method:'phone',label:'Call',description:'A quick call during their opening hours.',userMinutes:[5,10],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:['Their number','Them being open'],leadDays:0,bearLevel:1,feasibility:'feasible',confidence:0.6,
    evidence:[rule('Businesses usually answer weekdays, about 9 to 5.')],steps:[step('notes','Prepare call notes','bear','prepare',1),step('call',cap(clean(ctx.title)),'you','act',8,{context:'phone'}),step('done','Spoken to them','you','confirm',1)]}),
   P({id:'message',method:'online',label:'Message instead',description:'Send an email or text if it doesn’t need a conversation.',userMinutes:[2,4],elapsedDays:[0,3],cost:null,reliability:'medium',disruption:'low',needs:['Their email or number'],leadDays:2,bearLevel:1,
    evidence:[rule('A message can be sent any time, but the reply may take a few days.')],steps:[step('draft','Draft the message','bear','prepare',1),step('send','Send it','you','act',2,{context:'online'}),step('reply','Wait for a reply','you','wait',0,{waitDays:3}),step('done','Sorted','you','confirm',1)]})];
  case 'form':return [P({id:'online',method:'online',label:'Fill it in',description:'Bear fills in what it knows; you check, sign and send it.',userMinutes:[5,10],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:['The form','Your details'],leadDays:1,bearLevel:1,feasibility:'feasible',confidence:0.6,
    evidence:[rule('Forms are quickest done in one sitting, usually in the evening.')],steps:[step('prep','Get the form ready','bear','prepare',1),step('check','Check, sign and send the form','you','act',6,{context:'online'}),step('done','Sent','you','confirm',1)]})];
  case 'bill':return [P({id:'online',method:'online',label:'Pay online',description:'Pay through your bank or the biller’s site.',userMinutes:[3,5],elapsedDays:[0,2],cost:null,reliability:'high',disruption:'low',needs:['The amount and biller details'],leadDays:2,bearLevel:1,feasibility:'feasible',confidence:0.7,
    evidence:[rule('Bank transfers can take 1–2 business days to clear.')],steps:[step('prep','Get the payment details ready','bear','prepare',1),step('pay','Pay the bill','you','act',4,{context:'online'}),step('done','Paid','you','confirm',1)]})];
  case 'followup':return [P({id:'message',method:'online',label:'Send a follow-up',description:'Bear drafts a polite follow-up; you send it and Bear watches for the reply.',userMinutes:[2,4],elapsedDays:[1,5],cost:null,reliability:'medium',disruption:'low',needs:['Who to contact'],leadDays:3,bearLevel:1,feasibility:'feasible',confidence:0.6,
    evidence:[rule('Replies usually take a few days; Bear checks back if nothing arrives.')],steps:[step('draft','Draft the follow-up','bear','prepare',1),step('send','Send the follow-up','you','act',2,{context:'online'}),step('reply','Wait for their reply','you','wait',0,{waitDays:3}),step('done','They replied and it’s sorted','you','confirm',1)]}),
   P({id:'phone',method:'phone',label:'Ring them',description:'A call gets an answer faster, during opening hours.',userMinutes:[5,10],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:['Their number'],leadDays:0,bearLevel:1,
    evidence:[rule('Faster than email, but needs them to be open.')],steps:[step('notes','Prepare call notes','bear','prepare',1),step('call','Ring them','you','act',8,{context:'phone'}),step('done','Sorted','you','confirm',1)]})];
  case 'aspiration':return [P({id:'small',method:'other',label:'One small step',description:'No deadline. Bear helps you find one small step whenever you feel like it.',userMinutes:[10,30],elapsedDays:null,cost:null,reliability:'medium',disruption:'low',needs:[],leadDays:0,bearLevel:1,feasibility:'feasible',confidence:0.5,
    evidence:[rule('Aspirations never become urgent on their own.')],steps:[step('ideas','Break it into small steps','bear','prepare',1),step('first','Take the first small step','you','act',15,{context:'any'}),step('done','Done for now','you','confirm',1)]})];
  case 'chore':return [P({id:'home',method:'in_person',label:'Do it at home',description:'When there’s a gap in the day.',userMinutes:[Math.max(5,ctx.minutesGuess),Math.max(10,ctx.minutesGuess*2)],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:['A bit of time'],leadDays:0,bearLevel:1,feasibility:'feasible',confidence:0.5,
    evidence:[rule('Flexible: fits around everything else.')],steps:[step('steps','Break it into small steps','bear','prepare',1),step('do',cap(clean(ctx.title)),'you','act',Math.max(5,ctx.minutesGuess),{context:'home'}),step('done','Done','you','confirm',1)]})];
  default:return [P({id:'do',method:'other',label:'Do it',description:'A straightforward one.',userMinutes:[Math.max(2,ctx.minutesGuess),Math.max(5,ctx.minutesGuess)],elapsedDays:null,cost:null,reliability:'high',disruption:'low',needs:[],leadDays:0,bearLevel:0,feasibility:'feasible',confidence:0.5,
    evidence:[rule('No special preparation needed.')],steps:[step('do',cap(clean(ctx.title)),'you','act',Math.max(2,ctx.minutesGuess),{context:'any'}),step('done','Done','you','confirm',1)]})];
 }
}

// ---------- Deadlines and opportunities ----------
export function deadlinesFor(u:Understood,p:Pathway|null):Deadlines{
 const outcome=u.deadline;
 // The last day to act on this pathway and still make the outcome deadline (lead time is an estimate).
 const action=outcome&&p?addDays(outcome,-Math.max(0,p.leadDays)):outcome;
 const opportunity=outcome&&p&&p.method==='online'&&u.kind==='acquire'?addDays(outcome,-ONLINE_LEAD_DAYS):null;
 return {outcome,action,opportunity,followUp:null,window:null};
}
export function opportunitiesFor(u:Understood,paths:Pathway[],today:string):Opportunity[]{
 const out:Opportunity[]=[];
 const online=paths.find(p=>p.id==='online'&&u.kind==='acquire');
 if(online&&online.feasibility!=='infeasible'&&u.deadline){
  const until=addDays(u.deadline,-ONLINE_LEAD_DAYS);const left=daysBetween(today,until)??0;
  out.push({id:'order-online',description:left>=0?'Ordering today could save a shopping trip later this week.':'Ordering now might still arrive in time, but it’s close.',until,savedMinutes:30,avoids:'a shopping trip',
   confidence:left>=0?0.6:0.35,status:left<0?'uncertain':left<=1?'expiring':'available',evidence:[rule(`Online orders usually need about ${ONLINE_LEAD_DAYS} days to arrive (estimate).`)]});
 }
 if(u.kind==='gifts'&&u.deadline){const until=addDays(u.deadline,-14);const left=daysBetween(today,until)??0;
  out.push({id:'gifts-early',description:'Choosing a few now could avoid last-minute shopping.',until,savedMinutes:60,avoids:'last-minute shopping',confidence:0.5,status:left<0?'expiring':left<=7?'expiring':'available',evidence:[rule('Online delivery gets slower and stock gets thinner close to Christmas (general pattern, not a specific cut-off).')]});}
 if(u.kind==='bill'&&u.deadline){const until=addDays(u.deadline,-2);const left=daysBetween(today,until)??0;
  out.push({id:'pay-early',description:'Paying a couple of days early means the payment clears in time.',until,savedMinutes:null,avoids:'a late fee',confidence:0.5,status:left<0?'expiring':left<=1?'expiring':'available',evidence:[rule('Bank payments can take 1–2 business days.')]});}
 return out;
}
// Least disruption first, then least of her time, then the most reliable. Feasible beats uncertain; infeasible never wins.
export function rankPathways(paths:Pathway[],prefs:{method?:Method|null;avoid?:Method|null}={}):Pathway[]{
 const fe={feasible:0,uncertain:1,infeasible:9},dis={low:0,medium:1,high:2},rel={high:0,medium:1,low:2};
 return [...paths].sort((a,b)=>(fe[a.feasibility]-fe[b.feasibility])
  ||((prefs.method&&a.method===prefs.method?0:1)-(prefs.method&&b.method===prefs.method?0:1))
  ||((prefs.avoid&&a.method===prefs.avoid?1:0)-(prefs.avoid&&b.method===prefs.avoid?1:0))
  ||(dis[a.disruption]-dis[b.disruption])||(a.userMinutes[0]-b.userMinutes[0])||(rel[a.reliability]-rel[b.reliability]));
}
export const parseOk=(iso:string|null)=>!!parseISODate(iso);
