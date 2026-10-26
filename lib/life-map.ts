import {z} from 'zod';
import type {IllustrationCategory} from './illustrations.ts';

/**
 * The Life Map: an explicit, structured picture of the shape of someone's
 * week. Every answer here is a ranking or filtering signal for the
 * opportunity engine, except `fitting`, which only shapes follow-through.
 * Nothing is buried in free text or an AI conversation.
 *
 * Nothing here is "known context" about today. It describes what tends to
 * happen, so copy built from it must stay conditional ("next time…", "if…").
 */

// ── Screen 2: what fills your week ──────────────────────────────────────────
export const lifeContexts=['desk','driving','kids','home','errands','catchups','calls','commuting','pets','downtime'] as const;
export type LifeContext=typeof lifeContexts[number];
export const contextCards:Record<LifeContext,{title:string;text:string;image:IllustrationCategory}>={
 desk:{title:'Desk & work',text:'I spend a lot of time sitting for work.',image:'desk-work'},
 driving:{title:'Driving',text:'I’m in the car a lot.',image:'transport'},
 kids:{title:'Kids',text:'School runs, activities, appointments and general kid logistics.',image:'children-school'},
 home:{title:'Home',text:'I spend a fair bit of time at home.',image:'home'},
 errands:{title:'Errands',text:'Shopping, appointments and getting things done.',image:'errands'},
 catchups:{title:'Catch-ups',text:'Coffee, friends and family.',image:'social'},
 calls:{title:'Calls',text:'Phone calls or online meetings.',image:'phone-call'},
 commuting:{title:'Commuting',text:'Getting to and from work or study.',image:'commuting'},
 pets:{title:'Pets',text:'Looking after or walking animals.',image:'pets'},
 downtime:{title:'Downtime',text:'TV, scrolling, gaming or reading.',image:'television'}
};

// ── Screen 3: what happens a lot ────────────────────────────────────────────
export const recurringMoments=['kid-activity-wait','school-run','kids-outside','kids-sport-watch','short-car-trip','listening-call','listening-meeting','personal-calls','long-desk','lunch-break','cooking-dinner','watching-tv','listening-podcasts','chores','grocery-shop','weekend-errands','takeaway-wait','appointment-wait','coffee','meeting-friends','public-transport','arriving-early','dog-walk'] as const;
export type RecurringMoment=typeof recurringMoments[number];
export const momentLabels:Record<RecurringMoment,string>={
 'kid-activity-wait':'Waiting while kids do activities','school-run':'School drop-off or pickup','kids-outside':'Kids playing outside','kids-sport-watch':'Watching children’s sport',
 'short-car-trip':'Short car trips','listening-call':'Phone calls where I mostly listen','listening-meeting':'Online meetings where I mostly listen','personal-calls':'Catch-up calls with family or friends',
 'long-desk':'Long stretches at my desk','lunch-break':'Lunch breaks','cooking-dinner':'Making dinner','watching-tv':'Watching TV','listening-podcasts':'Podcasts, audiobooks or music',
 chores:'Household chores','grocery-shop':'Grocery shopping','weekend-errands':'Weekend errands','takeaway-wait':'Waiting for takeaway','appointment-wait':'Waiting for appointments',
 coffee:'Going for coffee','meeting-friends':'Meeting friends','public-transport':'Taking public transport','arriving-early':'Arriving somewhere early','dog-walk':'Walking the dog'
};
/** Which life contexts make a moment likely. Drives screen 3 ordering. */
export const momentContexts:Record<RecurringMoment,LifeContext[]>={
 'kid-activity-wait':['kids'],'school-run':['kids','driving'],'kids-outside':['kids','home'],'kids-sport-watch':['kids'],
 'short-car-trip':['driving','errands'],'listening-call':['calls','desk'],'listening-meeting':['desk','calls'],'personal-calls':['calls','catchups'],
 'long-desk':['desk'],'lunch-break':['desk','commuting'],'cooking-dinner':['home'],'watching-tv':['downtime','home'],'listening-podcasts':['downtime','commuting'],
 chores:['home'],'grocery-shop':['errands'],'weekend-errands':['errands','driving'],'takeaway-wait':['errands','home'],'appointment-wait':['errands','driving'],
 coffee:['catchups'],'meeting-friends':['catchups'],'public-transport':['commuting'],'arriving-early':['driving','commuting','kids'],'dog-walk':['pets']
};
/** Moments to show first on screen 3, most likely first. Unrelated moments come after, behind "Show more". */
export function suggestedMoments(contexts:readonly LifeContext[]):{likely:RecurringMoment[];other:RecurringMoment[]}{
 const score=(m:RecurringMoment)=>momentContexts[m].filter(c=>contexts.includes(c)).length*10-momentContexts[m].indexOf(momentContexts[m].find(c=>contexts.includes(c))!);
 const likely=recurringMoments.filter(m=>momentContexts[m].some(c=>contexts.includes(c))).sort((a,b)=>score(b)-score(a)||recurringMoments.indexOf(a)-recurringMoments.indexOf(b));
 const fallback:RecurringMoment[]=['listening-call','cooking-dinner','watching-tv','grocery-shop','coffee','arriving-early','long-desk','short-car-trip'];
 if(!likely.length)return {likely:fallback,other:recurringMoments.filter(m=>!fallback.includes(m))};
 return {likely,other:recurringMoments.filter(m=>!likely.includes(m))};
}

