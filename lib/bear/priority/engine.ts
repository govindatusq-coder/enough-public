import {addDays,daysBetween} from '../domain/dates.ts';
import type {PatternId} from '../load/types.ts';
import {importancePrior} from './importance.ts';
import {friendlyDate} from '../load/words.ts';
import type {Gate,PriorityContext,PriorityExplanation,PriorityInput,PriorityResult,PriorityVector,Reason,TimingLabel,ValueArea} from './types.ts';

// The Priority Engine. An inspectable pipeline of named rules, not a weighted sum:
//  1. ownership first: no remaining human action → never in the person's queue;
//  2. gates: safety, non-negotiables and overdue set a floor, they are not averaged away;
//  3. WHY → importance (consequence, values, goals, responsibilities, the person's own say);
//  4. WHEN → latest safe action, latest comfortable action, future pressure, dependency leverage;
//  5. HOW → effort, aversion, capacity, strengths (shape support and timing, never importance);
//  6. global priority (does this matter overall?) vs action priority (is now the moment?).
// Numbers are internal and uncalibrated; explanations are what people see.

const clamp=(n:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
const days=(from:string,to:string|null)=>to?daysBetween(from,to)??0:null;

// ---------- WHY ----------
const NON_NEGOTIABLE=/\b(registration|rego|licen[cs]e|passport|working with children|wwcc|visa|insurance|practising certificate|first aid cert|tax return|fines?|court|legal)\b/i;
const patternValues:Record<PatternId,ValueArea[]>={BILL_PAYMENT:['financial_security','home'],SCHOOL_EVENT:['parenting','family'],APPOINTMENT:['health'],FORM_APPLICATION:['independence'],REPAIR_PROBLEM:['home'],WAITING_FOR_RESPONSE:[],PURCHASE_REQUIRED:['home'],RENEWAL:['independence','financial_security'],INVITATION_EVENT:['relationships','enjoyment'],REPLENISHMENT:['home','health'],UNKNOWN_LOAD:[]};
const areaValues:Record<string,ValueArea[]>={work:['career'],family:['family','parenting'],home:['home'],money:['financial_security'],health:['health'],me:['rest','health']};
export function consequenceOf(i:PriorityInput):number{
 const f=new Set(i.flags);const t=i.text;
 if(f.has('safety'))return 1;
 switch(i.pattern){
  case 'BILL_PAYMENT':return f.has('overdue')?0.8:0.6;
  case 'SCHOOL_EVENT':return f.has('consent')||f.has('payment')?0.65:0.55;
  case 'APPOINTMENT':return f.has('referral')||f.has('follow_up')?0.65:0.55;
  case 'FORM_APPLICATION':return f.has('application')||NON_NEGOTIABLE.test(t)?0.7:0.5;
  case 'REPAIR_PROBLEM':return f.has('urgent')?0.8:f.has('rental')||f.has('no_response')?0.55:0.45;
  case 'WAITING_FOR_RESPONSE':return f.has('no_response')?0.5:0.35;
  case 'PURCHASE_REQUIRED':return f.has('urgent')?0.6:f.has('gift')?0.45:0.35;
  case 'RENEWAL':return NON_NEGOTIABLE.test(t)?0.9:f.has('not_wanted')?0.3:0.55;
  case 'INVITATION_EVENT':return /\brsvp\b/i.test(t)||/\b(birthday party|wedding)\b/i.test(t)?0.5:0.35;
  case 'REPLENISHMENT':return f.has('medication')||f.has('essential')?0.85:0.3;
  default:return i.projectPriority==='now'?0.65:i.projectPriority==='soon'?0.5:i.projectPriority==='later'?0.35:0.3;
 }
}
export function gatesOf(i:PriorityInput,ctx:PriorityContext):Gate[]{
 const g:Gate[]=[];const f=new Set(i.flags);
 if(f.has('safety'))g.push('safety');
 if(NON_NEGOTIABLE.test(i.text)&&['RENEWAL','FORM_APPLICATION','BILL_PAYMENT'].includes(i.pattern))g.push('non_negotiable');
 if((i.pattern==='REPLENISHMENT'&&f.has('medication'))||ctx.values.goals.some(x=>x.kind==='non_negotiable'&&overlap(x.text,i.title)))g.push('non_negotiable');
 const due=i.human?.dueAt||i.deadline;if(i.human&&due&&due<ctx.today)g.push('overdue');
 return [...new Set(g)];
}
const STOP=new Set(['the','a','an','to','of','and','for','my','our','get','do','keep','have','more','with','in','on','at','is','be','time']);
const words=(s:string)=>s.toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>2&&!STOP.has(w));
const overlap=(a:string,b:string)=>{const A=new Set(words(a));return words(b).some(w=>A.has(w)||[...A].some(x=>x.length>4&&(w.startsWith(x.slice(0,5)))));};
function valueLinks(i:PriorityInput,ctx:PriorityContext){
 const keys=[...new Set([...patternValues[i.pattern],...(areaValues[i.area]||[])])];
 return ctx.values.values.filter(v=>keys.includes(v.key));
}
function goalLinks(i:PriorityInput,ctx:PriorityContext){return ctx.values.goals.filter(g=>overlap(g.text,i.title)||(g.area&&g.area===i.area&&g.kind!=='goal'));}
export function importanceOf(i:PriorityInput,ctx:PriorityContext){
 const consequence=consequenceOf(i);
 const vs=valueLinks(i,ctx);const valuesAlignment=vs.length?Math.max(...vs.map(v=>v.source==='user'?0.9:0.3+0.4*v.confidence)):0.2;
 const gs=goalLinks(i,ctx);const goalContribution=gs.length?Math.max(...gs.map(g=>g.kind==='non_negotiable'?1:g.kind==='responsibility'?0.8:0.7)):0;
 let importance=0.55*consequence+0.25*valuesAlignment+0.2*goalContribution;
 // Learned: things this person keeps telling Bear are "not actually important" count for less.
 const notImportant=ctx.learned[`not_important:${i.pattern}`]||0;importance-=Math.min(0.2,notImportant*0.07);
 // Non-negotiables (legal, safety, health-critical) are important by definition.
 if(gatesOf(i,ctx).some(g=>g==='non_negotiable'||g==='safety'))importance=Math.max(importance,0.65);
 // Hierarchy: an important project raises the prior of its tasks without making every task important;
 // Bear's bottom-up read of the project and a soft area prior count for less (confidence decays upward).
 const evidence:string[]=[];
 if(i.projectImportance){importance=0.5*importance+0.5*importancePrior[i.projectImportance];evidence.push(`project: ${i.projectImportance}`);}
 else if(i.projectInferred!=null){importance=0.8*importance+0.2*i.projectInferred;evidence.push('project (inferred)');}
 if(i.areaPrior!=null){importance+=0.05*(i.areaPrior-0.5);}
 if(i.role==='progress'&&!i.lowLeverage){importance+=0.06;evidence.push('moves a goal forward');}
 // Relational (gate 2, people) and power/loss/meaning: a small bounded lift from relational IMPORTANCE.
 // Pressure from others never adds here, and seniority alone adds nothing.
 if(i.relational?.lift){importance+=i.relational.lift;evidence.push('people and meaning');}
 if(i.lowLeverage){importance=Math.min(importance,0.4);evidence.push('small tidy-up work');}
 const inferredScore=clamp(importance);
 if(i.importanceOverride)importance=i.importanceOverride==='very'?0.95:i.importanceOverride==='nice'?0.6:0.2;
 if(i.projectPriority&&i.pattern==='UNKNOWN_LOAD'&&!i.importanceOverride)importance=Math.max(importance,consequence);
 // Confidence: a known deadline and known consequence are solid; a guessed personal value is not.
 const confidence=i.importanceOverride?1:clamp((i.deadline?0.35:0.1)+(i.flags.length?0.2:0)+(vs.some(v=>v.source==='user')||gs.length?0.25:0)+(i.pattern!=='UNKNOWN_LOAD'?0.15:0)+(i.projectPriority?0.15:0));
 if(vs.length)evidence.push(...vs.map(v=>`value: ${v.key}${v.source==='inferred'?' (guess)':''}`));if(gs.length)evidence.push(...gs.map(g=>`${g.kind}: ${g.text}`));
 return {importance:clamp(importance),consequence,valuesAlignment,goalContribution,values:vs,goals:gs,confidence,inferredScore,evidence};
}

