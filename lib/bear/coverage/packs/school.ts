import {addDays} from '../../domain/dates.ts';
import {findAmounts,findDates,findItems,normaliseText} from '../../load/extract.ts';
import type {SchoolDetails,SchoolObligationDetail} from '../../load/types.ts';
import type {CoveragePack} from '../types.ts';

// School Admin: the first full Coverage Pack. It reads a school notice (text, or the text Bear read
// from a photo, PDF or forwarded email) into the event(s), each obligation with its OWN deadline,
// amount, reference, link or code, and the child it is for. It is deterministic and confidence-aware:
// it never invents a date, an amount or a child, and it ignores instructions written inside the
// notice (a notice is untrusted input). The result rides on the existing SCHOOL_EVENT Load Pattern.

export const schoolPack:CoveragePack={
 id:'school',name:'School admin',status:'full',
 patterns:['SCHOOL_EVENT','FORM_APPLICATION','BILL_PAYMENT','PURCHASE_REQUIRED','APPOINTMENT','INVITATION_EVENT'],
 obligations:['excursions','camps','permission slips','school payments','parent–teacher interviews','sports carnivals','school photos','Book Week','uniform and costume requirements','fundraisers','medical information forms','school events','term dates','holiday preparation','classroom materials','homework and project deadlines','school messages needing a reply','recurring school activities'],
 sources:['typed or pasted text','photos and screenshots','PDFs','voice notes','the iPhone share sheet','forwarded emails (only when inbound email is set up)'],
 anticipates:['events that happened around the same time last year in this person’s own history (never assumed for all schools)'],
 dependencies:['consent before its deadline','payment before its deadline','equipment ready before the event','booking before bookings close'],
 prepares:['the original notice kept with the item','each deadline separately','payment amount, reference and link','a single packing list per event','booking link and code','a drafted reply to copy'],
 humanActions:['give consent (sign or submit it yourself)','make the payment yourself','pack or buy what is needed','book the interview time yourself','send any reply yourself','provide medical details yourself'],
 completionEvidence:['you tell Bear it is done','a forwarded confirmation email (when inbound email is set up)','an uploaded receipt'],
 followUpWhen:['a school deadline is close and nothing is confirmed','a reply was expected and you haven’t told Bear you heard back'],
 boundaries:['Bear only sees school notices you give it; it does not read the school app, portal or your inbox','Bear cannot sign, pay, submit or book anything','Bear never guesses medical details'],
 silentWhen:['everything is confirmed','the next deadline is still comfortably far away','the notice needs nothing from you'],
 requires:['store','extract','decompose','remind','draft','record_confirmation'],
};

export type SchoolEventKind='camp'|'excursion'|'incursion'|'carnival'|'photos'|'interviews'|'book_week'|'fundraiser'|'concert'|'disco'|'sports'|'term'|'holidays'|'assembly'|'event';
export interface SchoolEvent{kind:SchoolEventKind;title:string;date:string|null;endDate:string|null;confidence:number}
export interface SchoolReading{
 isSchool:boolean;confidence:number;events:SchoolEvent[];obligations:SchoolObligationDetail[];
 child:{name:string;confidence:number}|null;ambiguities:string[];untrustedInstructions:boolean;
}

