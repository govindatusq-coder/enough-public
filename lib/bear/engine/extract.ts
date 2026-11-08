import {addDays} from '../domain/dates.ts';
import {readSchoolNotice,splitByEvent,type SchoolReading} from '../coverage/packs/school.ts';
import {extractEntities,findDates,normaliseText} from '../load/extract.ts';
import {buildGraph,deriveTitle} from '../load/graph.ts';
import {patterns} from '../load/patterns.ts';
import {recognise} from '../load/recognise.ts';
import type {PatternId} from '../load/types.ts';
import type {EvidenceReference,ExtractedResponsibility,FactBasis,ResponsibilityExtraction} from './types.ts';

// CAPTURE → INTERPRET. Turns messy text (typed, pasted, transcribed, forwarded, or the text Bear read from a
// picture or PDF) into zero or more responsibilities, each fact traceable to the sentence it came from and
// labelled explicit, inferred or unknown. Deterministic: the same input always gives the same output.
// It never invents a deadline: an event date is not a due date, and vague timing ("end of term") stays unknown.
const INJECTION=/\b(ignore (?:all |any |the )?(?:previous|prior|above|earlier) instructions?|disregard (?:all|the|previous)|system prompt|you are (?:now )?(?:an? )?(?:ai|assistant|chatbot)|as an ai\b|mark (?:everything|all|this|it) as (?:paid|done|complete|sorted)|delete (?:all|every)|override (?:the )?rules?)\b/i;
const VAGUE=/\b(end of (?:term|the term|semester|year)|later this (?:month|term|year)|soon|in the coming weeks|at some point|early next (?:month|term)|sometime|tbc|tba|to be confirmed)\b/i;
// Purely informational: thanks, recaps and closures with nothing for the person to do.
const INFO_ONLY=/^(?:thank(?:s| you)|congratulations|well done|great (?:work|job)|a (?:big )?thank you|we (?:had|enjoyed)|it was (?:great|wonderful)|here (?:is|are) (?:some )?photos|just (?:a )?(?:note|fyi)|fyi\b)/i;
const ACTION=/\b(pay|payment|due|return|sign|submit|book|bring|pack|buy|order|renew|rsvp|reply|respond|call|email|send|fill|complete|lodge|collect|pick up|drop off|attend|confirm|update|fix|repair|replace|get|need(?:s)? to|please|must|required|remember|appointment|expires?|invoice|bill|running (?:low|out)|ran out|out of|waiting (?:to hear|for|on)|still waiting|expected by|hear back)\b/i;
const CLOSED=/\b(no action (?:is )?(?:required|needed)|nothing (?:you )?need to do|nothing to do yet|for your information only|already (?:been )?(?:paid|done|submitted|sorted)|has been cancelled|is cancelled|thank you for your payment|account is up to date|payment (?:has been )?received)\b/i;
const sentences=(t:string)=>t.split(/(?<=[.!?])\s+|\n+/).map(s=>s.trim()).filter(Boolean);
const excerptFor=(ss:string[],needle:RegExp|string)=>ss.find(s=>typeof needle==='string'?s.toLowerCase().includes(needle.toLowerCase()):needle.test(s))||null;

export interface ExtractOptions{sourceId?:string;sourceType?:ResponsibilityExtraction['sourceType'];today:string;children?:string[];now?:Date}

