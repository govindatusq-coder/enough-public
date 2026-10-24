// No-model understanding of free text (typed, pasted or spoken). Conservative: it finds a
// date, a person, a likely Area and a title; anything uncertain is left for the user.
import {DATE_SPAN,parseAUDate} from '../domain/dates.ts';
import type {AreaKey} from '../domain/types.ts';
import type {GeneralOutput} from './general-schema.ts';
import type {BillOutput} from './bill-schema.ts';

const areaWords:[RegExp,AreaKey][]=[[/\b(bill|invoice|rates|fee|fees|rego|registration|insurance|subscription|bpay|payment|pay)\b/i,'money'],[/\b(school|kindy|childcare|daycare|excursion|uniform|teacher|homework|class|pickup|pick-up|drop-off|birthday|party|playdate|grandma|grandad|mum|dad|kids?|son|daughter)\b/i,'family'],[/\b(doctor|gp|dentist|dental|physio|specialist|appointment|prescription|script|vaccin|immunis|medicare|hospital|optometrist)\b/i,'health'],[/\b(work|meeting|deadline|boss|client|report|office|shift|roster)\b/i,'work'],[/\b(plumber|electrician|clean|cleaning|garden|lawn|bin|bins|rent|lease|strata|repair|groceries|shopping|washing|laundry)\b/i,'home'],[/\b(gym|run|walk|yoga|haircut|coffee with|massage|me time|book club)\b/i,'me']];
const kindWords:[RegExp,GeneralOutput['kind']][]=[[/\b(bill|invoice|amount due|rates notice|bpay)\b/i,'bill'],[/\b(appointment|dentist|doctor|gp|physio|specialist|check-?up)\b/i,'appointment'],[/\b(school|kindy|childcare|excursion|permission|uniform|book week|assembly)\b/i,'school'],[/\b(form|sign|signature|fill in|complete the|application|enrol)\b/i,'form'],[/\b(buy|grocer|shopping|milk|bread|present|gift)\b/i,'shopping'],[/\b(party|wedding|birthday|concert|game|match|tournament|invite|rsvp)\b/i,'event'],[/\b(drop off|pick up|return|post|collect|take .* to)\b/i,'errand']];
const names=/\b(?:for|with|take|pick up|drop off|book)\s+([A-Z][a-z]{2,})\b/;
const conf=(v:unknown,c:number)=>({value:v as never,confidence:v===null?0:c,evidence:null});
export function understandWithRules(text:string,referenceYear=new Date().getFullYear(),bill:BillOutput|null=null):GeneralOutput{
 const clean=text.replace(/\r/g,'').trim();const first=clean.split('\n').map(l=>l.trim()).find(Boolean)||'';
 const kind=bill&&bill.documentType==='bill'?'bill':(kindWords.find(([r])=>r.test(clean))?.[1]||(clean.length<140?'note':'other'));
 const area=bill&&bill.documentType==='bill'?'money':(areaWords.find(([r])=>r.test(clean))?.[1]||null);
 let when:string|null=null;for(const m of clean.matchAll(DATE_SPAN)){const iso=parseAUDate(m[0],referenceYear);if(iso){when=iso;break;}}
 const rel=/\b(today|tomorrow|tonight)\b/i.exec(clean);
 const time=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(clean);const timeOfDay=time?`${String((+time[1]%12)+(time[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')}:${time[2]||'00'}`:null;
 const person=names.exec(clean)?.[1]||null;
 const sentence=first.replace(/[.!?].*$/,'').slice(0,80);
 const title=bill&&bill.biller.value?`Pay ${bill.category.value?bill.category.value.replace('_',' '):bill.biller.value} bill`:sentence?sentence.charAt(0).toUpperCase()+sentence.slice(1):null;
 return {kind,summary:first.slice(0,200),title:conf(title,bill?0.8:0.55),area:conf(area,bill?0.9:0.55),when:conf(when,when?0.6:0),timeOfDay:conf(timeOfDay,0.6),person:conf(person,0.5),location:conf(null,0),isRecurring:conf(bill?bill.isRecurring.value:null,0.4),steps:[],estimatedMinutes:null,extractedText:clean.slice(0,6000),bill:bill&&bill.documentType!=='not_a_bill'?bill:null,...(rel?{whenHint:rel[1].toLowerCase()}:{})} as GeneralOutput;
}