const SCHOOL_SIGNALS=/\b(school|students?|year \d{1,2}|kindy|kindergarten|prep|foundation|parents and carers|dear (?:parents|families|carers)|teachers?|principal|classroom|our class|p&c|p&f|term \d|uniform|excursion|incursion|school camp|carnival|book week|parent[- ]teacher|permission (?:note|slip|form)|canteen|assembly|homework|school photos?)\b/gi;
const EVENTS:{kind:SchoolEventKind;re:RegExp;title:(m:RegExpExecArray,text:string)=>string}[]=[
 {kind:'camp',re:/\b(?:(year \d{1,2}|kindy|prep)\s+)?(?:school\s+)?camp\b/i,title:m=>`${yearOf(m[1])}camp`},
 {kind:'excursion',re:/\b(?:(year \d{1,2})\s+)?excursion(?:\s+to\s+(?:the\s+)?([A-Za-z][\w' ]{2,30}?))?(?=[.,;\n]|\s+(?:on|is|will|next|this)\b|$)/i,title:(m,t)=>m[2]?`Excursion to ${/\bto the\b/i.test(t)?'the ':''}${cleanPlace(m[2])}`:`${yearOf(m[1])}excursion`},
 {kind:'incursion',re:/\bincursion\b/i,title:()=>'Incursion'},
 {kind:'carnival',re:/\b(swimming|athletics|cross[- ]country|sports)\s+carnival\b/i,title:m=>`${cap(m[1].toLowerCase().replace('-',' '))} carnival`},
 {kind:'photos',re:/\bschool (?:photos?|photographs?)\b|\b(?:class|student) photos?\b/i,title:()=>'School photos'},
 {kind:'interviews',re:/\bparent[- –]?teacher (?:interviews?|meetings?|conferences?)\b/i,title:()=>'Parent–teacher interviews'},
 {kind:'book_week',re:/\bbook week\b|\bbook (?:character )?parade\b/i,title:()=>'Book Week parade'},
 {kind:'fundraiser',re:/\b(fundrais\w*|fete|raffle|colour run|walkathon|readathon|bake sale|mother'?s day stall|father'?s day stall)\b/i,title:m=>/fete/i.test(m[1])?'School fete':cap(m[1].toLowerCase())},
 {kind:'concert',re:/\b(?:school\s+)?(concert|performance|musical|play)\b(?=[^.]*\b(?:students|school|perform|parents)\b)/i,title:m=>`School ${m[1].toLowerCase()}`},
 {kind:'disco',re:/\bschool disco\b|\bdisco\b(?=[^.]*\bschool\b)/i,title:()=>'School disco'},
 {kind:'term',re:/\bterm (\d)\b[^.]*\b(?:starts?|begins?|commences?|ends?|finishes?|dates?)\b/i,title:m=>`Term ${m[1]}`},
 {kind:'holidays',re:/\b(?:school|term) holidays?\b/i,title:()=>'School holidays'},
 {kind:'sports',re:/\b(?:interschool|inter-school|gala day|sports day)\b/i,title:()=>'Sports day'},
 {kind:'assembly',re:/\b(?:special |awards? )?assembly\b/i,title:()=>'Assembly'},
];
const yearOf=(y?:string)=>y?`${cap(y.toLowerCase()).replace(/^Year/,'Year')} `:'School ';
const cap=(s:string)=>s.replace(/^\w/,c=>c.toUpperCase());
const cleanPlace=(s:string)=>s.trim().replace(/\s+(on|in|at)$/i,'');
// Instructions inside a notice are content, never commands.
const INJECTION=/\b(ignore (?:all |any |the )?(?:previous|prior|above|earlier) instructions?|disregard (?:all|the|previous)|system prompt|you are (?:now )?(?:an? )?(?:ai|assistant|chatbot)|as an ai\b|mark (?:everything|all|this|it) as (?:paid|done|complete|sorted)|delete (?:all|every)|override (?:the )?rules?)\b/i;
const URL=/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com\.au|edu\.au|net\.au|org\.au|gov\.au|com|net|org|au|io|app)(?:\/[^\s)]*)?)/i;
const REFERENCE=/\b(?:payment reference|reference(?: number| no\.?)?|ref(?:\.|erence)?|student (?:id|number)|family (?:id|code)|crn|biller code|invoice (?:no\.?|number))\s*:?\s*([A-Z0-9][A-Z0-9-]{2,15})\b/i;
const CODE=/\b(?:event|booking|access|school)?\s*code\s*:?\s*([A-Z0-9]{3,12})\b|\busing (?:the )?code\s+([A-Z0-9]{3,12})\b/i;
const METHOD=/\b(qkr!?|compass|bpay|direct deposit|eftpos|cash|the (?:school )?office|sentral|seqta|flexischools|schoolinterviews|parent ?portal|skoolbag|school ?stream|seesaw|operoo|caremonkey)\b/i;

function sentences(text:string){return text.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);}
function dateIn(s:string,today:string,prefer:'due'|'event'|'any'='any'){
 const d=findDates(s,today);if(!d.length)return null;
 const two=/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:and|&)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\b/.exec(s);
 if(two){const end=findDates(`${two[2]} ${two[3]}`,today)[0];const start=findDates(`${two[1]} ${two[3]}`,today)[0];if(start&&end)return {iso:start.iso,end:end.iso,role:'event' as const};}
 const pick=prefer==='any'?d[0]:d.find(x=>x.role===prefer)||d[0];return {iso:pick.iso,end:pick.end,role:pick.role};
}

