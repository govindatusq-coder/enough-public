// A page with several things on it (a term calendar, a newsletter, a fixtures list, a "what's on" screenshot) is several
// responsibilities, each with its own date. A model reads the page and lists them; fixed rules then check every date before it
// is believed. A date that does not hold up is dropped (the item is kept without one): Bear never guesses a day.
import {z} from 'zod';
import {daysBetween,isValidISODate,parseISODate} from '../domain/dates.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import type {AreaKey} from '../domain/types.ts';
import {classify,lightFor,nextActionFor,soonByNature,suggestStart,urgencyOf,type Sorted} from './sorter.ts';

export interface PageEvent{title:string;date:string|null;endDate:string|null;time:string|null;action:string|null;actionDue:string|null;source:string}
const nullable=(t:Record<string,unknown>)=>({anyOf:[t,{type:'null'}]});
export const pageEventsJsonSchema={type:'object',additionalProperties:false,required:['events'],properties:{events:{type:'array',items:{type:'object',additionalProperties:false,
 required:['title','date','endDate','time','action','actionDue','source'],properties:{title:{type:'string'},date:nullable({type:'string'}),endDate:nullable({type:'string'}),time:nullable({type:'string'}),action:nullable({type:'string'}),actionDue:nullable({type:'string'}),source:{type:'string'}}}}}};
const eventSchema=z.object({title:z.string().trim().min(2).max(120),date:z.string().nullable(),endDate:z.string().nullable(),time:z.string().nullable(),action:z.string().trim().max(160).nullable(),actionDue:z.string().nullable(),source:z.string().trim().max(500)}).strict();
const outSchema=z.object({events:z.array(eventSchema).max(40)}).strict();
export const pageEventsPrompt=(today:string)=>`You read a page (a photo, screenshot, PDF or pasted text) that a busy parent in Australia was given: a school newsletter, term calendar, sports fixtures, a list of events, a notice. Today is ${today}. Dates on the page are Australian (day before month).
List EVERY separate event, deadline or thing-to-do on the page as its own entry. A page with eight dated lines gives eight entries. Do not merge them and do not summarise the page as one event.
For each entry:
- title: a short name for that one thing, in the page's own words (for example "Year 3 excursion to the zoo", "School photos", "Term 4 ends"). No dates in the title.
- date: the day it happens, as YYYY-MM-DD. Work it out from the page: use the year printed on the page if there is one; otherwise the next time that day and month falls on or after today. If the page gives a weekday, the date must fall on that weekday. If the page gives no day for it, null.
- endDate: the last day if it runs over several days, else null.
- time: start time as HH:MM (24-hour) if the page gives one, else null.
- action: what the parent has to do for it, if the page says (for example "Return the permission form", "Pay $25", "Send a gold coin"), else null.
- actionDue: the day that action is due, as YYYY-MM-DD, only if the page gives one, else null.
- source: the exact words from the page for this entry, copied, including its date as printed.
Leave out page furniture (headers, addresses, greetings, sign-offs). Never invent an event, a date or an action that is not on the page.`;

