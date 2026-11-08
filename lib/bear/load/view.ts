import {labelFor,stepActive} from './action.ts';
import {graphState,minimumHumanAction} from './engine.ts';
import type {LoadGraph,LoadNode,LoadState,MinimumHumanAction} from './types.ts';
import {friendlyDate,friendlyRange,money,sentence,the} from './words.ts';

// What the person sees: what needs them now, and what Bear has covered. Every line here is
// something Bear will genuinely do (a reminder it has set, a date it is holding), never an
// implied capability like "watching your inbox".
export interface LoadView{
 state:LoadState;title:string;headline:string;
 needsYou:MinimumHumanAction|null;nothingForYou:boolean;
 covered:string[];waiting:{who:string;line:string}[];comingUp:{line:string;date:string}[];
 nextBringBack:string|null; // date Bear will next bring this back (a reminder is set for it)
 // Bear's preparation (School Admin pack): the details the person needs, ready to use. Never an action
 // Bear took: a link is a link to open, a reference is something to copy.
 prepared?:{key:string;label:string;value:string;href:string|null;copy:string|null;done:boolean}[];
}

function holdLine(n:LoadNode,today:string):string|null{
 const e=n.entities;
 switch(n.pattern){
  case 'BILL_PAYMENT':return e.amountCents||e.dueDate?`${n.role==='attached'?'Payment':n.title}${e.amountCents?' '+money(e.amountCents):''}${e.dueDate?` due ${friendlyDate(e.dueDate,today)}`:''}`:null;
  case 'SCHOOL_EVENT':case 'INVITATION_EVENT':return e.eventDate?`${n.title} ${friendlyRange(e.eventDate,e.eventEndDate,today)}`:null;
  case 'APPOINTMENT':return e.eventDate?`${n.title} ${friendlyDate(e.eventDate,today)}${e.time?' at '+e.time:''}`:null;
  case 'RENEWAL':return e.expiryDate||e.dueDate?`${n.title} renews by ${friendlyDate(e.expiryDate||e.dueDate,today)}`:null;
  case 'FORM_APPLICATION':return e.dueDate?`${n.role==='attached'?n.title:n.title} due ${friendlyDate(e.dueDate,today)}`:null;
  case 'REPLENISHMENT':return e.dueDate?`Next ${n.title.toLowerCase()} run around ${friendlyDate(e.dueDate,today)}`:null;
  default:return null;
 }
}

// quiet: a "no rush" item. Nothing is promised back on a date unless the person asked for reminders.
export function describe(graph:LoadGraph,today:string,opts:{quiet?:boolean}={}):LoadView{
 const state=graphState(graph);const primary=graph.nodes.find(n=>n.id===graph.primaryId)!;
 const needsYou=state==='resolved'?null:minimumHumanAction(graph,today);
 const covered:string[]=[];const waiting:LoadView['waiting']=[];const comingUp:LoadView['comingUp']=[];
 for(const n of graph.nodes){
  if(n.state==='resolved'){if(n.role==='attached')covered.push(`${n.title} sorted`);continue;}
  const hold=holdLine(n,today);
  for(const s of n.steps){
   if(!stepActive(s,n,graph)||s.owner!=='human'||s.id===needsYou?.stepId)continue;
   if(s.surfaceFrom&&s.surfaceFrom>today)comingUp.push({line:`${sentence(labelFor(s,n).replace(/^(pack for [^:]+): .*/i,'$1').replace(/^Pack/,'Packing'))}`,date:s.surfaceFrom});
   else if(n.role==='attached'&&hold)covered.push(hold);
  }
  if(n.waiting)waiting.push({who:n.waiting.waitingFor,line:opts.quiet?`Waiting on ${n.waiting.waitingFor}. Nothing for you to do.`:`Waiting on ${n.waiting.waitingFor}. Nothing for you to do. I’ll bring this back ${friendlyDate(n.waiting.nextCheckAt,today)} if you haven’t heard.`});
  if(hold&&n.role==='primary')covered.unshift(hold);
 }
 const uniq=[...new Set(covered)];
 comingUp.sort((a,b)=>a.date.localeCompare(b.date));
 const nextBringBack=[...comingUp.map(c=>c.date),...graph.nodes.map(n=>n.waiting?.nextCheckAt).filter((d):d is string=>!!d)].sort()[0]||null;
 const t=the(primary.title);
 const acted=graph.nodes.some(n=>n.steps.some(s=>s.owner==='human'&&s.status==='done'));
 // A title that is already an action ("Return the permission form") reads badly after "I've got the".
 const action=/^(return|pay|book|buy|get|call|ring|email|send|sign|fill|complete|renew|fix|pick|drop|collect|organi[sz]e|sort|check|finish|write|clean|take|bring|order|cancel|reply|rsvp|find|ask|tell|make|update|submit|lodge)\b/i.test(primary.title);
 const headline=state==='resolved'?'All sorted. Off your mind.':state==='captured'&&!needsYou?(action?'I’m holding onto this.':`I’m holding onto ${t}.`):acted&&(state==='covered'||state==='waiting')?(action?'All covered.':`${sentence(primary.title)} covered.`):action?'I’ve got this.':`I’ve got ${t}.`;
 const prepared=preparedFor(graph,today);
 return {prepared,state,title:primary.title,headline,needsYou,nothingForYou:!needsYou&&state!=='resolved',covered:uniq,waiting,comingUp:comingUp.map(c=>({line:opts.quiet?`${c.line} will be here when you want it`:/^\w+ing\b/.test(c.line)?`${c.line} will come back ${friendlyDate(c.date,today)}`:`Back ${friendlyDate(c.date,today)}: ${c.line}`,date:c.date})),nextBringBack:opts.quiet?null:nextBringBack};
}