// ── Screen 4: where could movement sneak in ─────────────────────────────────
export const permissionLevels=['no','maybe','yes'] as const;
export type Permission=typeof permissionLevels[number];
export const scenarioIds=['kid-wait','school-run','listening-call','nearby-shop','desk','cooking','tv','coffee','early','transport','dog'] as const;
export type ScenarioId=typeof scenarioIds[number];
export type Scenario={id:ScenarioId;prompt:string;options:Record<Permission,string>;moments:RecurringMoment[]};
export const scenarios:Scenario[]=[
 {id:'kid-wait',prompt:'You’re waiting 30 minutes while your kid is at an activity.',options:{no:'Leave me alone',maybe:'I’d move if the idea was good',yes:'Definitely find me something'},moments:['kid-activity-wait','kids-sport-watch']},
 {id:'school-run',prompt:'It’s school drop-off and you’ve got a few minutes before the next thing.',options:{no:'Straight on to the next thing',maybe:'Some days',yes:'Find me something'},moments:['school-run','kids-outside']},
 {id:'listening-call',prompt:'You’re on a 15-minute call where you’re mostly listening.',options:{no:'I’d rather sit',maybe:'Maybe',yes:'Great opportunity'},moments:['listening-call','listening-meeting','personal-calls']},
 {id:'nearby-shop',prompt:'You need something from a shop that’s reasonably close.',options:{no:'I’m driving',maybe:'Depends',yes:'Suggest walking'},moments:['short-car-trip','grocery-shop','weekend-errands','takeaway-wait']},
 {id:'desk',prompt:'You’ve been at your desk for a couple of hours.',options:{no:'Leave me be',maybe:'A short break could work',yes:'Get me up'},moments:['long-desk','lunch-break']},
 {id:'cooking',prompt:'Dinner’s in the oven for twenty minutes.',options:{no:'I’ll sit down',maybe:'Maybe',yes:'Find me something useful'},moments:['cooking-dinner','chores']},
 {id:'tv',prompt:'You’re about to start another episode.',options:{no:'Don’t interrupt',maybe:'Between episodes, maybe',yes:'Sure, nudge me'},moments:['watching-tv','listening-podcasts']},
 {id:'coffee',prompt:'You’re meeting a friend for coffee.',options:{no:'We’ll sit',maybe:'Depends who it is',yes:'Walk with the coffee'},moments:['coffee','meeting-friends']},
 {id:'early',prompt:'You’ve arrived somewhere ten minutes early.',options:{no:'I’ll wait',maybe:'Maybe',yes:'Have a look around'},moments:['arriving-early','appointment-wait']},
 {id:'transport',prompt:'You’re on the bus or train home.',options:{no:'Straight home',maybe:'Sometimes',yes:'Hop off a stop early'},moments:['public-transport']},
 {id:'dog',prompt:'You’re out walking the dog.',options:{no:'Same route as always',maybe:'Maybe',yes:'Go a bit further'},moments:['dog-walk']}
];
export const momentScenario=Object.fromEntries(scenarios.flatMap(s=>s.moments.map(m=>[m,s.id]))) as Record<RecurringMoment,ScenarioId>;
/** 3–5 scenarios that matter for this person, most relevant first. */
export function scenariosFor(map:Pick<LifeMap,'contexts'|'moments'>):Scenario[]{
 const relevance=(s:Scenario)=>s.moments.filter(m=>map.moments.includes(m)).length*3+s.moments.filter(m=>momentContexts[m].some(c=>map.contexts.includes(c))).length;
 const ranked=scenarios.map(s=>({s,r:relevance(s)})).filter(x=>x.r>0).sort((a,b)=>b.r-a.r).map(x=>x.s);
 const general:ScenarioId[]=['listening-call','nearby-shop','early'];
 for(const id of general)if(ranked.length<3&&!ranked.some(s=>s.id===id))ranked.push(scenarios.find(s=>s.id===id)!);
 return ranked.slice(0,5);
}