export function extractResponsibilities(raw:string,o:ExtractOptions):ResponsibilityExtraction{
 const sourceId=o.sourceId||'source';const at=(o.now||new Date()).toISOString();
 const text=normaliseText(raw||'');const all=sentences(text);
 const warnings:string[]=[];const injected=all.filter(s=>INJECTION.test(s));
 if(injected.length)warnings.push('ignored_instructions');
 const clean=all.filter(s=>!INJECTION.test(s));const body=clean.join('\n');
 const ref=(excerpt:string|null,location?:string):EvidenceReference[]=>excerpt?[{sourceId,excerpt:excerpt.slice(0,240),...(location?{location}:{})}]:[];
 if(!body.trim())return {sourceId,sourceType:o.sourceType||'text',responsibilities:[],extractionTimestamp:at,processingStatus:injected.length?'partial':'failed',warnings};
 // Nothing to do: informational only, or explicitly closed.
 if(CLOSED.test(body)&&!/\b(due|by|return|pay|book|bring)\b[^.]*\d/i.test(body))return {sourceId,sourceType:o.sourceType||'text',responsibilities:[],extractionTimestamp:at,processingStatus:'success',warnings};
 // School notices: one responsibility per obligation, grouped by event.
 const school=readSchoolNotice(body,o.today,o.children||[]);
 // A dated school event with nothing to do yet is still worth holding ("The excursion is next Tuesday"):
 // its date is explicit; any deadline stays unknown rather than guessed.
 if(school.isSchool&&!school.obligations.length){const ev=school.events.find(e=>e.date);
  if(ev&&ev.date!>=o.today)return {sourceId,sourceType:o.sourceType||'text',responsibilities:[{title:ev.title,domain:'kids',responsibilityPattern:'SCHOOL_EVENT',dueDate:null,dueDateBasis:'unknown',dueDateEvidence:null,eventDate:ev.date,eventDateBasis:'explicit',amountCents:null,responsiblePerson:school.child&&school.child.confidence>=0.6?school.child.name:null,requiredActions:[],dependencies:[],missingInformation:[],sourceEvidence:ref(excerptFor(clean,new RegExp(ev.kind==='excursion'?'excursion':ev.title.split(' ')[0],'i'))),confidence:0.8,requiresConfirmation:false,groupKey:`school:${ev.kind}:${ev.date}`}],extractionTimestamp:at,processingStatus:'success',warnings};}
 if(school.isSchool&&school.obligations.length){
  const out:ExtractedResponsibility[]=[];for(const part of splitByEvent(school))out.push(...fromSchool(part,clean,ref));
  return {sourceId,sourceType:o.sourceType||'text',responsibilities:out,extractionTimestamp:at,processingStatus:out.length?'success':'partial',warnings:[...warnings,...school.ambiguities.map(a=>`ambiguity:${a}`)]};
 }
 // Everything else: split into clauses that each carry an action, read each with the Load Pattern Engine.
 const chunks=clauses(clean);const out:ExtractedResponsibility[]=[];
 for(const chunk of chunks){const r=fromGeneric(chunk,o,ref);if(r&&!out.some(x=>sameResponsibility(x,r)))out.push(r);}
 return {sourceId,sourceType:o.sourceType||'text',responsibilities:out,extractionTimestamp:at,processingStatus:'success',warnings};
}

// Group sentences into clauses: a sentence with an action starts a clause; follow-on detail joins it.
function clauses(ss:string[]):string[]{
 const out:string[]=[];let cur:string[]=[];let context:string[]=[];
 const flush=()=>{if(cur.length)out.push(cur.join(' '));cur=[];};
 const JOB='(?:pay|book|renew|call|ring|email|buy|order|return|submit|reply|rsvp|fix|send|get|pick up|drop off)';
 for(const s of ss){
  if(INFO_ONLY.test(s)&&!ACTION.test(s)){flush();context=[];continue;}
  // "Pay the gas bill by Friday and book the dentist": two separate jobs in one sentence (but "sign and
  // return the form" stays one).
  const parts=s.split(new RegExp(String.raw`\s+(?:and also|also|and then|then|plus|and)\s+(?=${JOB}\b)`,'i')).filter((p,i,a)=>i===0||a[i-1].trim().split(/\s+/).length>=3);
  const pieces=parts.length>1&&parts.every(p=>p.trim().split(/\s+/).length>=2)?parts:[s];
  for(const p of pieces){
   const short=p.trim().split(/\s+/).length<=4&&!/\d|\$/.test(p);
   // A short follow-on ("Renew online.") belongs to the job before it.
   if(cur.length&&short){cur.push(p);continue;}
   if(ACTION.test(p)&&(cur.length===0||startsJob(p))){flush();cur.push(...context,p);context=[];}
   else if(cur.length)cur.push(p);
   else if(ACTION.test(p)){cur.push(...context,p);context=[];}
   // Context with no action yet ("Leaking tap in the bathroom.") waits for the job it explains.
   else context.push(p);
  }
 }
 flush();return out;
}
const startsJob=(s:string)=>/^(?:(?:also|and|then|plus),?\s+)?(?:please\s+)?(?:pay|book|renew|call|ring|email|buy|order|return|sign|submit|reply|rsvp|fix|send|get|pick up|drop off|remember|need to|don'?t forget|reminder)\b/i.test(s.trim())||/\b(bill|invoice|appointment|renewal|registration|rego|expires?)\b/i.test(s);
const tokens=(s:string)=>new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['the','and','for','you','your','due','with','this','that','please','from'].includes(w)));
export function sameResponsibility(a:ExtractedResponsibility,b:ExtractedResponsibility){
 if(a.responsibilityPattern!==b.responsibilityPattern)return false;const A=tokens(a.title),B=tokens(b.title);const inter=[...A].filter(x=>B.has(x)).length;
 return inter/Math.max(1,Math.min(A.size,B.size))>=0.6&&(a.dueDate||null)===(b.dueDate||null);
}

