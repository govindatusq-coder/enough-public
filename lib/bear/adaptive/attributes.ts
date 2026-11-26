// Adaptive Responsibility Engine: what a responsibility is, independent of which list she keeps it in.
// Derived from the task and Bear's plan for it (one record per responsibility, never duplicated), so it is always current.
// Each inferred field carries a confidence; unknown stays unknown rather than being invented.
import type {Task} from '../domain/types.ts';
import {daysBetween,addDays} from '../domain/dates.ts';
import {minutesFor,readinessOf,type Readiness} from '../board/logic.ts';
import {selectedPath,type Plan,type RStatus} from '../rre/plan.ts';
import {delegationEligible} from '../rre/share-pick.ts';
import type {Capability} from './capabilities.ts';

export const DOMAINS=['meals','cleaning_laundry','school_admin','childcare','child_health','wellbeing','work_admin','work_deliverables',
 'finances','home_maintenance','transport','shopping','family_coordination','adult_caregiving','pets','digital_admin','social',
 'travel','replenishment','personal_goals'] as const;
export type Domain=typeof DOMAINS[number]|'general';
export type Effort='low'|'medium'|'high'|'unknown';
export type ExecutionMode='human'|'agent_preparation'|'agent_execution'|'shared'|'delegated';
export type LabourWho='bear'|'you'|'someone_else'|'done'|'not_needed';
// Daminger's four components of cognitive labour, plus doing it and knowing it's closed: who still carries each.
export interface Labour{anticipation:LabourWho;identification:LabourWho;decision:LabourWho;execution:LabourWho;monitoring:LabourWho}
export interface Attributes{
 domain:Domain;pattern:string;contextTags:string[];
 dueAt:string|null;latestUsefulActionAt:string|null;
 humanMinutes:number;agentMinutes:number;cognitiveEffort:Effort;emotionalEffort:Effort;
 interruptibility:'low'|'medium'|'high';resumable:boolean;minimumUsefulWindow:number;
 requiresBusinessHours:boolean;locationRequirements:string[];
 readiness:Readiness;nextAction:string|null;missingInformation:string[];
 executionMode:ExecutionMode;agentPreparationAvailable:boolean;agentExecutionAvailable:boolean;delegationEligible:boolean;
 labour:Labour;confidence:Record<string,number>;
}