const hrefOf=(link:string|null)=>link?(/^https?:\/\//i.test(link)?link:`https://${link}`):null;
function preparedFor(graph:LoadGraph,today:string):NonNullable<LoadView['prepared']>{
 const primary=graph.nodes.find(n=>n.id===graph.primaryId)!;const d=primary.entities.school;if(!d)return [];
 const has=(k:string)=>graph.nodes.some(n=>n.evidence.some(e=>e.key===k));const out:NonNullable<LoadView['prepared']>=[];
 const by=(x:string|null)=>x?` · by ${friendlyDate(x,today)}`:'';
 for(const o of d.obligations){
  if(o.type==='consent')out.push({key:'consent',label:'Consent',value:`Sign and return the form${by(o.dueDate)}${o.method?` · ${o.method}`:''}`,href:hrefOf(o.link),copy:null,done:has('submission_confirmed')});
  if(o.type==='payment')out.push({key:'payment',label:'Payment',value:[o.amountCents?money(o.amountCents):'Amount not stated',o.dueDate?`by ${friendlyDate(o.dueDate,today)}`:null,o.method?`via ${o.method}`:null].filter(Boolean).join(' · '),href:hrefOf(o.link),copy:o.reference,done:has('payment_confirmed')||has('already_paid')});
  if(o.type==='booking')out.push({key:'booking',label:'Booking',value:`${o.link?o.link.replace(/^https?:\/\//,''):'Booking details in the notice'}${o.code?` · code ${o.code}`:''}${by(o.dueDate)}`,href:hrefOf(o.link),copy:o.code,done:has('booked')});
  if(o.type==='order')out.push({key:'order',label:'Ordering',value:`${o.link?o.link.replace(/^https?:\/\//,''):'Order details in the notice'}${o.code?` · code ${o.code}`:''}${by(o.dueDate)}`,href:hrefOf(o.link),copy:o.code,done:has('ordered')});
  if(o.type==='medical')out.push({key:'medical',label:'Medical details',value:`Update the school’s medical form${by(o.dueDate)}${o.method?` · ${o.method}`:''}. Bear doesn’t fill in health details.`,href:hrefOf(o.link),copy:null,done:has('medical_sent')});
 }
 const items=[...new Set(d.obligations.filter(o=>['equipment','costume','materials'].includes(o.type)).flatMap(o=>o.items))];
 if(items.length)out.push({key:'bring',label:'To have ready',value:items.join(', '),href:null,copy:null,done:has('packed')||has('costume_ready')});
 return out;
}