function fromGeneric(chunk:string,o:ExtractOptions,ref:(e:string|null,l?:string)=>EvidenceReference[]):ExtractedResponsibility|null{
 const e=extractEntities(chunk,o.today);const rec=recognise(chunk,e);
 let pattern:PatternId=rec.primary;
 // A clear but weak signal (one pattern scores, nothing else does) beats "unknown"; it is flagged to confirm.
 if(pattern==='UNKNOWN_LOAD'&&rec.ranked[0]?.score>0&&!(rec.ranked[1]?.score>0))pattern=rec.ranked[0].id;
 // Paying school fees or a levy is a payment, not a school event.
 if(pattern==='SCHOOL_EVENT'&&/\bpay\b/i.test(chunk)&&/\b(fees?|levy|levies|invoice|contribution)\b/i.test(chunk)&&!/\b(excursion|camp|carnival|incursion|photos?|interviews?|book week)\b/i.test(chunk))pattern='BILL_PAYMENT';
 // A document someone has to return or submit is a form, whatever it is called (an action plan, a note).
 if(pattern==='UNKNOWN_LOAD'&&/\b(return(?:ed)?|submit(?:ted)?|lodge[ds]?|sign(?:ed)?|fill(?:ed)? in)\b/i.test(chunk)&&/\b(plan|form|application|certificate|note|slip|declaration)\b/i.test(chunk))pattern='FORM_APPLICATION';
 const actionable=ACTION.test(chunk);
 if(pattern==='UNKNOWN_LOAD'&&!actionable)return null;
 if(!actionable&&!e.dueDate&&!e.amountCents)return null;
 const dates=findDates(chunk,o.today);const dues=dates.filter(d=>d.role==='due'||d.role==='expiry'||d.role==='rsvp');const ev=dates.find(d=>d.role==='event');
 // Two different deadlines for the same job: the earlier one is the safe choice, and Bear says it isn't sure.
 const conflicting=new Set(dues.map(d=>d.iso)).size>1;const due=conflicting?[...dues].sort((a,b)=>a.iso.localeCompare(b.iso))[0]:dues[0];
 const vague=VAGUE.exec(chunk);
 const dueDate=due?.iso||null;
 const dueBasis:FactBasis=dueDate?'explicit':'unknown';
 const g=buildGraph(rec,e,{text:chunk,today:o.today});
 const p=patterns[pattern];
 const missing=[...p.interpretation.requiredEntities.filter(k=>e[k]===null||e[k]===undefined||(Array.isArray(e[k])&&!(e[k] as unknown[]).length)).filter(k=>!(p.interpretation.waivers?.[k]||[]).some(f=>e.flags?.includes(f))).map(k=>({dueDate:'due date',eventDate:'date',amountCents:'amount',expiryDate:'expiry date',rsvpDate:'reply-by date'} as Record<string,string>)[k]||k)];
 if(vague&&!dueDate&&!missing.includes('due date'))missing.push('due date');
 const human=g.nodes.flatMap(n=>n.steps.filter(s=>s.owner==='human'&&s.status!=='skipped').map(s=>s.label));
 const deps=g.nodes.flatMap(n=>n.steps.filter(s=>s.dependsOn.length).map(s=>`${s.label} after ${s.dependsOn.map(id=>g.nodes.flatMap(x=>x.steps).find(x=>x.id===id)?.label).filter(Boolean).join(', ')}`));
 const confidence=Math.round((pattern==='UNKNOWN_LOAD'?0.5:pattern!==rec.primary?0.55:Math.max(0.55,rec.confidence))*(missing.length?0.85:1)*(conflicting?0.7:1)*100)/100;
 return {title:deriveTitle(pattern,chunk,e,null),description:chunk.slice(0,1000),domain:p.domain,responsibilityPattern:pattern,
  dueDate,dueDateBasis:dueBasis,dueDateEvidence:due?.text?excerptFor([chunk],due.text):(vague?vague[0]:null),
  eventDate:ev?.iso||null,eventDateBasis:ev?'explicit':'unknown',amountCents:e.amountCents??null,responsiblePerson:e.person||null,
  requiredActions:human.slice(0,6),dependencies:deps.slice(0,6),missingInformation:missing,sourceEvidence:ref(chunk),confidence,
  requiresConfirmation:confidence<0.6||(!!vague&&!dueDate)||conflicting,groupKey:null};
}

