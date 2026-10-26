import {z} from 'zod';
import {momentLabels,type LifeMap,type RecurringMoment,type Friction,type FittingProfile} from './life-map.ts';
import {opportunityById,extraFor,type MovementOpportunity} from './opportunities.ts';

/**
 * The Goal-Fitting Engine (System B). It starts after "I'd do that" and works
 * out the lowest-burden realistic version of an idea the person already
 * chose. It never changes which idea was suggested, its wording or its
 * numbers: it keeps a snapshot of the original suggestion and builds a
 * separate, adaptive commitment around it.
 */

export const frequencyIntents=['usually','sometimes','once'] as const;
export type FrequencyIntent=typeof frequencyIntents[number];
export type DemandSensitivity='low'|'medium'|'high';
export const commitmentStatuses=['learning','active','paused','retired'] as const;
export type CommitmentStatus=typeof commitmentStatuses[number];
/** How often Enough may bring it up: when it looks like a decent fit, now and then, or never (the person brings it up). */
export const inviteModes=['fit','rarely','never'] as const;
export type InviteMode=typeof inviteModes[number];

type Version={minutes?:number;description:string};
export interface AdaptiveMovementCommitment{
 id:string;
 originalSuggestionId:string;
 /** What Enough suggested at the time. Never rewritten, even if the suggestion system changes later. */
 originalSuggestionSnapshot:{title:string;description:string;movementMinutes?:number;extraMinutes?:number;imageReference?:string};
 frequencyIntent:FrequencyIntent;
 anchor?:{type:string;description:string};
 minimumVersion?:Version;
 usualVersion?:Version;
 optionalExpansion?:Version;
 fallbackOptions?:string[];
 feasibilityConditions?:string[];
 abortConditions?:string[];
 demandSensitivity?:DemandSensitivity;
 status:CommitmentStatus;
 createdAt:string;
 updatedAt:string;
 invite:InviteMode;
 /** The "You said you'd do it" moment recorded by the suggestion system when the person tapped "I'd do that". */
 plannedMomentId?:string;
 /** Answers that apply to this activity only, such as whether the camera can be off. */
 answers?:Record<string,string>;
 /** What Enough has changed and why, newest last. The usual only goes up when the person says so. */
 adaptations?:{at:string;kind:'usual-down'|'usual-up'|'less-often'|'person-changed';from?:number;to?:number;note:string}[];
};

const iso=z.string().datetime({offset:true});
const text=(max:number)=>z.string().trim().min(1).max(max);
const version=z.object({minutes:z.number().int().min(1).max(120).optional(),description:text(160)}).strict();
export const commitmentSchema=z.object({
 id:z.string().min(1).max(100),
 originalSuggestionId:z.string().min(1).max(60).refine(id=>!!opportunityById(id),'Unknown opportunity'),
 originalSuggestionSnapshot:z.object({title:text(120),description:text(400),movementMinutes:z.number().int().min(0).max(120).optional(),extraMinutes:z.number().int().min(0).max(60).optional(),imageReference:z.string().max(200).optional()}).strict(),
 frequencyIntent:z.enum(frequencyIntents),
 anchor:z.object({type:text(40),description:text(160)}).strict().optional(),
 minimumVersion:version.optional(),usualVersion:version.optional(),optionalExpansion:version.optional(),
 fallbackOptions:z.array(text(160)).max(6).optional(),
 feasibilityConditions:z.array(text(160)).max(8).optional(),
 abortConditions:z.array(text(160)).max(8).optional(),
 demandSensitivity:z.enum(['low','medium','high']).optional(),
 status:z.enum(commitmentStatuses),
 createdAt:iso,updatedAt:iso,
 invite:z.enum(inviteModes),
 plannedMomentId:z.string().min(1).max(100).optional(),
 answers:z.record(z.string().max(40),z.string().max(40)).refine(r=>Object.keys(r).length<=20,'Too many answers').optional(),
 adaptations:z.array(z.object({at:iso,kind:z.enum(['usual-down','usual-up','less-often','person-changed']),from:z.number().int().min(0).max(120).optional(),to:z.number().int().min(0).max(120).optional(),note:text(200)}).strict()).max(40).optional()
}).strict();
export const MAX_COMMITMENTS=60;