// ── Screen 5: movement style ────────────────────────────────────────────────
export const movementStyles=['wander','destination','useful','outside','people','bursts','puffed','playful'] as const;
export type MovementStyle=typeof movementStyles[number];
export const styleCards:Record<MovementStyle,{title:string;text:string;image:IllustrationCategory}>={
 wander:{title:'Wander',text:'Easy walking.',image:'walking'},
 destination:{title:'Get somewhere',text:'Movement with a destination.',image:'neighbourhood'},
 useful:{title:'Do something useful',text:'Errands, chores, gardening and everyday tasks.',image:'cooking'},
 outside:{title:'Be outside',text:'Streets, parks and nature.',image:'nature'},
 people:{title:'Be with people',text:'Kids, partner, friends or family.',image:'social'},
 bursts:{title:'Tiny bursts',text:'A couple of minutes counts.',image:'low-energy'},
 puffed:{title:'Get a bit puffed',text:'Something more energetic.',image:'commuting'},
 playful:{title:'Make it playful',text:'Games, exploring and challenges.',image:'playful'}
};

// ── Screen 6: hard NOs ──────────────────────────────────────────────────────
export const hardNos=['running','stairs','floor','colleagues','public','sweating','alone-after-dark','jumping','high-impact','unattended-children','equipment'] as const;
export type HardNo=typeof hardNos[number];
export const hardNoLabels:Record<HardNo,string>={
 running:'Running',stairs:'Stairs',floor:'Floor exercises',colleagues:'Exercising around colleagues',public:'Exercising in public',sweating:'Sweating',
 'alone-after-dark':'Walking alone after dark',jumping:'Jumping','high-impact':'High-impact movement','unattended-children':'Leaving children unattended',equipment:'Anything needing equipment'
};

// ── Screen 7: burden tolerance ──────────────────────────────────────────────
export const extraTimeChoices=['none','few','more'] as const;
export type ExtraTime=typeof extraTimeChoices[number];
export const extraTimeOptions:Record<ExtraTime,{title:string;text:string;typical:number;maximum:number}>={
 none:{title:'None',text:'Movement has to fit inside something I’m already doing.',typical:0,maximum:1},
 few:{title:'A few minutes',text:'Up to about 5 extra minutes is fine.',typical:3,maximum:5},
 more:{title:'Sometimes more',text:'I’ll occasionally spend 10–15 minutes if the idea is worth it.',typical:8,maximum:15}
};

// ── Goal fitting (System B) ─────────────────────────────────────────────────
// These answers shape what happens after "I'd do that": how much is enough,
// when Enough speaks up and how it words things. The suggestion engine never
// reads them, so they cannot change which ideas are suggested.
export const frictions=['time','fatigue','childcare','unpredictable-work','preparation','cost','pain','cant-leave','dislike-exercise'] as const;
export type Friction=typeof frictions[number];
export const frictionLabels:Record<Friction,string>={time:'Not enough time',fatigue:'Being tired','childcare':'Looking after kids or someone else','unpredictable-work':'Work that changes a lot',preparation:'Getting changed or organised',cost:'Cost',pain:'Pain or a physical limit','cant-leave':'Not being able to get away','dislike-exercise':'Not liking formal exercise'};
export const goalFeelings=['helpful','flexible','resist','told-what-to-do','depends'] as const;
export type GoalFeel=typeof goalFeelings[number];
export const goalFeelLabels:Record<GoalFeel,string>={helpful:'Helpful',flexible:'Fine if they’re flexible',resist:'I start resisting them','told-what-to-do':'I don’t like being told what to do',depends:'Depends on the day'};
export const suggestStyles=['options','nudge','commit','low-pressure'] as const;
export type SuggestStyle=typeof suggestStyles[number];
export const suggestStyleLabels:Record<SuggestStyle,string>={options:'Just show me options',nudge:'A gentle nudge',commit:'Help me commit','low-pressure':'Keep it very low-pressure'};
export const workPatterns=['regular','some-weeks','shifts'] as const;
export type WorkPattern=typeof workPatterns[number];
export type FittingProfile={
 friction?:Friction[];
 frictionAnswered?:boolean;
 goalFeel?:GoalFeel;
 suggestStyle?:SuggestStyle;
 /** "Depends on the day" on the extra-time screen. The engine still receives `extraTime` ("A few minutes"). */
 extraTimeVaries?:boolean;
 workPattern?:WorkPattern;
 /** Answers to goal-fitting questions, by question id. Never copied into `profiling`. */
 answers?:Record<string,string>;
};