const OBL_TITLE:Record<string,(ev:string)=>string>={consent:e=>e?`Return ${e} permission form`:'Return the permission form',payment:e=>`Pay for ${e}`,equipment:e=>`Pack for ${e}`,booking:e=>`Book a time for ${e}`,order:e=>`Order ${e}`,medical:e=>`Update medical details for ${e}`,reply:e=>`Reply to the school about ${e}`,costume:e=>`Sort a costume for ${e}`,materials:e=>`Send materials for ${e}`,homework:e=>`Homework due for ${e}`};
const OBL_PATTERN:Record<string,PatternId>={consent:'FORM_APPLICATION',payment:'BILL_PAYMENT',equipment:'SCHOOL_EVENT',booking:'APPOINTMENT',order:'PURCHASE_REQUIRED',medical:'FORM_APPLICATION',reply:'WAITING_FOR_RESPONSE',costume:'PURCHASE_REQUIRED',materials:'PURCHASE_REQUIRED',homework:'SCHOOL_EVENT'};
function fromSchool(r:SchoolReading,ss:string[],ref:(e:string|null,l?:string)=>EvidenceReference[]):ExtractedResponsibility[]{
 const ev=r.events[0];const name=ev?ev.title.replace(/^([A-Z])/,c=>/^(Year|School|Parent|Book|Excursion)/.test(ev.title)?c:c.toLowerCase()):'';
 const key=`school:${ev?.kind||'event'}:${ev?.date||'undated'}`;
 return r.obligations.map(o=>{
  const sentence=excerptFor(ss,o.type==='consent'?/permission|consent|sign/i:o.type==='payment'?/\$|pay|fee|cost/i:o.type==='booking'?/book/i:o.type==='order'?/order/i:o.type==='medical'?/medical/i:o.type==='reply'?/reply|respond|rsvp|let .* know/i:o.type==='costume'?/dress|costume|wear/i:o.type==='homework'?/homework|project|assignment/i:/bring|need|pack/i);
  const basis:FactBasis=o.dueDate?(o.dueInferred?'inferred':'explicit'):'unknown';
  const vague=VAGUE.test(ss.join(' '));
  const missing=[...(!o.dueDate?['due date']:[]),...(o.type==='payment'&&!o.amountCents?['amount']:[]),...(r.ambiguities.includes('which_child')?['which child']:[])];
  return {title:OBL_TITLE[o.type](name),domain:'kids',responsibilityPattern:OBL_PATTERN[o.type],
   dueDate:o.dueDate,dueDateBasis:basis,dueDateEvidence:basis==='inferred'?`The day before ${name} (${ev?.date||'date unknown'})`:sentence,
   eventDate:ev?.date||null,eventDateBasis:ev?.date?'explicit':'unknown',amountCents:o.amountCents,responsiblePerson:r.child?.confidence&&r.child.confidence>=0.6?r.child.name:null,
   requiredActions:[OBL_TITLE[o.type](name)],dependencies:o.type==='equipment'&&ev?.date?[`Before ${name} on ${ev.date}`]:[],missingInformation:missing,
   sourceEvidence:ref(sentence),confidence:Math.round(o.confidence*100)/100,requiresConfirmation:o.confidence<0.6||(!o.dueDate&&vague)||r.ambiguities.some(a=>a.startsWith('conflicting_dates')),groupKey:key};
 });
}
// Re-export for tests that check the event-vs-deadline rule.
export const _internal={clauses,VAGUE,addDays};