// ── Reading the Life Map ────────────────────────────────────────────────────
const fittingOf=(map?:LifeMap):FittingProfile=>map?.fitting||{};
const hasFriction=(map:LifeMap|undefined,...f:Friction[])=>f.some(x=>(fittingOf(map).friction||[]).includes(x));

/** How strongly goals and nudges feel like pressure to this person. Unknown means medium. */
export function demandSensitivity(map?:LifeMap):DemandSensitivity{
 const f=fittingOf(map);
 if(f.goalFeel==='resist'||f.goalFeel==='told-what-to-do'||f.suggestStyle==='low-pressure')return 'high';
 if(f.goalFeel==='helpful'&&(f.suggestStyle==='commit'||f.suggestStyle===undefined))return 'low';
 if(f.suggestStyle==='commit'&&f.goalFeel!=='depends')return 'low';
 return 'medium';
}
/** Competing demands: time, caring, unpredictable work. Counted, never scored or shown. */
export function loadSignals(map?:LifeMap){
 const f=fittingOf(map);
 return (hasFriction(map,'time')?1:0)+(hasFriction(map,'childcare')?1:0)+(hasFriction(map,'unpredictable-work')||f.workPattern==='shifts'?1:0)+(map?.contexts.includes('kids')?1:0);
}
/** Fatigue, pain or a walk that is only comfortable on good days. */
export function physicalLimits(map?:LifeMap){
 const comfort=map?.profiling['walk-ten-comfortable']??fittingOf(map).answers?.['walk-comfort'];
 return hasFriction(map,'pain','fatigue')||comfort==='good-days'||comfort==='no';
}

// ── Questions worth asking (at most one) ────────────────────────────────────
export type FittingQuestion={id:string;text:string;options:{id:string;label:string}[];/** Where the answer lives: this commitment only, or the person's goal-fitting profile. */scope:'commitment'|'profile';applies:(o:MovementOpportunity,map:LifeMap)=>boolean;known:(map:LifeMap,answers:Record<string,string>)=>string|undefined};
const workMoments:RecurringMoment[]=['long-desk','lunch-break','listening-meeting','listening-call','public-transport'];
export const fittingQuestions:FittingQuestion[]=[
 {id:'camera-off',text:'Can you usually have your camera off during these meetings?',options:[{id:'yes',label:'Yes'},{id:'sometimes',label:'Sometimes'},{id:'no',label:'No'}],scope:'commitment',
  applies:o=>o.moments.includes('listening-meeting')&&o.movementTypes.some(t=>t==='wander'||t==='outside'),known:(m,a)=>a['camera-off']??m.fitting?.answers?.['camera-off']},
 {id:'kids-leave',text:'While they’re busy, can you usually leave the immediate area?',options:[{id:'usually',label:'Usually'},{id:'sometimes',label:'Sometimes'},{id:'no',label:'No'}],scope:'profile',
  applies:o=>o.requiresLeavingLocation&&o.moments.some(m=>m==='kid-activity-wait'||m==='kids-sport-watch'),known:m=>m.profiling['kids-leave-area']??m.fitting?.answers?.['kids-leave']},
 {id:'walk-comfort',text:'Is a ten-minute walk usually comfortable for you?',options:[{id:'yes',label:'Yes'},{id:'good-days',label:'On good days'},{id:'no',label:'Not really'}],scope:'profile',
  applies:(o,m)=>hasFriction(m,'pain','fatigue')&&o.maxMinutes>=10&&o.mobilityRequirements.some(r=>r==='walking'||r==='walking-10'),known:m=>m.profiling['walk-ten-comfortable']??m.fitting?.answers?.['walk-comfort']},
 {id:'work-pattern',text:'Are your work days fairly predictable?',options:[{id:'regular',label:'Mostly'},{id:'some-weeks',label:'Some weeks'},{id:'shifts',label:'Not really, or shifts'}],scope:'profile',
  applies:(o,m)=>o.moments.some(x=>workMoments.includes(x))&&hasFriction(m,'unpredictable-work'),known:m=>m.fitting?.workPattern}
];
/** The one question whose answer would materially change this commitment, or null. Nothing is asked for "Just today". */
export function fittingQuestion(o:MovementOpportunity,map:LifeMap,intent:FrequencyIntent,answers:Record<string,string>={}):FittingQuestion|null{
 if(intent==='once')return null;
 return fittingQuestions.find(q=>q.applies(o,map)&&q.known(map,answers)===undefined)||null;
}
/** Stores an answer where it belongs. Never touches `profiling`, so suggestions stay as they are. */
export function answerFittingQuestion(map:LifeMap,answers:Record<string,string>,id:string,answer:string):{map:LifeMap;answers:Record<string,string>}{
 const q=fittingQuestions.find(q=>q.id===id);if(!q||!q.options.some(o=>o.id===answer))return {map,answers};
 if(q.scope==='commitment')return {map,answers:{...answers,[id]:answer}};
 const fitting=fittingOf(map);
 if(id==='work-pattern')return {map:{...map,fitting:{...fitting,workPattern:answer as FittingProfile['workPattern']}},answers};
 return {map:{...map,fitting:{...fitting,answers:{...fitting.answers,[id]:answer}}},answers};
}

