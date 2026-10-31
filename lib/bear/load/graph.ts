import {addDays} from '../domain/dates.ts';
import {newId} from '../store/store.ts';
import {patterns} from './patterns.ts';
import type {Recognition} from './recognise.ts';
import type {LoadEntities,LoadGraph,LoadMap,LoadNode,LoadStep,PatternId,PatternStepTemplate} from './types.ts';
import {friendlyDate,friendlyRange,money} from './words.ts';
import {leadDays} from './loadmap.ts';

// Decomposition. Each recognised pattern becomes a node with its own internal steps,
// dependencies and closure; attached patterns hang off the primary (a LoadGraph).
// None of this is shown by default: the view picks out only what matters now.

const EVENT_WORDS=/\b((?:year \d+|kindy|prep|class|school|swimming|athletics|cross country|book week)?\s*(?:camp|excursion|incursion|carnival|sports day|disco|concert|fete|parade|photos?|assembly|party|wedding|dinner|bbq|barbecue|shower|reunion|lunch|celebration))\b/i;
export function deriveTitle(pattern:PatternId,text:string,e:LoadEntities,given?:string|null){
 // "Pay electricity bill" is the action; the load itself is the electricity bill.
 if(given&&given.trim())return pattern==='BILL_PAYMENT'?given.trim().replace(/^pay\s+(?:the\s+)?/i,'').replace(/^\w/,c=>c.toUpperCase()):given.trim();
 const first=text.trim().split(/\n/)[0].trim();
 const ev=EVENT_WORDS.exec(text);
 const cap=(s:string)=>s.trim().replace(/\s+/g,' ').replace(/^\w/,c=>c.toUpperCase());
 switch(pattern){
  case 'SCHOOL_EVENT':case 'INVITATION_EVENT':return ev?cap(ev[1].toLowerCase()).replace(/^Year (\d+)/i,'Year $1'):first.length<=48?cap(first):pattern==='SCHOOL_EVENT'?'School event':'Invitation';
  case 'BILL_PAYMENT':{const m=/\b(electricity|gas|water|internet|phone|mobile|council rates?|rates|strata|insurance|school fees?|childcare|rent|car (?:service|repair)|dentist|vet)\b/i.exec(text);return m?cap(m[1].toLowerCase())+' bill':e.provider?`${e.provider} bill`:'Bill';}
  case 'APPOINTMENT':{const m=/\b(dentist|doctor|gp|physio|optometrist|specialist|orthodontist|vet|haircut|scan|x-?ray|blood test|vaccination|check[- ]?up|parent[- ]teacher interview)\b/i.exec(text);const who=e.person?`${e.person}'s `:'';return m?cap(who+m[1].toLowerCase().replace(/^gp$/,'GP').replace(/^dr\b/,'Dr'))+(/(interview|scan|test|check)/i.test(m[1])?'':' appointment'):first.length<=48?cap(first):'Appointment';}
  case 'RENEWAL':{const m=/\b(car registration|registration|rego|driver'?s licen[cs]e|licen[cs]e|passport|membership|subscription|(?:car |home |contents |health |pet |travel )?insurance|working with children check|wwcc|first aid certificate|practising certificate)\b/i.exec(text);return m?cap(m[1].toLowerCase()):'Renewal';}
  case 'REPAIR_PROBLEM':{const m=/\b(tap|toilet|hot water(?: system)?|dishwasher|washing machine|fridge|oven|car|tyre|roof|gutter|fence|door|window|aircon|air conditioner|heater|lock|shower|sink|dryer|garage door|smoke alarm|power point|light)\b/i.exec(text);return m?cap(`fix the ${m[1].toLowerCase()}`):first.length<=48?cap(first):'Fix it';}
  case 'WAITING_FOR_RESPONSE':{const m=/\b(refund|quote|results?|delivery|parcel|claim|reply|application|response)\b/i.exec(text);return m?cap(m[1].toLowerCase()):'Waiting to hear back';}
  case 'PURCHASE_REQUIRED':return e.flags?.includes('gift')?`Present${e.person?' for '+e.person:''}`:e.items?.length?cap(e.items.slice(0,3).join(', ')):first.length<=48?cap(first):'Something to get';
  case 'REPLENISHMENT':return e.items?.length?cap(e.items.slice(0,3).join(', ')):first.length<=48?cap(first):'Restock';
  case 'FORM_APPLICATION':{const m=/\b(consent form|permission (?:note|slip|form)|tax return|enrolment form|application|claim form|form)\b/i.exec(text);return m?cap(m[1].toLowerCase()):'Form';}
  default:return first.length<=60?cap(first):cap(first.slice(0,57))+'…';
 }
}

// Entities for an attached load, taken from the parent's.
function childEntities(parent:LoadEntities,child:PatternId,parentPattern:PatternId):LoadEntities{
 const flags=parent.flags||[];
 switch(child){
  case 'FORM_APPLICATION':return {dueDate:parent.dueDate||(parent.eventDate?addDays(parent.eventDate,-7):null),flags:flags.filter(f=>['consent','signature','portal','documents','medical_requirement'].includes(f))};
  case 'BILL_PAYMENT':return {amountCents:parent.amountCents,dueDate:parent.dueDate||(parent.eventDate?addDays(parent.eventDate,-7):null),flags:[...flags.filter(f=>['autopay','instalment','shared','overdue'].includes(f)),'with_parent']};
  case 'PURCHASE_REQUIRED':return {items:parent.items,person:parent.person,eventDate:parent.eventDate,dueDate:parent.eventDate?addDays(parent.eventDate,parentPattern==='INVITATION_EVENT'?-1:-3):null,flags:flags.filter(f=>['gift','budget','urgent'].includes(f))};
  default:return {dueDate:parent.dueDate,flags:[]};
 }
}
const childTitle:Partial<Record<PatternId,(p:PatternId)=>string>>={FORM_APPLICATION:()=>'Consent',BILL_PAYMENT:()=>'Payment',PURCHASE_REQUIRED:p=>p==='INVITATION_EVENT'?'Present':'Things to buy'};

function fill(template:string,e:LoadEntities,title:string,today:string,text:string,who:string){
 const flags=e.flags||[];const due=friendlyDate(e.dueDate||e.rsvpDate||e.expiryDate,today);const by=due?` by ${due}`:'';
 const items=e.items?.length?e.items.slice(0,6).join(', '):'';
 const prereq=/\b(inspection|pink slip|safety check|eye test|medical certificate|cpd points?|medical)\b/i.exec(text)?.[1]?.toLowerCase()||'check';
 const parts:Record<string,string>={
  amount:money(e.amountCents)||'the amount due',due:due||'soon',date:due,title,item:e.items?.[0]||title.toLowerCase(),items:items||'what it needs',event:title.toLowerCase().startsWith('the ')?title:title,provider:e.provider||'them',person:e.person||'them',who,rsvp:friendlyDate(e.rsvpDate,today),rsvpBy:e.rsvpDate?` by ${friendlyDate(e.rsvpDate,today)}`:'',
  formLabel:flags.includes('consent')?`Consent is due ${due||'soon'}`:flags.includes('portal')?`Complete it on the portal${by}`:flags.includes('signature')?`Sign and send ${title.toLowerCase()}${by}`:`Complete and send ${title.toLowerCase()}${by}`,
  formCta:flags.includes('consent')?'Consent’s done':'Sent it',formDone:flags.includes('consent')?'Consent sorted.':'Sent. Off your mind.',
  contactLabel:flags.includes('rental')?'Let the property manager know':e.provider?`Contact the ${e.provider.toLowerCase().replace(/^dr /,'Dr ')}`:'Get someone in to look at it',
  buyLabel:flags.includes('gift')?`Choose and get a present${e.person?' for '+e.person:''}${by}`:items?`Get ${items}${by}`:`Get ${title.toLowerCase()}${by}`,
  keepLabel:flags.includes('price_increase')?'It’s going up in price. Renew, or let it go?':flags.includes('not_wanted')?`Do you still want ${title.toLowerCase()}?`:'Renew as it is, or shop around first?',
  renewLabel:flags.includes('expired')?`${title.replace(/^renew\s+/i,'').replace(/^\w/,c=>c.toUpperCase())} has expired. Renew it now`:/^renew\b/i.test(title)?`${title}${/\bby\b/i.test(title)?'':by}`:`Renew ${title.toLowerCase()}${by}`,
  prereq,getLabel:flags.includes('medication')?`Refill ${items||title.toLowerCase()}`:flags.includes('essential')||flags.includes('urgent')?`Get ${items||title.toLowerCase()} today`:`Add ${items||title.toLowerCase()} to the next shop`,
  range:friendlyRange(e.eventDate,e.eventEndDate,today),
 };
 return template.replace(/\{(\w+)\}/g,(_,k)=>parts[k]??'').replace(/\s+/g,' ').trim();
}

export function buildNode(pattern:PatternId,e:LoadEntities,opts:{title:string;text:string;today:string;role:'primary'|'attached';parentId:string|null;confidence:number;loadMap?:LoadMap|null;gate?:LoadNode['gate'];id?:string}):LoadNode{
 const p=patterns[pattern];const id=opts.id||newId();const keep=p.decomposition.steps.filter(t=>!t.when||t.when(e));const keys=new Set(keep.map(t=>t.key));
 const lead=leadDays(opts.loadMap);
 // People who forget until it's urgent get things back a little earlier, across every pattern.
 const earlier=(opts.loadMap?.cognitiveProfile?.remembering||0)>=5?2:0;
 const steps:LoadStep[]=keep.map((t:PatternStepTemplate)=>{
  const who=t.waitingFor?t.waitingFor(e):(e.provider||e.person||'them');
  let surfaceFrom=t.surfaceFrom?t.surfaceFrom(e,opts.today):null;
  // Learned lead time for bills replaces the default three days.
  if(pattern==='BILL_PAYMENT'&&t.key==='pay'&&e.dueDate&&!e.flags?.includes('overdue')&&!e.flags?.includes('with_parent'))surfaceFrom=addDays(e.dueDate,-lead);
  else if(surfaceFrom&&earlier&&surfaceFrom>opts.today&&surfaceFrom<'9999')surfaceFrom=addDays(surfaceFrom,-earlier)<opts.today?opts.today:addDays(surfaceFrom,-earlier);
  return {id:`${id}:${t.key}`,key:t.key,label:fill(t.label,e,opts.title,opts.today,opts.text,who),cta:t.cta?fill(t.cta,e,opts.title,opts.today,opts.text,who):null,operation:t.operation,owner:t.owner,human:t.human||null,
   dependsOn:(t.dependsOn||[]).filter(k=>keys.has(k)).map(k=>`${id}:${k}`),status:t.owner==='bear'&&t.operation==='understand'?'done':'pending',
   dueAt:t.due?t.due(e):null,surfaceFrom,waitingFor:t.waitingFor?who:null,evidence:t.evidence||null,degraded:null,
   choices:t.choices||null,doneText:t.doneText?fill(t.doneText,e,opts.title,opts.today,opts.text,who):null,requiresEvidence:t.requiresEvidence||null,skipIf:t.skipIf||[],
   labelIf:(t.labelIf||[]).map(l=>({evidence:l.evidence,label:fill(l.label,e,opts.title,opts.today,opts.text,who)}))};
 });
 // Missing information the pattern genuinely needs: one small question, not a questionnaire.
 for(const req of p.interpretation.requiredEntities){
  if(e[req]!==null&&e[req]!==undefined&&e[req]!=='')continue;
  if(p.interpretation.waivers?.[req]?.some(f=>e.flags?.includes(f)))continue;
  const q=req==='amountCents'?`How much is ${opts.title.toLowerCase()}?`:req==='dueDate'?`When is ${opts.title.toLowerCase()} due?`:req==='eventDate'?`When is ${opts.title.toLowerCase()}?`:req==='expiryDate'?`When does ${opts.title.toLowerCase()} expire?`:`What is ${req}?`;
  steps.unshift({id:`${id}:need_${req}`,key:`need_${req}`,label:q,cta:'Add it',operation:'understand',owner:'human',human:'information',dependsOn:[],status:'pending',dueAt:null,surfaceFrom:null,waitingFor:null,evidence:`known_${req}`,degraded:null,choices:null,doneText:'Thanks. Bear has it now.',requiresEvidence:null,skipIf:[],labelIf:[]});
 }
 const evidence=[] as LoadNode['evidence'];const at=new Date().toISOString();
 if(e.flags?.includes('cancelled'))evidence.push({key:'cancelled',at,source:'system'});
 if(e.flags?.includes('already_paid')&&pattern==='BILL_PAYMENT')evidence.push({key:'already_paid',at,source:'system'});
 if(e.flags?.includes('accept'))evidence.push({key:'going',at,source:'user'});
 if(e.flags?.includes('decline'))evidence.push({key:'declined',at,source:'user'});
 const clarification=pattern==='UNKNOWN_LOAD'?{question:'What would make this feel sorted?',choices:['Make a decision','Arrange something','Wait for someone','Get something done','Something else']}:null;
 return {id,pattern,role:opts.role,parentId:opts.parentId,title:opts.title,confidence:opts.confidence,entities:e,steps,state:'captured',waiting:null,evidence,resolvedAt:null,clarification,gate:opts.gate||null};
}

export function buildGraph(recognition:Recognition,e:LoadEntities,opts:{text:string;today:string;title?:string|null;loadMap?:LoadMap|null}):LoadGraph{
 const title=deriveTitle(recognition.primary,opts.text,e,opts.title);
 const primary=buildNode(recognition.primary,e,{title,text:opts.text,today:opts.today,role:'primary',parentId:null,confidence:recognition.confidence,loadMap:opts.loadMap});
 const nodes=[primary];
 for(const child of recognition.attached){
  const ce=childEntities(e,child,recognition.primary);
  const gate=recognition.primary==='INVITATION_EVENT'?{evidence:'going',notNeededIf:['declined','cancelled']}:{evidence:'',notNeededIf:['cancelled']};
  nodes.push(buildNode(child,ce,{title:childTitle[child]?.(recognition.primary)||patterns[child].name,text:opts.text,today:opts.today,role:'attached',parentId:primary.id,confidence:recognition.confidence,loadMap:opts.loadMap,gate}));
 }
 const at=new Date().toISOString();
 return {version:1,primaryId:primary.id,nodes,createdAt:at,updatedAt:at};
}