const DOMAIN_RULES:[Domain,RegExp][]=[
 ['school_admin',/\b(school|excursion|permission|newsletter|uniform|term|teacher|class|homework|canteen|book ?club|book week|crazy hair|sport day|carnival|enrol\w*)\b/i],
 ['child_health',/\b(paediatric\w*|pediatric\w*|immuni[sz]\w*|vaccin\w*|kids?'? (?:dentist|doctor|gp)|(?:dentist|doctor|gp) for the kids|orthodont\w*|asthma)\b/i],
 ['childcare',/\b(daycare|day care|childcare|babysit\w*|nanny|pick ?up|drop ?off|before school care|after school care|vacation care)\b/i],
 ['adult_caregiving',/\b(mum'?s|dad'?s|mother'?s|father'?s|nan|grandma|grandpa|aged care|carer|ndis)\b/i],
 ['pets',/\b(dog|cat|vet|flea|worming|pet|puppy|kitten|litter|kennel)\b/i],
 ['finances',/\b(bill|invoice|pay|tax|bank|budget|insurance|super|refund|rates|loan|mortgage|fees?|levy|levies)\b/i],
 ['travel',/\b(flight|passport|visa|hotel|holiday|trip|packing|airbnb|luggage)\b/i],
 ['transport',/\b(car|rego|registration|service the|tyre|tire|petrol|fuel|parking|opal|myki|license|licence)\b/i],
 ['home_maintenance',/\b(fix|repair|plumber|electrician|dishwasher|gutter\w*|leak|paint|garden|lawn|mow|hedge|fence|roof|filter|smoke alarm|handyman)\b/i],
 ['cleaning_laundry',/\b(clean|wash|laundry|iron\w*|vacuum|mop|tidy|declutter|dust\w*|sheets|towels|fold)\b/i],
 ['meals',/\b(dinners?|lunch(?:es)?|lunchbox(?:es)?|breakfasts?|meals?|cook\w*|recipes?|bak(?:e|ing)|batch|grocer(?:y|ies)|menus?|pantry|fridge|freezer|snacks?)\b/i],
 ['replenishment',/\b(toilet paper|milk|bread|nappies|nappy|diapers?|wipes|refill|restock\w*|run out|running low|staples|detergent|tablets|batteries|bin liners)\b/i],
 ['shopping',/\b(buy|order|get (?:a|an|some|the)|pick up a|scrunchie|present|gift|shop\w*)\b/i],
 ['social',/\b(birthday|party|rsvp|invite|catch up|wedding|anniversary|card for|thank[- ]you)\b/i],
 ['digital_admin',/\b(password|account|subscription|app|email inbox|photos|backup|login|update the|unsubscribe)\b/i],
 ['work_deliverables',/\b(report|presentation|deck|proposal|draft the|deadline at work|client|project)\b/i],
 ['work_admin',/\b(timesheet|expense|leave form|payroll|meeting|work email|roster|performance review)\b/i],
 ['wellbeing',/\b(my (?:doctor|gp|dentist|physio|psych\w*)|gym|walk|yoga|sleep|therap\w*|counsell\w*|massage|pap|mammogram|me time)\b/i],
 ['personal_goals',/\b(learn|course|one day|someday|goal|read more|start a|build a|renovat\w*)\b/i],
 ['family_coordination',/\b(family|schedule|calendar|roster|whose turn|carpool|organise the kids)\b/i],
];
const KIND_DOMAIN:Record<string,Domain>={acquire:'shopping',gifts:'social',appointment:'family_coordination',call:'family_coordination',form:'school_admin',bill:'finances',followup:'family_coordination',chore:'cleaning_laundry',aspiration:'personal_goals',general:'general'};
export function domainOf(text:string,kind:string):{domain:Domain;confidence:number}{
 for(const [d,re] of DOMAIN_RULES)if(re.test(text))return {domain:d,confidence:.7};
 return {domain:KIND_DOMAIN[kind]||'general',confidence:KIND_DOMAIN[kind]&&kind!=='general'?.4:.1};
}
const EMOTIONAL=/\b(funeral|sick|hospital|results|complain\w*|apolog\w*|sorry|dispute|conflict|divorce|custody|grief|bully\w*|overdue|debt|eviction)\b/i;
// Whether Bear's preparation would genuinely save her work (a draft, a shortlist, gift ideas, the payment details), rather
// than only noting it down (an errand she does in person).
const substantivePrep=(kind:string,method:string)=>['gifts','form','bill','appointment','call','followup'].includes(kind)||(kind==='acquire'&&method==='online');
const statusToReadiness=(s:RStatus,r:Readiness):Readiness=>s==='waiting'?'waiting':s==='completed'?'completed':s==='in_progress'||s==='awaiting_approval'?'in_progress':r;

export interface AttributeContext{status:RStatus;capabilities?:Capability[];anticipationBufferDays?:number}
export function attributesOf(t:Task,p:Plan,ctx:AttributeContext):Attributes{
 const path=selectedPath(p);const left=path.steps.slice(p.stepIndex);const text=`${t.title} ${t.sorted?.originalInput||''}`;
 const hers=left.filter(s=>s.who==='you'&&s.kind!=='wait');const bears=left.filter(s=>s.who==='bear');
 const {domain,confidence:dc}=domainOf(text,p.kind);
 const contexts=new Set(left.map(s=>s.context).filter(Boolean) as string[]);
 const requiresBusinessHours=contexts.has('phone')||(['appointment','call'].includes(p.kind)&&hers.some(s=>s.kind==='act'));
 const tags=[...contexts].filter(c=>c!=='any');if(requiresBusinessHours)tags.push('business_hours');
 if(left.some(s=>s.kind==='wait')||p.dependencies.some(d=>d.status==='open'))tags.push('waiting_on_others');
 if(['form','bill'].includes(p.kind))tags.push('needs_focus');
 const humanMinutes=hers.length?hers.reduce((a,s)=>a+s.userMinutes,0):(left.length?0:minutesFor(t));
 const agentMinutes=bears.length;
 const cognitiveEffort:Effort=p.kind==='aspiration'?'high':['form','bill','appointment','gifts'].includes(p.kind)?'medium':['chore','followup','call','acquire'].includes(p.kind)?'low':humanMinutes>=30?'high':humanMinutes>=10?'medium':'unknown';
 const emotionalEffort:Effort=EMOTIONAL.test(text)?'high':p.kind==='call'||p.kind==='followup'?'low':'unknown';
 const next=hers[0]||null;
 const interruptibility=next?.context==='phone'||p.kind==='call'?'low':humanMinutes<=5||hers.length>1?'high':['form','bill'].includes(p.kind)?'low':'medium';
 const resumable=hers.length>1||!!t.progress?.savedAt||left.length>1;
 const prepared=!!p.execution.prepared;
 const delegated=!!t.sharedOut&&t.sharedOut.mode==='transfer'||t.delegation?.status==='ACCEPTED';
 const executionMode:ExecutionMode=delegated?'delegated':bears.length&&!prepared?'agent_preparation':prepared&&hers.length?'shared':'human';
 const cal=ctx.capabilities?.find(c=>c.id==='create_calendar_event');
 const agentExecutionAvailable=!!cal?.available&&p.kind==='appointment'&&!!(t.dueAt||p.deadlines.outcome);
 const readiness=statusToReadiness(ctx.status,readinessOf(t));
 // Latest useful moment: the plan's action date (deadline minus lead time) less a small buffer for the unexpected.
 const buffer=ctx.anticipationBufferDays??1;
 const latest=p.deadlines.action?(p.deadlines.outcome&&p.deadlines.action<p.deadlines.outcome?addDays(p.deadlines.action,-Math.min(buffer,Math.max(0,(daysBetween(p.deadlines.action,p.deadlines.outcome)??0)))):p.deadlines.action):null;
 const missing=[...(t.readiness==='needs_info'?['details Bear needs to go on']:[]),...(p.deadlineSource===null&&['acquire','appointment','form','bill','gifts'].includes(p.kind)&&!t.dueAt?['when it’s needed by']:[])];
 const waitingOn=p.dependencies.some(d=>d.status==='open');
 const labour:Labour={
  anticipation:'bear',
  identification:p.pathways.length>1||prepared?'bear':bears.length?'bear':'you',
  decision:hers.some(s=>s.kind==='decide')||ctx.status==='awaiting_approval'?'you':'not_needed',
  execution:delegated?'someone_else':ctx.status==='completed'?'done':hers.some(s=>s.kind==='act')?'you':bears.length?'bear':'you',
  monitoring:waitingOn||left.some(s=>s.kind==='wait')||delegated?'bear':ctx.status==='completed'?'done':'not_needed',
 };
 return {domain,pattern:p.kind,contextTags:[...new Set(tags)],dueAt:t.dueAt||p.deadlines.outcome||null,latestUsefulActionAt:latest,
  humanMinutes,agentMinutes,cognitiveEffort,emotionalEffort,interruptibility,resumable,minimumUsefulWindow:(next?.userMinutes??humanMinutes)+1,
  requiresBusinessHours,locationRequirements:contexts.has('errand')?['out of the house']:[],readiness,nextAction:next?.text||null,missingInformation:missing,
  executionMode,agentPreparationAvailable:bears.length>0&&!prepared&&substantivePrep(p.kind,path.method),agentExecutionAvailable,delegationEligible:delegationEligible(t,p,ctx.status).ok,labour,
  confidence:{domain:dc,pattern:.6,humanMinutes:t.minutesBy==='you'?1:.4,cognitiveEffort:cognitiveEffort==='unknown'?0:.4,emotionalEffort:emotionalEffort==='unknown'?0:.5,interruptibility:.4,dueAt:t.dueAt?(p.deadlineSource==='stated'?.9:.6):0}};
}
