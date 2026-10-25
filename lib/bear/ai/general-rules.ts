// No-model understanding of free text (typed, pasted or spoken). Conservative: it finds a
// date, a person, a likely Area and a title; anything uncertain is left for the user.
import {DATE_SPAN,parseAUDate} from '../domain/dates.ts';
import type {AreaKey} from '../domain/types.ts';
import {parseItemLine,type RawItem} from '../domain/items.ts';
import type {GeneralOutput} from './general-schema.ts';
import type {BillOutput} from './bill-schema.ts';

const areaWords:[RegExp,AreaKey][]=[[/\b(bill|invoice|rates|fee|fees|rego|registration|insurance|subscription|bpay|payment|pay)\b/i,'money'],[/\b(school|kindy|childcare|daycare|excursion|uniform|teacher|homework|class|pickup|pick-up|drop-off|birthday|party|playdate|grandma|grandad|mum|dad|kids?|son|daughter)\b/i,'family'],[/\b(doctor|gp|dentist|dental|physio|specialist|appointment|prescription|script|vaccin|immunis|medicare|hospital|optometrist)\b/i,'health'],[/\b(work|meeting|deadline|boss|client|report|office|shift|roster)\b/i,'work'],[/\b(plumber|electrician|clean|cleaning|garden|lawn|bin|bins|rent|lease|strata|repair|groceries|shopping|washing|laundry|bunnings|hardware)\b/i,'home'],[/\b(gym|run|walk|yoga|haircut|coffee with|massage|me time|book club)\b/i,'me']];
const kindWords:[RegExp,GeneralOutput['kind']][]=[[/\b(bill|invoice|amount due|rates notice|bpay)\b/i,'bill'],[/\b(appointment|dentist|doctor|gp|physio|specialist|check-?up)\b/i,'appointment'],[/\b(school|kindy|childcare|excursion|permission|uniform|book week|assembly)\b/i,'school'],[/\b(form|sign|signature|fill in|complete the|application|enrol)\b/i,'form'],[/\b(buy|grocer\w*|shopping|shopping list|milk|bread|present|gift|bunnings|hardware|woolworths|coles|aldi|kmart|chemist|supermarket)\b/i,'shopping'],[/\b(party|wedding|birthday|concert|game|match|tournament|invite|rsvp)\b/i,'event'],[/\b(drop off|pick up|return|post|collect|take .* to)\b/i,'errand']];
const names=/\b(?:[Ff]or|[Ww]ith|[Tt]ake|[Pp]ick up|[Dd]rop off|[Bb]ook|[Cc]ollect)\s+([A-Z][a-z]{2,})\b/;
const notNames=new Set(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February','March','April','May','June','July','August','September','October','November','December','The','Tomorrow','Today','Tonight','Next','This']);
const conf=(v:unknown,c:number)=>({value:v as never,confidence:v===null?0:c,evidence:null});
export function understandWithRules(text:string,referenceYear=new Date().getFullYear(),billReading:BillOutput|null=null):GeneralOutput{
 const clean=text.replace(/\r/g,'').trim();const first=clean.split('\n').map(l=>l.trim()).find(Boolean)||'';
 // A date alone does not make a bill: there must be an amount due or bill wording.
 const bill=billReading&&billReading.documentType==='bill'&&(billReading.amountDueCents.value!==null||/\b(bill|invoice|amount due|rates notice|bpay)\b/i.test(clean))?billReading:null;
 const kind=bill?'bill':(kindWords.find(([r])=>r.test(clean))?.[1]||(clean.length<140?'note':'other'));
 const items=kind==='shopping'?listItems(clean):[];
 const area=bill&&bill.documentType==='bill'?'money':(areaWords.find(([r])=>r.test(clean))?.[1]||null);
 let when:string|null=null;for(const m of clean.matchAll(DATE_SPAN)){const iso=parseAUDate(m[0],referenceYear);if(iso){when=iso;break;}}
 const rel=/\b(today|tomorrow|tonight)\b/i.exec(clean);
 const time=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(clean);const timeOfDay=time?`${String((+time[1]%12)+(time[3].toLowerCase()==='pm'?12:0)).padStart(2,'0')}:${time[2]||'00'}`:null;
 const candidate=names.exec(clean)?.[1]||null;const person=candidate&&!notNames.has(candidate)?candidate:null;
 // Prefer an instruction in the text ("please return the permission form by…") over the opening line.
 const instr=/\b(?:please\s+)?(return|bring|sign|pay|book|buy|collect|send|complete|fill in|rsvp|confirm|renew|submit|order|pick up|drop off)\b([^.\n]*)/i.exec(clean);
 const sentence=(instr?(instr[1].charAt(0).toUpperCase()+instr[1].slice(1).toLowerCase()+instr[2]).replace(/\s+(by|before|on)\s+\d.*$/i,'').replace(/\s+(by|before)\s+[A-Z]?[a-z]+day.*$/i,''):first.replace(/[.!?].*$/,'')).trim().slice(0,80);
 const shopTitle=items.length>=2?listTitle(clean):null;
 const title=shopTitle?shopTitle:bill&&bill.biller.value?`Pay ${bill.category.value?bill.category.value.replace('_',' '):bill.biller.value} bill`:sentence?sentence.charAt(0).toUpperCase()+sentence.slice(1):null;
 return {kind,summary:first.slice(0,200),title:conf(title,bill?0.8:0.55),area:conf(area,bill?0.9:0.55),when:conf(when,when?0.6:0),timeOfDay:conf(timeOfDay,0.6),person:conf(person,0.5),location:conf(null,0),isRecurring:conf(bill?bill.isRecurring.value:null,0.4),steps:[],items,estimatedMinutes:null,extractedText:clean.slice(0,6000),bill:bill&&bill.documentType!=='not_a_bill'?bill:null,...(rel?{whenHint:rel[1].toLowerCase()}:{})} as GeneralOutput;
}

// A shopping list typed or spoken as lines, bullets or commas becomes items. No prices are
// guessed here: only the model estimates, and the app says so.
export function listItems(text:string):RawItem[]{
 const body=text.replace(/^(shopping|groceries|grocery list|shopping list|bunnings|to buy|buy|get|need|we need)\b[:\s-]*/i,'');
 const parts=(body.includes('\n')?body.split('\n'):body.split(/,|;|\band\b/i)).filter(l=>!/\b(by|before|due)\s+\d/i.test(l));
 const out=parts.map(parseItemLine).filter((x):x is RawItem=>!!x).slice(0,40);
 return out.length>=2?out:[];
}

// A short name for a list instead of the whole pasted line.
export function listTitle(text:string):string{
 const head=/^\s*(bunnings|woolworths|coles|aldi|kmart|chemist|groceries|grocery list|shopping list|shopping)\b/i.exec(text)?.[1]?.toLowerCase();
 if(!head)return 'Shopping list';
 if(head==='groceries'||head==='grocery list')return 'Groceries';
 if(head==='shopping'||head==='shopping list')return 'Shopping list';
 return head.charAt(0).toUpperCase()+head.slice(1)+' run';
}