const WEEKDAYS=['sun','mon','tue','wed','thu','fri','sat'];
const iso=(s:string|null)=>s&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&isValidISODate(s)?s:null;
// The weekday printed on the page is the best check there is: if the model's date lands on a different weekday, try the same
// day and month in the neighbouring years; if none fits, the date is not trusted.
function settleDate(date:string|null,source:string,today:string):string|null{
 let d=iso(date);if(!d)return null;
 const wd=/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(source)?.[1].toLowerCase();
 if(wd){const want=WEEKDAYS.indexOf(wd);const fits=(x:string)=>parseISODate(x)!.getDay()===want;
  if(!fits(d)){const [y,m,day]=d.split('-');const alt=[1,-1].map(k=>`${Number(y)+k}-${m}-${day}`).find(x=>isValidISODate(x)&&fits(x));if(!alt)return null;d=alt;}}
 const away=daysBetween(today,d)??0;
 return away<-45||away>550?null:d;   // long gone, or implausibly far off: not believed
}
// What the model returned -> checked events. `transcript` (the page's text, when Bear has it) must contain each entry's words.
export function checkEvents(raw:unknown,today:string,transcript:string|null):PageEvent[]{
 const p=outSchema.safeParse(raw);if(!p.success)return [];
 const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ');const page=transcript?norm(transcript):null;
 const seen=new Set<string>();const out:PageEvent[]=[];
 for(const e of p.data.events){
  if(page){const w=norm(e.source+' '+e.title).split(/\s+/).filter(x=>x.length>3);if(w.length&&w.filter(x=>page.includes(x)).length/w.length<0.5)continue;}   // not on the page
  const date=settleDate(e.date,e.source,today);let endDate=settleDate(e.endDate,'',today);if(endDate&&(!date||endDate<date))endDate=null;
  let actionDue=settleDate(e.actionDue,'',today);if(actionDue&&date&&actionDue>date)actionDue=null;   // an action is due on or before its event
  const time=e.time&&/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)?e.time:null;
  const title=e.title.replace(/\s+/g,' ').replace(/[\s.,:;–-]+$/,'');const key=norm(title)+'|'+(date||'');
  if(seen.has(key)||title.length<2)continue;seen.add(key);
  out.push({title,date,endDate,time,action:e.action||null,actionDue,source:e.source});
 }
 return out;
}
export async function readPageEvents(provider:StructuredModelProvider,input:{text:string|null;images:{mime:string;bytes:Uint8Array}[];documents:{mime:string;bytes:Uint8Array}[]},today:string,transcript:string|null=null):Promise<PageEvent[]>{
 try{
  const r=await provider.extract({schema:pageEventsJsonSchema as unknown as Record<string,unknown>,system:pageEventsPrompt(today),text:input.text,images:input.images,documents:input.documents,maxOutputTokens:6000});
  return checkEvents(r.output,today,transcript||input.text);
 }catch{return [];}
}
// One page event -> one sorted responsibility. The date that needs the parent is the action's due day when there is one,
// otherwise the day of the event. Past events are left out: there is nothing left to do about them.
const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
export function eventsToSorted(events:PageEvent[],today:string,children:string[]=[]):Sorted[]{
 const out:Sorted[]=[];
 // The page as a whole says what kind of page it is: on a school page, "Book fair" and "Term 4 ends" are family things
 // even though those few words alone do not say so.
 const whole=classify(events.map(e=>e.title+' '+e.source).join(' . ')+' '+(/\b(term \d|year \d|p&c|assembly|carnival|students?|classroom|principal)\b/i.test(events.map(e=>e.source+' '+e.title).join(' '))?'school':''),children);
 const pageArea=whole.domain!=='me'?whole.domain:null;
 for(const e of events){
  const day=e.actionDue||e.date;if(day&&day<today&&!(e.endDate&&e.endDate>=today))continue;
  const words=[e.title,e.action||'',e.source].join(' ');const own=classify(words,children);const domain=own.domain==='me'&&pageArea?pageArea:own.domain;const secondary=own.secondary;
  const title=cap(e.action&&e.actionDue?`${e.action.replace(/[.\s]+$/,'')} for ${e.title.charAt(0).toLowerCase()+e.title.slice(1)}`:e.title).slice(0,90);
  const urgency=urgencyOf(e.source);const light=lightFor({deadline:day,urgency,soonByNature:soonByNature(title)},today);
  out.push({title,original:e.source.slice(0,400)||title,domain:domain as AreaKey,secondary,deadline:day,deadlineSource:day?'stated':null,window:null,windowBy:null,
   suggestedStart:suggestStart(title,day,light.light,today),urgency,nextAction:e.action&&!e.actionDue?e.action:nextActionFor(title+' '+(e.action||'')),...light});
 }
 return out;
}
export const eventNote=(e:PageEvent)=>[e.date?`On ${e.date}${e.time?` at ${e.time}`:''}${e.endDate?` to ${e.endDate}`:''}.`:null,e.action?`${e.action}${e.actionDue?` by ${e.actionDue}`:''}.`:null,'From a page you gave Bear.'].filter(Boolean).join(' ');
// Bear's own transcription of the page, when it has one: an entry whose words are not on the page is dropped.
export function keepOnPage(events:PageEvent[],transcript:string|null):PageEvent[]{
 if(!transcript||transcript.trim().length<20)return events;
 const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9 ]+/g,' ');const page=norm(transcript);
 return events.filter(e=>{const w=norm(e.source+' '+e.title).split(/\s+/).filter(x=>x.length>3);return !w.length||w.filter(x=>page.includes(x)).length/w.length>=0.5;});
}