// ── The model ───────────────────────────────────────────────────────────────
export type LifeMap={
 version:1;
 contexts:LifeContext[];
 moments:RecurringMoment[];
 /** Free text from "Something else". Kept for the person; never used for matching or sent to AI. */
 otherMoment?:string;
 permissions:Partial<Record<ScenarioId,Permission>>;
 styles:MovementStyle[];
 hardNos:HardNo[];
 /** True once screen 6 has been answered, so an empty list means "nothing comes to mind". */
 hardNosAnswered:boolean;
 extraTime:ExtraTime;
 /** Progressive-profiling answers, by question id. */
 profiling:Record<string,string>;
 profilingMeta:{dismissed:Record<string,string>;lastAsked?:string};
 onboardingCompleted:boolean;
 updatedAt:string;
 /** Goal-fitting answers (System B). Optional; ignored by the suggestion engine. */
 fitting?:FittingProfile;
};
export const emptyLifeMap=():LifeMap=>({version:1,contexts:[],moments:[],permissions:{},styles:[],hardNos:[],hardNosAnswered:false,extraTime:'few',profiling:{},profilingMeta:{dismissed:{}},onboardingCompleted:false,updatedAt:new Date(0).toISOString()});

const iso=z.string().datetime({offset:true});
const unique=<T extends z.ZodTypeAny>(item:T,max:number)=>z.array(item).max(max).refine(v=>new Set(v).size===v.length,'Choose each option once');
export const lifeMapSchema=z.object({
 version:z.literal(1),
 contexts:unique(z.enum(lifeContexts),lifeContexts.length),
 moments:unique(z.enum(recurringMoments),recurringMoments.length),
 otherMoment:z.string().trim().max(120).optional(),
 permissions:z.record(z.enum(scenarioIds),z.enum(permissionLevels)),
 styles:unique(z.enum(movementStyles),movementStyles.length),
 hardNos:unique(z.enum(hardNos),hardNos.length),
 hardNosAnswered:z.boolean(),
 extraTime:z.enum(extraTimeChoices),
 profiling:z.record(z.string().max(40),z.string().max(40)).refine(r=>Object.keys(r).length<=40,'Too many answers'),
 profilingMeta:z.object({dismissed:z.record(z.string().max(40),iso).refine(r=>Object.keys(r).length<=40,'Too many dismissals'),lastAsked:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).strict(),
 onboardingCompleted:z.boolean(),
 updatedAt:iso,
 fitting:z.object({
  friction:unique(z.enum(frictions),frictions.length).optional(),
  frictionAnswered:z.boolean().optional(),
  goalFeel:z.enum(goalFeelings).optional(),
  suggestStyle:z.enum(suggestStyles).optional(),
  extraTimeVaries:z.boolean().optional(),
  workPattern:z.enum(workPatterns).optional(),
  answers:z.record(z.string().max(40),z.string().max(40)).refine(r=>Object.keys(r).length<=40,'Too many answers').optional()
 }).strict().optional()
}).strict();

export function burdenTolerance(map:Pick<LifeMap,'extraTime'>){const o=extraTimeOptions[map.extraTime];return {typicalExtraMinutes:o.typical,maximumExtraMinutes:o.maximum};}
export const hasLifeMap=(map:LifeMap|undefined):map is LifeMap=>!!map&&map.onboardingCompleted;
/** A short "Kids · Desk work · Driving" style summary. */
export const contextSummary=(map:LifeMap)=>map.contexts.map(c=>contextCards[c].title.replace(' & work',' work')).join(' · ');

/** A calendar day in local time, YYYY-MM-DD. */
export const localDay=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