// ── Doses ───────────────────────────────────────────────────────────────────
const friendly=(n:number)=>n>=10?Math.round(n/5)*5:Math.max(1,Math.round(n));
const numberWords=['zero','one','two','three','four','five','six','seven','eight','nine','ten'];
export const minutesInWords=(n:number,capital=false)=>{const w=n<=10?numberWords[n]:String(n);return (capital?w.charAt(0).toUpperCase()+w.slice(1):w)+(n===1?' minute':' minutes');};
export const rangeLabel=(v?:Version)=>v?.minutes?`${v.minutes} min`:'';

const anchorLabels:Record<RecurringMoment,string>={
 'kid-activity-wait':'While the kids are at activities','school-run':'School drop-off or pickup','kids-outside':'When the kids are outside','kids-sport-watch':'Children’s sport',
 'short-car-trip':'Short trips you’d usually drive','listening-call':'Calls where you mostly listen','listening-meeting':'Listening meetings','personal-calls':'Catch-up calls',
 'long-desk':'Long stretches at your desk','lunch-break':'Lunch breaks','cooking-dinner':'While dinner cooks','watching-tv':'TV time','listening-podcasts':'Podcasts and music',
 chores:'Household jobs','grocery-shop':'The grocery shop','weekend-errands':'Weekend errands','takeaway-wait':'Waiting for takeaway','appointment-wait':'Waiting for appointments',
 coffee:'Coffee runs','meeting-friends':'Meeting friends','public-transport':'The bus or train home','arriving-early':'Arriving early','dog-walk':'The dog walk'
};
/** Moments that only make sense on working days or at weekends. Everything else can happen any day. */
export const weekdayMoments:RecurringMoment[]=['long-desk','lunch-break','listening-meeting','listening-call','school-run','public-transport'];
export const weekendMoments:RecurringMoment[]=['weekend-errands'];