// ---------- HOW ----------
const effortByKind:Record<string,number>={decision:2,confirmation:1,information:3,signature:5,payment:3,physical:20,approval:2};
export function effortMinutes(i:PriorityInput){
 if(!i.human)return 0;const t=`${i.human.label} ${i.title} ${i.text}`;
 if(/\b(review|comment on|feedback on)\b/i.test(t)&&!/\b(write|draft)\b/i.test(t))return 20;
 if(/\b(write|draft|grant|paper|article|chapter|report|thesis|tax return|review of)\b/i.test(t))return 60;
 if(/\b(pack|clean|tidy|declutter|organi[sz]e|shop|groceries)\b/i.test(t))return 30;
 if(/\b(review|comment on|feedback on|read through|mark)\b/i.test(t))return 20;
 if(/\b(call|ring|phone|book|email|reply|rsvp|let .* know|send|forward|share)\b/i.test(t))return 5;
 if(i.pattern==='RENEWAL'&&i.human.kind==='payment')return 10;
 return effortByKind[i.human.kind]??10;
}
const intrinsicAversion:Partial<Record<PatternId,number>>={FORM_APPLICATION:0.35,RENEWAL:0.35,BILL_PAYMENT:0.25,REPAIR_PROBLEM:0.3,APPOINTMENT:0.25};
export function aversionOf(i:PriorityInput,ctx:PriorityContext){
 const learned=Math.min(0.5,(ctx.learned[`postpone:${i.pattern}`]||0)*0.1+(ctx.learned[`avoid:${i.pattern}`]||0)*0.15);
 return clamp((intrinsicAversion[i.pattern]||0.15)+learned+Math.min(0.3,i.postpones*0.12)+(ctx.struggles.includes('putting_off')?0.1:0));
}
const strengthFit:Partial<Record<PatternId,string[]>>={BILL_PAYMENT:['Money'],FORM_APPLICATION:['Planning ahead','Getting things done'],RENEWAL:['Planning ahead'],REPAIR_PROBLEM:['Problem solving'],APPOINTMENT:['Looking after people','Routines'],SCHOOL_EVENT:['Looking after people','Planning ahead'],REPLENISHMENT:['Routines','Cooking']};
// A small, honest first step for hard-to-start things. Bear never claims work it hasn't done.
const firstSteps:Partial<Record<PatternId,string>>={RENEWAL:'Just find the renewal notice or login. That’s the hard part.',FORM_APPLICATION:'Just open the form and do the first section.',BILL_PAYMENT:'Just open your banking app. The amount and reference are below.',REPAIR_PROBLEM:'Just send one message to someone who can fix it.',APPOINTMENT:'Just look at the next two free times.',UNKNOWN_LOAD:'Just do the first five minutes.'};