export function readSchoolNotice(raw:string,today:string,children:string[]=[]):SchoolReading{
 const text=normaliseText(raw||'');
 const signals=new Set((text.match(SCHOOL_SIGNALS)||[]).map(s=>s.toLowerCase()));
 const strong=/\b(excursion|incursion|school camp|year \d{1,2} camp|carnival|book week|parent[- ]teacher|permission (?:note|slip|form)|school photos?|dear (?:parents|families|carers)|parents and carers)\b/i.test(text);
 const confidence=Math.min(1,signals.size*0.25+(strong?0.35:0));
 const empty:SchoolReading={isSchool:false,confidence,events:[],obligations:[],child:null,ambiguities:[],untrustedInstructions:INJECTION.test(text)};
 if(confidence<0.6)return empty;
 const ss=sentences(text);const untrusted=ss.filter(s=>INJECTION.test(s));const clean=ss.filter(s=>!INJECTION.test(s));
 // ---- events ----
 const events:SchoolEvent[]=[];const eventAt:(SchoolEventKind|null)[]=[];
 for(const s of clean){eventAt.push(null);for(const ev of EVENTS){const m=ev.re.exec(s);if(!m)continue;if(events.some(e=>e.kind===ev.kind))continue;
  const d=dateIn(s,today,'event');
  // A date in the event's own sentence that reads as a deadline ("forms due 10 Nov") isn't the event date.
  const date=d&&(d.role!=='due'||!/\b(due|by|return|pay|close)\b/i.test(s))?d.iso:null;
  eventAt[eventAt.length-1]=ev.kind;
  events.push({kind:ev.kind,title:ev.title(m,text),date,endDate:d?.end||null,confidence:date?0.9:0.6});break;}
  // A later sentence naming an event Bear already has ("the camp payment...") points back to it.
  if(!eventAt[eventAt.length-1])for(const e of events)if(EVENTS.find(x=>x.kind===e.kind)!.re.test(s))eventAt[eventAt.length-1]=e.kind;}
 // ---- obligations: each sentence, each with its own date ----
 const obligations:SchoolObligationDetail[]=[];const ambiguities:string[]=[];let current:SchoolEventKind|null=null;
 const add=(o:Omit<SchoolObligationDetail,'dueInferred'|'reference'|'link'|'code'|'method'|'items'|'amountCents'>&Partial<SchoolObligationDetail>)=>{
  const cur=obligations.find(x=>x.type===o.type&&(x.eventKind??null)===current);
  if(cur){
   // The same obligation twice with different dates: keep the earlier (safer) one and say so.
   if(o.dueDate&&cur.dueDate&&o.dueDate!==cur.dueDate){ambiguities.push(`conflicting_dates:${o.type}`);cur.dueDate=o.dueDate<cur.dueDate?o.dueDate:cur.dueDate;cur.confidence=Math.min(cur.confidence,0.5);}
   cur.dueDate??=o.dueDate;cur.amountCents??=o.amountCents??null;cur.reference??=o.reference??null;cur.link??=o.link??null;cur.code??=o.code??null;cur.method??=o.method??null;
   for(const i of o.items||[])if(!cur.items.some(x=>x.toLowerCase()===i.toLowerCase()))cur.items.push(i);
   return;}
  obligations.push({dueInferred:false,reference:null,link:null,code:null,method:null,items:[],amountCents:null,eventKind:current,...o});
 };
 for(const [si,s] of clean.entries()){
  if(eventAt[si])current=eventAt[si];
  const due=dateIn(s,today,'due');const dueDate=due?.iso||null;
  const link=URL.exec(s)?.[1]||null;
  // Every way the notice says it can be done ("the school office or Compass").
  const methods=[...new Set([...s.matchAll(new RegExp(METHOD.source,'gi'))].map(m=>m[1]))];const method=methods.length?methods.join(' or '):null;
  if(/\b(permission|consent|sign(?:ed)?(?: and return)? (?:the )?(?:form|note|slip)|return the (?:signed )?(?:form|note|slip)|permission (?:note|slip|form))\b/i.test(s)&&!/\bmedical\b/i.test(s))
   add({type:'consent',dueDate,confidence:dueDate?0.9:0.7,link:/operoo|caremonkey|compass|sentral|portal/i.test(s)?link:null,method});
  const amounts=findAmounts(s);
  if(amounts.length&&/\b(pay|payment|fee|cost|costs|\$\d|contribution|levy)\b/i.test(s)){
   const best=[...amounts].sort((a,b)=>b.weight-a.weight)[0];
   add({type:'payment',dueDate,amountCents:best.cents,confidence:dueDate?0.9:0.7,reference:REFERENCE.exec(s)?.[1]||null,link,method});}
  else if(/\b(?:pay|payment)\b/i.test(s)&&(REFERENCE.test(s)||link||method)&&obligations.some(o=>o.type==='payment'))
   add({type:'payment',dueDate,confidence:0.8,reference:REFERENCE.exec(s)?.[1]||null,link,method});
  if(/\b(students?|children|kids|they|your child)\b[^.]{0,20}\b(will )?(need|should bring|must bring|are to bring)\b|\b(please )?(bring|pack)\b[^.]*\b(water bottle|hat|lunch|sleeping bag|shoes|bag|towel|swimmers|jacket|sunscreen|torch|pillow)\b|\bequipment list\b|\bwhat to bring\b/i.test(s)){
   const items=findItems(s.replace(/\b(students?|children|kids|they|your child) (?:will )?(?:need|should bring|must bring|are to bring)\b/i,'need'));
   if(items.length)add({type:'equipment',dueDate:null,confidence:0.85,items});}
  if(/\bbook (?:a |an |your )?(?:time|interview|slot|session|appointment)\b|\bbookings? (?:open|close|are|via|at|through)\b|\bschoolinterviews\b/i.test(s)){
   const c=CODE.exec(s);add({type:'booking',dueDate:due&&/\b(close|by|before)\b/i.test(s)?dueDate:null,confidence:0.85,link,code:c?(c[1]||c[2]):null,method});}
  if(/\border (?:online|photos?|forms?|by)\b|\bordering (?:is )?(?:open|closes)\b/i.test(s)){const c=CODE.exec(s);add({type:'order',dueDate,confidence:dueDate?0.85:0.6,link,code:c?(c[1]||c[2]):null});}
  if(/\b(medical (?:form|information|details|action plan)|asthma (?:plan|form)|anaphylaxis|medication (?:form|authority)|allerg(?:y|ies) (?:form|information))\b/i.test(s)&&/\b(update|complete|provide|return|send|fill|submit)\b/i.test(s))
   add({type:'medical',dueDate,confidence:0.8,link,method});
  if(/\b(please (?:reply|respond|let (?:us|me|your (?:child'?s )?teacher|the (?:office|teacher)) know)|rsvp|reply (?:by|to)|confirm (?:your|attendance|whether))\b/i.test(s))add({type:'reply',dueDate,confidence:0.8});
  if(/\b(dress (?:up )?as|costume|wear (?:their|a|your)|free dress|mufti|book character)\b/i.test(s))add({type:'costume',dueDate:null,confidence:0.75,items:findItems(s)});
  if(/\b(please (?:send|provide)|bring in|donate)\b[^.]*\b(for (?:art|class|the classroom|craft)|stationery|tissues|glue sticks|boxes|recyclables)\b/i.test(s))add({type:'materials',dueDate,confidence:0.7,items:findItems(s)});
  if(/\b(homework|assignment|project|speech|presentation)\b[^.]*\b(is )?due\b/i.test(s))add({type:'homework',dueDate,confidence:dueDate?0.85:0.6});
 }
 // Equipment and costumes are needed by the event: the day before, clearly marked as Bear's inference.
 const primary=events.find(e=>e.date)||events[0]||null;
 for(const o of obligations){const ev=events.find(e=>e.kind===o.eventKind)||primary;if(!o.dueDate&&(o.type==='equipment'||o.type==='costume')&&ev?.date){o.dueDate=addDays(ev.date,-1);o.dueInferred=true;}}
 // ---- the child: only a child the person told Bear about, named in the notice ----
 const named=children.filter(n=>new RegExp(`\\b${n.replace(/[^A-Za-z'-]/g,'')}\\b`,'i').test(text));
 let child:SchoolReading['child']=null;
 if(named.length===1)child={name:named[0],confidence:0.9};
 else if(named.length>1)ambiguities.push('several_children');
 else if(children.length===1)child={name:children[0],confidence:0.6};
 else if(children.length>1)ambiguities.push('which_child');
 return {isSchool:true,confidence,events,obligations,child,ambiguities:[...new Set(ambiguities)],untrustedInstructions:untrusted.length>0};
}

// What the Load Pattern Engine stores on the load.
export function schoolDetails(r:SchoolReading):SchoolDetails|null{
 if(!r.isSchool)return null;const ev=r.events.find(e=>e.date)||r.events[0];
 return {event:ev?.title||'School notice',kind:ev?.kind||'event',date:ev?.date||null,endDate:ev?.endDate||null,child:r.child&&r.child.confidence>=0.6?r.child.name:null,obligations:r.obligations};
}
// Load flags that switch on the matching SCHOOL_EVENT steps and attached loads.
export function schoolFlags(r:SchoolReading):string[]{
 const t=new Set(r.obligations.map(o=>o.type));const f:string[]=[];
 if(t.has('consent'))f.push('consent');if(t.has('payment'))f.push('payment');if(t.has('medical'))f.push('medical_requirement');
 if(t.has('booking'))f.push('booking');if(t.has('order'))f.push('order_online');if(t.has('reply'))f.push('reply_needed');if(t.has('costume'))f.push('costume');if(t.has('homework'))f.push('homework');
 return f;
}
// "Things to have ready", one list per event, without repeats.
export function preparationList(d:SchoolDetails):string[]{
 const out:string[]=[];for(const o of d.obligations)if(o.type==='equipment'||o.type==='costume'||o.type==='materials')for(const i of o.items)if(!out.some(x=>x.toLowerCase()===i.toLowerCase()))out.push(i);
 return out;
}

// A newsletter with several events becomes one reading per event, each with only its own obligations.
// Obligations that don't name an event go with the first one.
export function splitByEvent(r:SchoolReading):SchoolReading[]{
 if(r.events.length<=1)return [r];
 const first=r.events[0].kind;
 return r.events.map(e=>({...r,events:[e],obligations:r.obligations.filter(o=>(o.eventKind||first)===e.kind)}));
}