const conditionsByMoment:Partial<Record<RecurringMoment,string[]>>={
 'listening-meeting':['You’re mostly listening','Your camera can be off'],'listening-call':['You’re mostly listening'],'personal-calls':['It’s a relaxed call'],
 'kid-activity-wait':['They’re settled and supervised'],'kids-sport-watch':['They’re settled and supervised'],'school-run':['There are a few minutes before the next thing'],
 'long-desk':['You can step away for a bit'],'lunch-break':['You get a proper break'],'cooking-dinner':['Something’s on that doesn’t need watching'],'watching-tv':['There’s a natural break'],
 'short-car-trip':['It’s close enough to walk'],'grocery-shop':['It’s a small shop'],'public-transport':['You’re not in a rush'],'arriving-early':['You’ve got a few spare minutes'],'dog-walk':['The dog’s up for it']
};
const abortsByMoment:Partial<Record<RecurringMoment,string[]>>={
 'listening-meeting':['You need to speak or present'],'listening-call':['You need to take notes or look at a screen'],
 'kid-activity-wait':['They need you nearby'],'kids-sport-watch':['They need you nearby'],'school-run':['You’re running late'],
 'short-car-trip':['You’re carrying something heavy'],'long-desk':['You’re in the middle of something'],'cooking-dinner':['It needs watching']
};
function fallbacksFor(o:MovementOpportunity,map:LifeMap):string[]{
 const walking=o.movementTypes.some(t=>t==='wander'||t==='outside'||t==='destination');
 const out=[];
 if(walking&&o.requiresLeavingLocation)out.push('Stand and pace for part of it');
 if(walking&&!hasFriction(map,'pain'))out.push('Walk to the end of the street and back');
 if(o.movementTypes.includes('useful'))out.push('Do one small part of it on your feet');
 out.push(hasFriction(map,'pain')?'Stand up and change position for a minute':'Stand up and stretch for a minute');
 return [...new Set(out)].slice(0,3);
}
function expansionFor(o:MovementOpportunity,map:LifeMap,usual:number):Version|undefined{
 if(o.maxMinutes<=usual||hasFriction(map,'pain'))return undefined;
 // A longer version of an idea whose extra time equals its movement time only suits people who said extra time is fine.
 if(o.extraScales&&map.extraTime==='none')return undefined;
 const t=o.movementTypes[0];
 const description=t==='wander'||t==='outside'?'Take the longer loop.':t==='destination'?'Go the long way round.':t==='useful'?'Keep going while you’re on a roll.':t==='people'?'Make it a longer one together.':t==='bursts'?'Do another round if you feel like it.':'Keep going if you want to.';
 return {minutes:o.maxMinutes,description};
}

export type FitInput={
 opportunityId:string;
 /** The suggestion exactly as it was shown when the person tapped "I'd do that". */
 snapshot:AdaptiveMovementCommitment['originalSuggestionSnapshot'];
 matchedMoment?:RecurringMoment;
 lifeMap:LifeMap;
 intent:Exclude<FrequencyIntent,'once'>;
 answers?:Record<string,string>;
 plannedMomentId?:string;
 id?:string;
 now?:Date;
};
/** Builds the lowest-burden realistic version of a chosen idea. Pure and deterministic. */
export function fitCommitment(input:FitInput):AdaptiveMovementCommitment{
 const o=opportunityById(input.opportunityId);if(!o)throw Error('Unknown opportunity');
 const map=input.lifeMap,answers=input.answers||{},now=(input.now||new Date()).toISOString();
 const suggested=input.snapshot.movementMinutes??o.minMinutes,extra=input.snapshot.extraMinutes??extraFor(o,suggested);
 const physical=physicalLimits(map),load=loadSignals(map);
 // The usual starts as the suggested minutes. It comes down only when the idea costs extra time for someone short of it, or when energy or pain says so.
 let usual=suggested;
 if(physical)usual=Math.max(o.minMinutes,friendly(suggested*0.6));
 else if(extra>0&&(load>=2||hasFriction(map,'time')))usual=Math.max(o.minMinutes,friendly(suggested-Math.min(extra,5)));
 usual=Math.min(usual,suggested);
 const minimum=usual>=10?(physical?3:5):usual>=5?2:1;
 const moment=input.matchedMoment&&o.moments.includes(input.matchedMoment)?input.matchedMoment:o.moments.find(m=>map.moments.includes(m))||o.moments[0];
 let intent:FrequencyIntent=input.intent;
 const conditions=[...(conditionsByMoment[moment]||[])];
 if(o.requiresLeavingLocation&&!conditions.some(c=>/step away|leave/.test(c)))conditions.push('You can step away for a bit');
 if(o.weatherDependent)conditions.push('The weather’s okay for it');
 const camera=answers['camera-off'],kids=map.profiling['kids-leave-area']??map.fitting?.answers?.['kids-leave'];
 // A "no" doesn't cancel the idea; it narrows it to the times it can work.
 if(camera==='no'||camera==='sometimes'){intent='sometimes';const i=conditions.indexOf('Your camera can be off');if(i>=0)conditions[i]='Only the meetings where the camera can be off';}
 if(kids==='no'||kids==='sometimes')intent='sometimes';
 const sensitivity=demandSensitivity(map);
 return {
  id:input.id||newId(),
  originalSuggestionId:o.id,
  originalSuggestionSnapshot:{...input.snapshot},
  frequencyIntent:intent,
  anchor:{type:moment,description:anchorLabels[moment]||momentLabels[moment]},
  minimumVersion:{minutes:minimum,description:minimum===1?'Even a minute counts.':`${minutesInWords(minimum,true)} is enough.`},
  usualVersion:{minutes:usual,description:`Around ${usual} minutes.`},
  optionalExpansion:expansionFor(o,map,usual),
  fallbackOptions:fallbacksFor(o,map),
  feasibilityConditions:conditions.slice(0,4),
  abortConditions:[...(abortsByMoment[moment]||[]),...(physical?['You’re sore or wiped out']:[])].slice(0,3),
  demandSensitivity:sensitivity,
  status:'learning',
  createdAt:now,updatedAt:now,
  invite:'fit',
  ...(input.plannedMomentId?{plannedMomentId:input.plannedMomentId}:{}),
  ...(Object.keys(answers).length?{answers}:{})
 };
}

