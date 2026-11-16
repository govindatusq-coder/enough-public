// Bear Helps: getting the work ready so she only has to check it and act. Bear never sends, pays or submits anything itself:
// the person opens the draft in her own Mail or Messages app, rings the number herself, pays through her own bank.
import type {Bill,Task} from '../domain/types.ts';

export type HelpKind='email'|'message'|'call'|'followup'|'bill'|'form'|'steps';
export interface Help{kind:HelpKind;label:string;draft:{to:string;subject:string;body:string}|null;points:string[]|null;steps:string[]|null;searchFor:string|null;bill:{amount:string|null;dueAt:string|null;href:string}|null;formHref:string|null}

const strip=(t:string,re:RegExp)=>t.replace(re,'').replace(/^(?:the|a|an|my|our)\s+/i,'').trim();
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
export function helpKind(task:Pick<Task,'title'|'prepared'|'preparedForm'>,hasBill:boolean):HelpKind|null{
 const t=task.title;
 if(hasBill)return 'bill';
 if(task.preparedForm)return 'form';
 if(/\b(follow[- ]?up|chase|check (?:in|on|back)|hear back)\b/i.test(t))return 'followup';
 if(/\b(call|ring|phone)\b/i.test(t))return 'call';
 if(task.prepared?.payload.email||/\b(email|e-mail|reply|respond|write to|rsvp)\b/i.test(t))return 'email';
 if(task.prepared?.payload.sms||/\b(text|sms|message)\b/i.test(t))return 'message';
 if(/\b(plan|organi[sz]e|holiday|trip|party|build|renovat\w*|book|arrange|fix|presents?|gifts?|christmas)\b/i.test(t))return 'steps';
 return null;
}
function stepsFor(t:string):string[]{
 if(/\b(holiday|trip|travel)\b/i.test(t))return ['Pick the dates that work for everyone','Set a rough budget','Choose where to go','Book somewhere to stay','Book travel (flights, car, ferry)','Tell school or work, and arrange pet care'];
 if(/\b(christmas|presents?|gifts?)\b/i.test(t))return ['Write the list of who needs a present','Jot one idea next to each name','Set a rough budget','Order what can be delivered','Note what still needs a shop trip'];
 if(/\bparty\b/i.test(t))return ['Pick a date and place','Decide who to invite','Send the invitations','Sort food and cake','Plan one or two activities'];
 if(/\b(build|renovat\w*|pen|shed|deck)\b/i.test(t))return ['Decide what you want and where it goes','Measure the space','Look up a plan or ask someone who has done one','List materials and get a price','Choose a weekend to start'];
 if(/\bfix\b/i.test(t))return ['Have a look and take a photo','Work out whether it is a do-it-yourself job','Get what you need, or find someone to do it','Do it, or book it in'];
 if(/\bbook\b/i.test(t))return ['Find who to book with','Check two or three times that suit','Book it','Put it in Bear’s calendar'];
 return ['Work out the very first step','Gather what you need for it','Do that one step','Decide the next step'];
}
export function helpFor(task:Task,bill:Bill|null,name:string):Help|null{
 const kind=helpKind(task,!!bill);if(!kind)return null;const t=task.title;const sign=name?`\n\nThanks,\n${name}`:'\n\nThanks';
 const base:Help={kind,label:'',draft:null,points:null,steps:null,searchFor:null,bill:null,formHref:null};
 if(kind==='bill'&&bill)return {...base,label:'Bill details are ready',bill:{amount:bill.amountCents?`$${(bill.amountCents/100).toFixed(2)}`:null,dueAt:bill.dueAt,href:`/bear/bills/${bill.id}`}};
 if(kind==='form')return {...base,label:'Bear has filled in what it knows on the form',formHref:`/bear/tasks/${task.id}`};
 if(kind==='followup'){
  const who=strip(t,/^.*?\b(?:follow[- ]?up|chase|check (?:in|on|back)|hear back)\b\s*(?:with|on|from|about)?\s*/i)||'there';
  return {...base,label:'A follow-up message is drafted',draft:{to:'',subject:`Following up: ${cap(who)}`,body:`Hi,\n\nJust following up on this. Could you let me know where things are up to, and when I can expect to hear back?${sign}`}};
 }
 if(kind==='call'){
  const who=strip(t,/^.*?\b(?:call|ring|phone)\b\s*(?:the|up)?\s*/i)||t;
  return {...base,label:'Talking points for the call',searchFor:`${who} phone number`,points:[`Who: ${cap(who)}`,'Say who you are and why you’re calling','Ask the one thing you need answered first','Have your calendar open in case they offer a time','Write down the name of the person you spoke to, and what was agreed']};
 }
 if(kind==='email'){
  if(task.prepared?.payload.email){const e=task.prepared.payload.email;return {...base,label:'Bear drafted this email from the notice',draft:{to:e.to||'',subject:e.subject,body:e.body}};}
  const about=strip(t,/^.*?\b(?:email|e-mail|reply to|respond to|write to|rsvp(?: to)?)\b\s*/i)||t;
  return {...base,label:'A starting draft is ready',draft:{to:'',subject:/rsvp/i.test(t)?`RSVP: ${cap(about)}`:cap(about),body:/rsvp/i.test(t)?`Hi,\n\nThank you for the invitation. We'd love to come.${sign}`:`Hi,\n\n[What you need to say about ${about}]${sign}`}};
 }
 if(kind==='message'){
  const s=task.prepared?.payload.sms;
  return {...base,label:'A message is drafted',draft:{to:s?.to||'',subject:'',body:s?.body||`Hi, just a quick one about ${strip(t,/^.*?\b(?:text|sms|message)\b\s*/i)||t}.`}};
 }
 return {...base,label:'Broken into small steps',steps:task.prepared?.payload.steps?.length?task.prepared.payload.steps:stepsFor(t)};
}
// Links that open her own apps with the draft filled in. She sends it; Bear never does.
export const mailtoFor=(d:{to:string;subject:string;body:string})=>`mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
export const smsFor=(d:{to:string;body:string})=>`sms:${encodeURIComponent(d.to)}?&body=${encodeURIComponent(d.body)}`;