// ---------- WHEN ----------
// Lead time someone else needs before the deadline (processing, delivery, booking, replies).
export function leadDaysOf(i:PriorityInput){
 const m=/\b(\d{1,2})[- ]?(day|week)s?\b[^.]{0,30}\b(process|processing|turnaround|response|to respond|to arrive|delivery|notice)\b|\b(process|processing|turnaround|delivery|takes?)\b[^.]{0,20}\b(\d{1,2})[- ]?(day|week)s?\b/i.exec(i.text);
 if(m){const n=+(m[1]||m[5]);const unit=(m[2]||m[6]).toLowerCase();return unit.startsWith('week')?n*7:n;}
 const f=new Set(i.flags);
 if(/passport/i.test(i.text))return 42;
 // A wrong bill or a payment plan needs a reply before the due date.
 if(i.pattern==='BILL_PAYMENT'&&(f.has('disputed')||f.has('duplicate')))return 7;
 if(i.pattern==='BILL_PAYMENT'&&f.has('insufficient'))return 3;
 if(i.pattern==='RENEWAL'&&f.has('prerequisite'))return 7;
 if(i.pattern==='APPOINTMENT'&&f.has('needs_booking'))return 14;
 if(i.pattern==='APPOINTMENT'&&f.has('referral'))return 10;
 if(i.pattern==='REPAIR_PROBLEM')return f.has('quote')?7:3;
 if(i.pattern==='PURCHASE_REQUIRED'&&!f.has('ordered'))return f.has('urgent')?0:5;
 if(i.pattern==='FORM_APPLICATION'&&f.has('documents'))return 5;
 return 0;
}
// Wording that implies a real deadline even without a date.
export function impliedDeadline(i:PriorityInput,today:string):string|null{
 const f=new Set(i.flags);const t=i.text;
 if(f.has('urgent')||f.has('safety')||f.has('no_response')||f.has('expired'))return today;
 if(i.pattern==='REPLENISHMENT'){if(/\b(ran out|run out|out of (?!stock)|we'?re out)\b/i.test(t))return today;if(f.has('medication'))return addDays(today,3);if(/\b(nearly|almost) out\b/i.test(t))return addDays(today,f.has('essential')?2:5);if(/\b(running (?:low|out)|low on)\b/i.test(t))return addDays(today,7);}
 return null;
}
export function timing(i:PriorityInput,ctx:PriorityContext,aversion:number,minutes:number){
 const due=i.human?.dueAt||i.deadline||impliedDeadline(i,ctx.today);const lead=leadDaysOf(i);
 if(!due)return {due:null,lead,safe:null,comfortable:null,congestion:0};
 // Forms, payments and signatures need a day to land; long work needs a day of its own.
 const handover=i.human&&['signature','payment','physical'].includes(i.human.kind)?1:0;
 const safe=addDays(due,-(lead+handover+(minutes>=45?1:0)));
 const congestion=ctx.otherDeadlines.filter(d=>{const n=daysBetween(safe,d);return n!==null&&Math.abs(n)<=2;}).length;
 const essential=i.flags.includes('medication')||i.flags.includes('essential')?1:0;
 const buffer=1+essential+(aversion>=0.6?2:aversion>=0.35?1:0)+(congestion>=2?1:0)+(i.postpones>=2?1:0)+(lead>0?Math.ceil(lead*0.25):0)+(ctx.struggles.includes('forget_until_urgent')?1:0)+(i.relational?.actEarlierDays||0);
 return {due,lead,safe,comfortable:addDays(safe,-buffer),congestion};
}

// ---------- the pipeline ----------
export function prioritise(i:PriorityInput,ctx:PriorityContext,at:string=ctx.today):PriorityResult{
 const today=at;const imp=importanceOf(i,ctx);const gates=gatesOf(i,{...ctx,today});
 const minutes=effortMinutes(i);const aversion=aversionOf(i,ctx);
 const t=timing(i,{...ctx,today},aversion,minutes);
 const toComfort=t.comfortable?days(today,t.comfortable)!:null;const toSafe=t.safe?days(today,t.safe)!:null;
 const deadlinePressure=toSafe===null?0:clamp(1-toSafe/14);
 // No deadline: important maintenance (the dentist) rises slowly with time and postponing, never to panic.
 const ageDays=Math.max(0,days(i.createdAt.slice(0,10),today)||0);
 const futureUrgency=toComfort===null?clamp((ageDays/90+i.postpones*0.08)*imp.importance,0,0.6):toComfort<=0?1:clamp(1/(1+toComfort/3));
 // Someone else meaningfully waiting on this counts like steps waiting on it.
 const dependencyLeverage=clamp(Math.max(i.dependents/4,i.relational?.waiting?i.relational.leverage:0));
 const waitingLeadTime=clamp(t.lead/14);
 const reversibility=i.human&&['payment','signature'].includes(i.human.kind)?0.4:0.8;
 const snoozed=!!i.snoozedUntil&&i.snoozedUntil>today;
 const fits=ctx.availableMinutes===null?1:minutes<=ctx.availableMinutes?1:minutes<=ctx.availableMinutes*2?0.5:0.15;
 const modeFit=ctx.dayMode==='chaos'?0.25:ctx.dayMode==='wiped'?0.55:ctx.dayMode==='full'?0.8:1;
 const currentCapacityFit=clamp(fits*modeFit);
 const currentOpportunity=toComfort===null?0.4:toComfort<=0?1:toComfort<=2?0.6:0.2;
 const capabilityFit=(strengthFit[i.pattern]||[]).some(s=>ctx.strengths.includes(s))?0.9:0.5;
 const futurePressureRisk=clamp(0.35*futureUrgency+0.2*aversion+0.15*clamp(i.dependents/3)+0.15*clamp(t.congestion/2)+0.15*(t.lead>0?1:0));
 const carry=t.due?clamp((days(today,t.due)||0)/14):0.3;
 const pressurePreventionValue=i.human?clamp((0.35*carry+0.3*dependencyLeverage+0.35*futurePressureRisk)*(minutes<=10?1:minutes<=30?0.75:0.5)):0;
 const vector:PriorityVector={consequence:imp.consequence,valuesAlignment:imp.valuesAlignment,goalContribution:imp.goalContribution,deadlinePressure,futureUrgency,dependencyLeverage,waitingLeadTime,reversibility,currentOpportunity,currentCapacityFit,humanActionRequired:i.human?1:0,taskAversiveness:aversion,expectedEffort:clamp(minutes/60),capabilityFit,preferenceFit:0.5,confidence:imp.confidence};
 const tier=gates.includes('safety')?0:gates.includes('overdue')||(gates.includes('non_negotiable')&&toSafe!==null&&toSafe<=14)?1:2;
 const globalPriority=clamp(imp.importance*(0.6+0.4*Math.max(deadlinePressure,futureUrgency))+(tier===0?0.5:tier===1?0.2:0));
 // Action priority: only for what the person must do, and only when now is a good moment.
 const timingValue=gates.includes('overdue')?1.2:toComfort===null?0.25+futureUrgency*0.5:toComfort<=0?1:toComfort<=3?0.55:0.25;
 const uncertainty=1-imp.confidence;
 let actionPriority=!i.human||i.resolved||snoozed?0:imp.importance*timingValue*(0.6+0.4*dependencyLeverage)*currentCapacityFit*(0.6+0.4*pressurePreventionValue)*(1-0.15*uncertainty);
 if(tier===0&&i.human&&!i.resolved)actionPriority=Math.max(actionPriority,2);
 const importantEnough=imp.importance>=0.3||tier<=1;
 const due=t.due;
 // Checking that something happened, or packing for it, can't usefully be done before its moment.
 const notYet=!!i.human&&['confirmation','physical'].includes(i.human.kind)&&!!i.human.surfaceFrom&&i.human.surfaceFrom>today;
 // Quick win: a small decision, signature or piece of information other people are waiting on,
 // due within a week. Two minutes now saves days of carrying it.
 const toDue=t.due?days(today,t.due)!:null;
 // Someone is genuinely waiting, it's quick, and it matters enough: worth closing the loop.
 const closingLoop=!!i.relational?.waiting&&!!i.human&&minutes<=20&&imp.importance>=(i.relational.leverage>=0.6?0.33:0.4);
 const quickWin=!!i.human&&minutes<=5&&toDue!==null&&toDue>=0&&(['signature','decision','information','approval'].includes(i.human.kind)?toDue<=7:i.human.kind==='payment'?toDue<=2:false);
 const core=!!i.human&&!notYet&&!i.resolved&&!snoozed&&importantEnough&&(tier===0||(toComfort!==null&&toComfort<=0)||gates.includes('overdue')||quickWin||(toComfort===null&&futureUrgency>=0.45&&imp.importance>=0.6)||(actionPriority>=0.42&&minutes<=10&&pressurePreventionValue>=0.45)||closingLoop)&&(ctx.dayMode!=='chaos'||tier<=1||(toSafe!==null&&toSafe<=0));
 const surfaceNow=!i.quiet&&!i.queued&&core;
 const support=i.bearSupport==='more'||!!i.relational?.breakDown||(aversion>=0.5&&imp.importance>=0.45)?'prepare_more':'normal';
 const at7=(d:number)=>{if(d===0)return actionPriority;const later=addDays(today,d);const tc=t.comfortable?daysBetween(later,t.comfortable)!:null;const tv=tc===null?0.25:tc<=0?1:tc<=3?0.55:0.25;return i.human?imp.importance*tv:0;};
 const labelFor=(queued:boolean,surf:boolean):TimingLabel=>i.resolved?'Sorted':(!i.human||(notYet&&i.human.kind==='confirmation'))?(i.waitingOn?'Waiting':i.bearSteps?'Bear is handling it':'Nothing needed yet') :i.quiet?'Later is fine':queued?'Coming up':surf?'Worth doing now':snoozed?'Coming up':toComfort!==null&&toComfort<=7?'Good to do this week':toComfort!==null?'Coming up':imp.importance>=0.5?'Good to do this week':'Later is fine';
 const label=labelFor(!!i.queued,surfaceNow);const ownLabel=labelFor(false,!i.quiet&&core);
 const explanation=explain(i,imp,{gates,t,toComfort,minutes,dependencyLeverage,pressurePreventionValue,today,surfaceNow,due,support});
 const askImportance=!i.importanceOverride&&imp.confidence<0.45&&!!i.human&&(ctx.learned[`chose_low:${i.pattern}`]||0)>=2;
 const importanceSignal={explicit:i.importanceOverride||null,inferredScore:imp.inferredScore,inferredConfidence:i.importanceOverride?imp.confidence:imp.confidence*(i.projectImportance?1:0.8),evidence:imp.evidence};
 return {relationalStatus:i.relational?.status&&i.human?i.relational.status:null,ownLabel,importanceSignal,role:i.role||null,id:i.id,vector,gates,tier,latestSafeActionAt:t.safe,latestComfortableActionAt:t.comfortable,futurePressureRisk,pressurePreventionValue,dependencyLeverage,importance:imp.importance,globalPriority,actionPriority,trajectory:{today:actionPriority,in7:at7(7),in14:at7(14)},surfaceNow,support,action:i.human?.label||null,deadline:t.due,bearSteps:i.bearSteps,firstStep:support==='prepare_more'?firstSteps[i.pattern]||null:null,minutes,timingLabel:label,explanation,askImportance:askImportance||(!i.importanceOverride&&imp.confidence<0.35&&surfaceNow)};
}

const valueWords:Record<string,string>={family:'your family',relationships:'the people you care about',career:'your work',financial_security:'keeping money on track',health:'your health',home:'your home',learning:'learning',independence:'keeping life admin under control',community:'your community',rest:'rest',enjoyment:'enjoying life',creativity:'creativity',parenting:'your kids',caregiving:'caring for others'};
function explain(i:PriorityInput,imp:ReturnType<typeof importanceOf>,x:{gates:Gate[];t:ReturnType<typeof timing>;toComfort:number|null;minutes:number;dependencyLeverage:number;pressurePreventionValue:number;today:string;surfaceNow:boolean;due:string|null;support:string}):PriorityExplanation{
 const r:Reason[]=[];
 if(x.gates.includes('safety'))r.push({key:'safety',title:'Safety first',text:'This could be unsafe, so it comes before anything else.'});
 if(x.gates.includes('overdue'))r.push({key:'deadline',title:'Past its date',text:'It isn’t too late. Doing it now stops it growing.'});
 const g=imp.goals[0];const v=imp.values.sort((a,b)=>(b.source==='user'?1:0)-(a.source==='user'?1:0))[0];
 if(g)r.push({key:'matters',title:'Matters to you',text:g.kind==='non_negotiable'?`You said ${g.text.toLowerCase()} can’t slip.`:`Supports your ${g.kind==='goal'?'goal':'responsibility'}: ${g.text.toLowerCase()}.`});
 else if(x.gates.includes('non_negotiable'))r.push({key:'matters',title:'Matters a lot',text:'Letting this lapse has real consequences.'});
 else if(v&&imp.importance>=0.5)r.push({key:'matters',title:'Matters to you',text:`Supports ${valueWords[v.key]||v.key}.`});
 if(x.t.lead>0&&x.due)r.push({key:'lead',title:'Needs a head start',text:`Someone else needs about ${x.t.lead>=7?Math.round(x.t.lead/7)+' week'+(x.t.lead>=14?'s':''):x.t.lead+' days'} before ${friendlyDate(x.due,x.today)}.`});
 if(x.due&&x.toComfort!==null&&x.toComfort<=0&&!x.gates.includes('overdue'))r.push({key:'pressure',title:'Prevents future pressure',text:`Doing it now avoids a last-minute rush before ${friendlyDate(x.due,x.today)}.`});
 if(x.dependencyLeverage>=0.25)r.push({key:'depends',title:'Other things depend on this',text:'Once it’s done, the next steps can happen.'});
 if(i.human&&x.minutes<=10)r.push({key:'window',title:'A quick one',text:`About ${x.minutes} minute${x.minutes===1?'':'s'} for you.`});
 // Relational reasons, in plain words, slot in after safety and deadlines.
 const rel=(i.relational?.reasons||[]);r.splice(x.gates.length?1:0,0,...rel.slice(0,2));
 if(i.bearSteps>0)r.push({key:'bear',title:'Bear has the rest',text:'Bear keeps the dates, brings it back and follows up, so you only do this bit.'});
 const top=r.slice(0,i.relational?.reasons.length?4:3);
 const urgent=x.gates.length>0||(x.due&&x.t.safe&&x.t.safe<=x.today);
 const headline=urgent?'This is the one that can’t wait.':x.surfaceNow?'It isn’t the most urgent thing. But now is a good time to do it.':'Nothing to do yet. Bear will bring it back at a good time.';
 return {primaryReason:top[0]?.text||'Bear is keeping track of this.',contributingReasons:top.slice(1).map(x=>x.text),timingReason:x.t.comfortable?`Good time to act: by ${friendlyDate(x.t.comfortable,x.today)}`:undefined,goalLinks:imp.goals.map(g=>g.text),valueLinks:imp.values.map(v=>v.key),dependencyReason:x.dependencyLeverage>=0.25?'Other steps wait on this.':undefined,pressurePreventionReason:x.pressurePreventionValue>=0.45?'A small action now saves carrying it for days.':undefined,confidence:imp.confidence,headline,reasons:top,shortReason:top[0]?.title||null};
}

// One thing, or nothing. Safety and real deadlines first; then the best moment, not the nearest date.
export function selectAction(results:PriorityResult[]){
 const c=results.filter(r=>r.surfaceNow).sort((a,b)=>a.tier-b.tier||b.actionPriority-a.actionPriority||b.importance-a.importance||(a.latestSafeActionAt||'9999').localeCompare(b.latestSafeActionAt||'9999'));
 return {top:c[0]||null,needs:c.length,ranked:c};
}