/** The confirmation lines: "On a full-on day", "Usually", "If it feels good", in Enough's words. */
export function confirmationLines(c:AdaptiveMovementCommitment){
 return [
  c.minimumVersion&&{label:'On a full-on day',text:c.minimumVersion.description},
  c.usualVersion&&{label:c.frequencyIntent==='sometimes'?'When it lines up':'Usually',text:c.usualVersion.description},
  c.optionalExpansion&&{label:'If it feels good',text:c.optionalExpansion.description}
 ].filter(Boolean) as {label:string;text:string}[];
}
export function confirmationNote(c:AdaptiveMovementCommitment){
 if(c.invite==='never')return 'We won’t bring this up. It’s here for whenever you want it.';
 if(c.frequencyIntent==='sometimes'||c.invite==='rarely')return 'We’ll only bring this up now and then, when it looks like a decent fit.';
 return 'We’ll only bring this up when it looks like a decent fit.';
}
/** Usual-amount choices for "Change it": friendly numbers between the smallest useful version and the idea's own range. */
export function usualChoices(c:AdaptiveMovementCommitment){
 const o=opportunityById(c.originalSuggestionId);const max=o?.maxMinutes??30,min=Math.max(c.minimumVersion?.minutes??1,o?.minMinutes??1);
 return [...new Set([2,5,10,15,20,25,30,45,60].filter(n=>n>=min&&n<=max).concat(c.usualVersion?.minutes??[]))].sort((a,b)=>a-b);
}
/** The person's own change. Recorded as theirs, so learning never overrides it silently. */
export function changeCommitment(c:AdaptiveMovementCommitment,patch:{usual?:number;invite?:InviteMode;status?:CommitmentStatus},now=new Date()):AdaptiveMovementCommitment{
 const at=now.toISOString();let next={...c,updatedAt:at};
 if(patch.usual&&patch.usual!==c.usualVersion?.minutes){
  const usual=patch.usual,minimum=usual>=10?Math.min(c.minimumVersion?.minutes??5,5):usual>=5?2:1;
  next={...next,usualVersion:{minutes:usual,description:`Around ${usual} minutes.`},minimumVersion:{minutes:minimum,description:minimum===1?'Even a minute counts.':`${minutesInWords(minimum,true)} is enough.`},
   adaptations:[...(c.adaptations||[]),{at,kind:'person-changed' as const,from:c.usualVersion?.minutes,to:usual,note:`You set your usual to ${usual} minutes.`}].slice(-40)};
 }
 if(patch.invite)next={...next,invite:patch.invite};
 if(patch.status)next={...next,status:patch.status};
 return next;
}
export function upsertCommitment(list:AdaptiveMovementCommitment[]|undefined,c:AdaptiveMovementCommitment){
 const others=(list||[]).filter(x=>x.id!==c.id&&!(x.originalSuggestionId===c.originalSuggestionId&&x.status!=='retired'));
 return [...others,c].slice(-MAX_COMMITMENTS);
}
export const commitmentFor=(list:AdaptiveMovementCommitment[]|undefined,opportunityId:string)=>(list||[]).find(c=>c.originalSuggestionId===opportunityId&&c.status!=='retired');
export const liveCommitments=(list:AdaptiveMovementCommitment[]|undefined)=>(list||[]).filter(c=>c.status==='learning'||c.status==='active');

export const newId=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);
