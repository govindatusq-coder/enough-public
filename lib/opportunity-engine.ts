import {momentLabels,momentScenario,extraTimeOptions,localDay,type LifeMap,type LifeContext,type RecurringMoment,type MovementStyle,type Permission} from './life-map.ts';
import {opportunities,extraFor,type MovementOpportunity,type Intensity} from './opportunities.ts';
import {profilingQuestions} from './profiling.ts';
import type {FeedbackEvent,OpportunityMoment,Situation} from './opportunity-log.ts';

/**
 * The recommendation pipeline. Deterministic, explainable and AI-free:
 *   1. retrieve candidates that touch the person's life contexts or moments
 *   2. remove anything that breaks a hard constraint
 *   3. score what remains with tunable weights
 *   4. pick a small, varied set (or one, for Right now)
 * Wording personalisation happens later and can never change the choice.
 */

/** Ranking weights. Kept in one object so they can be tuned from behavioural data. */
export const rankingWeights={
 contextMatch:8,
 momentMatch:24,
 situationMatch:30,
 permissionYes:14,
 permissionMaybe:3,
 stylePerMatch:6,
 styleCap:2,
 utility:2.5,
 burdenScore:-2,
 extraMinute:-2.2,
 pairing:5,
 previouslyAccepted:6,
 happened:4,
 rejectedOnce:-26,
 reasonPenalty:-6,
 reasonPenaltyCap:-18,
 recentRepeat:-12,
 novelty:2,
 rotation:3,
 diversitySameMoment:-14,
 diversitySameImage:-4,
 diversitySameStyle:-3
};

export type EngineInput={lifeMap:LifeMap;feedback?:FeedbackEvent[];moments?:OpportunityMoment[];now?:Date;library?:MovementOpportunity[]};
export type RankOptions={situation?:Situation;/** Overrides the Life Map's extra-time tolerance, in minutes (Right now). */extraAllowance?:number};
export type Ranked={opportunity:MovementOpportunity;score:number;minutes:number;extraMinutes:number;matchedMoment?:RecurringMoment;signals:string[];/** True when the person just told Enough what is happening. */known:boolean};

export const situationMoments:Record<Situation,RecurringMoment[]>={
 working:['long-desk','lunch-break','listening-meeting','listening-call'],
 waiting:['kid-activity-wait','appointment-wait','arriving-early','takeaway-wait','kids-sport-watch','public-transport'],
 kids:['kid-activity-wait','school-run','kids-outside','kids-sport-watch'],
 home:['cooking-dinner','chores','watching-tv','kids-outside'],
 errands:['grocery-shop','weekend-errands','short-car-trip','takeaway-wait','appointment-wait'],
 call:['listening-call','listening-meeting','personal-calls'],
 watching:['watching-tv','listening-podcasts'],
 'going-somewhere':['short-car-trip','public-transport','arriving-early','school-run'],
 break:['lunch-break','long-desk','coffee'],
 other:[]
};
export const situationLabels:Record<Situation,string>={working:'Working',waiting:'Waiting',kids:'With the kids',home:'At home',errands:'Running errands',call:'On a call',watching:'Watching something','going-somewhere':'Going somewhere',break:'Taking a break',other:'Something else'};
const situationContexts:Record<Situation,LifeContext[]>={working:['desk'],waiting:['kids','errands','driving','commuting'],kids:['kids'],home:['home'],errands:['errands','driving'],call:['calls','desk'],watching:['downtime','home'],'going-somewhere':['driving','commuting'],break:['desk','downtime'],other:[]};
/** Right-now options, most relevant to this Life Map first. "Something else" is always last. */
export function situationsFor(map:LifeMap):Situation[]{
 const all=(Object.keys(situationLabels) as Situation[]).filter(s=>s!=='other');
 const relevance=(s:Situation)=>situationContexts[s].filter(c=>map.contexts.includes(c)).length*2+situationMoments[s].filter(m=>map.moments.includes(m)).length;
 return [...all.sort((a,b)=>relevance(b)-relevance(a)||all.indexOf(a)-all.indexOf(b)),'other'];
}
export const stealOptions=[{id:'none',label:'None',minutes:1},{id:'5',label:'5 minutes',minutes:5},{id:'10',label:'10 minutes',minutes:10},{id:'20',label:'20+ minutes',minutes:30}] as const;

const intensityRank:Record<Intensity,number>={'very-light':0,light:1,moderate:2,vigorous:3};
const stylePhrase:Record<MovementStyle,string>={wander:'easy walking',destination:'getting somewhere',useful:'getting something done',outside:'being outside',people:'time with people',bursts:'a tiny burst',puffed:'getting a bit puffed',playful:'a bit of play'};
const hash=(text:string)=>{let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;};

/** Movement minutes: scaled ideas fit the extra-time tolerance; fixed ones use a sensible point in the range. */
export function minutesFor(o:MovementOpportunity,typicalExtra:number){
 if(o.extraScales)return Math.max(o.minMinutes,Math.min(o.maxMinutes,typicalExtra));
 const raw=o.minMinutes+(o.maxMinutes-o.minMinutes)*0.35;
 // Friendly numbers: multiples of five when the range allows it.
 return Math.max(o.minMinutes,Math.min(o.maxMinutes,o.maxMinutes>=5?Math.round(raw/5)*5||o.minMinutes:Math.round(raw)));
}
function allowance(map:LifeMap,options:RankOptions){
 if(options.extraAllowance!==undefined)return {typical:options.extraAllowance,maximum:options.extraAllowance};
 const o=extraTimeOptions[map.extraTime];return {typical:o.typical,maximum:o.maximum};
}
/** The moment this opportunity would use for this person: the first of its moments they have, else its first. */
function primaryMoment(o:MovementOpportunity,map:LifeMap,situation?:Situation){
 if(situation&&situation!=='other'){const m=o.moments.find(m=>situationMoments[situation].includes(m));if(m)return m;}
 return o.moments.find(m=>map.moments.includes(m))||o.moments[0];
}
export function permissionFor(o:MovementOpportunity,map:LifeMap,situation?:Situation):Permission|undefined{
 const moment=primaryMoment(o,map,situation);return moment?map.permissions[momentScenario[moment]]:undefined;
}

/** When someone says they're at home, only offer things that happen at home or step out from a home moment. */
const homeMoments:RecurringMoment[]=['cooking-dinner','chores','watching-tv'];
function fitsSituationPlace(o:MovementOpportunity,situation:Situation){
 if(situation!=='home')return true;
 return o.locationTypes.includes('home')||o.moments.some(m=>homeMoments.includes(m));
}

/** Kids’ ideas need kids, dog ideas need a dog, office ideas need work. Saying what's happening right now counts too. */
function hasPrerequisites(o:MovementOpportunity,map:LifeMap,situation?:Situation){
 return o.requires.every(c=>map.contexts.includes(c)||(situation?situationContexts[situation].includes(c):false));
}

// ── Step 1: retrieval ───────────────────────────────────────────────────────
export function retrieve(map:LifeMap,library:MovementOpportunity[]=opportunities,situation?:Situation):MovementOpportunity[]{
 const enabled=library.filter(o=>o.enabled);
 if(situation&&situation!=='other'){
  const moments=situationMoments[situation];
  return enabled.filter(o=>o.moments.some(m=>moments.includes(m))&&fitsSituationPlace(o,situation)&&hasPrerequisites(o,map,situation));
 }
 if(!map.contexts.length&&!map.moments.length)return enabled.filter(o=>!o.requires.length);
 return enabled.filter(o=>hasPrerequisites(o,map)&&(o.universal||o.contexts.some(c=>map.contexts.includes(c))||o.moments.some(m=>map.moments.includes(m))));
}

// ── Step 2: hard constraints ────────────────────────────────────────────────
/** Why an opportunity must not be shown, or null when it may be. */
export function exclusionReason(o:MovementOpportunity,input:EngineInput,options:RankOptions={}):string|null{
 const map=input.lifeMap;
 if(!o.enabled)return 'disabled';
 const broken=o.hardConstraintTags.find(t=>map.hardNos.includes(t));if(broken)return 'hard-no:'+broken;
 if(o.requiresEquipment&&map.hardNos.includes('equipment'))return 'hard-no:equipment';
 if(o.mobilityRequirements.includes('stairs')&&map.hardNos.includes('stairs'))return 'hard-no:stairs';
 if(o.mobilityRequirements.includes('floor')&&map.hardNos.includes('floor'))return 'hard-no:floor';
 if(o.intensity==='vigorous'&&(map.hardNos.includes('sweating')||!map.styles.includes('puffed')))return 'too-vigorous';
 if(o.intensity==='moderate'&&o.movementTypes.includes('puffed')&&map.hardNos.includes('sweating'))return 'hard-no:sweating';
 if(permissionFor(o,map,options.situation)==='no')return 'leave-me-alone';
 const limits=allowance(map,options),minutes=minutesFor(o,limits.typical);
 if(extraFor(o,minutes)>limits.maximum)return 'too-much-extra-time';
 for(const q of profilingQuestions){const answer=map.profiling[q.id];if(answer!==undefined&&q.affects(o)&&q.effect(answer,o).exclude)return 'profiling:'+q.id;}
 const rejections=(input.feedback||[]).filter(f=>f.opportunityId===o.id&&f.response==='reject').length;
 if(rejections>=2)return 'rejected-repeatedly';
 return null;
}

// ── Step 3: ranking ─────────────────────────────────────────────────────────
function score(o:MovementOpportunity,input:EngineInput,options:RankOptions):Ranked{
 const map=input.lifeMap,w=rankingWeights,now=input.now||new Date(),feedback=input.feedback||[],signals:string[]=[];
 const limits=allowance(map,options),minutes=minutesFor(o,limits.typical),extra=extraFor(o,minutes);
 const moment=primaryMoment(o,map,options.situation);
 let s=0;
 if(o.contexts.some(c=>map.contexts.includes(c)))s+=w.contextMatch;
 if(options.situation&&options.situation!=='other'&&o.moments.some(m=>situationMoments[options.situation!].includes(m)))s+=w.situationMatch;
 if(map.moments.includes(moment)){s+=w.momentMatch;signals.push(`You said ${momentLabels[moment].charAt(0).toLowerCase()+momentLabels[moment].slice(1)} happens a lot.`);}
 const permission=permissionFor(o,map,options.situation);
 if(permission==='yes'){s+=w.permissionYes;signals.push('You said you’d like ideas for moments like this.');}else if(permission==='maybe')s+=w.permissionMaybe;
 const styles=o.movementTypes.filter(t=>map.styles.includes(t));
 s+=Math.min(styles.length,w.styleCap)*w.stylePerMatch;
 if(styles.length)signals.push(`It’s ${stylePhrase[styles[0]]}, which you said suits you.`);
 s+=o.utilityScore*w.utility+o.burdenScore*w.burdenScore+extra*w.extraMinute;
 if(extra===0)signals.push('It doesn’t add time to your day.');
 if(o.pairsWith)s+=w.pairing;
 for(const q of profilingQuestions){
  const answer=map.profiling[q.id];if(answer===undefined||!q.affects(o))continue;
  const effect=q.effect(answer,o);s+=effect.delta||0;if(effect.signal)signals.push(effect.signal);
 }
 const mine=feedback.filter(f=>f.opportunityId===o.id),accepted=mine.filter(f=>f.response==='accept'),rejected=mine.filter(f=>f.response==='reject');
 if(rejected.length)s+=w.rejectedOnce;
 if(accepted.length){s+=w.previouslyAccepted;signals.push('You said this one was you.');}
 if(!mine.length)s+=w.novelty;
 const done=(input.moments||[]).filter(m=>m.opportunityId===o.id&&m.status==='done').length;if(done)s+=w.happened;
 const recent=[...accepted.map(f=>f.at),...(input.moments||[]).filter(m=>m.opportunityId===o.id).map(m=>m.plannedAt)].some(at=>now.getTime()-Date.parse(at)<2*864e5);
 if(recent)s+=w.recentRepeat;
 let reasonPenalty=0;
 for(const f of feedback){
  if(f.response!=='reject'||!f.reason||f.opportunityId===o.id)continue;
  const other=opportunities.find(x=>x.id===f.opportunityId);if(!other)continue;
  const hit=f.reason==='too-much-effort'?intensityRank[o.intensity]>=intensityRank[other.intensity]&&o.burdenScore>=other.burdenScore
   :f.reason==='dislike-type'?o.movementTypes[0]===other.movementTypes[0]
   :f.reason==='too-long'?o.minMinutes>=other.minMinutes
   :f.reason==='wrong-moment'?o.moments[0]===other.moments[0]:false;
  if(hit)reasonPenalty+=w.reasonPenalty;
 }
 s+=Math.max(w.reasonPenaltyCap,reasonPenalty);
 s+=hash(o.id+localDay(now))*w.rotation;
 return {opportunity:o,score:Math.round(s*100)/100,minutes,extraMinutes:extra,matchedMoment:map.moments.includes(moment)||options.situation?moment:undefined,signals,known:!!options.situation&&options.situation!=='other'};
}

/** Every eligible opportunity, best first. */
export function rank(input:EngineInput,options:RankOptions={}):Ranked[]{
 return retrieve(input.lifeMap,input.library,options.situation)
  .filter(o=>exclusionReason(o,input,options)===null)
  .map(o=>score(o,input,options))
  .sort((a,b)=>b.score-a.score||a.opportunity.id.localeCompare(b.opportunity.id));
}

// ── Step 4: a small, varied selection ───────────────────────────────────────
export function diversify(ranked:Ranked[],count:number):Ranked[]{
 const picked:Ranked[]=[],pool=[...ranked],w=rankingWeights;
 while(picked.length<count&&pool.length){
  let bestIndex=0,best=-Infinity;
  pool.forEach((r,i)=>{
   let s=r.score;
   for(const p of picked){
    if((r.matchedMoment||r.opportunity.moments[0])===(p.matchedMoment||p.opportunity.moments[0]))s+=w.diversitySameMoment;
    if(r.opportunity.imageCategory===p.opportunity.imageCategory)s+=w.diversitySameImage;
    if(r.opportunity.movementTypes[0]===p.opportunity.movementTypes[0])s+=w.diversitySameStyle;
   }
   if(s>best){best=s;bestIndex=i;}
  });
  picked.push(pool.splice(bestIndex,1)[0]);
 }
 return picked;
}
/** Home: about three strong, varied opportunities. */
export const recommend=(input:EngineInput,count=3)=>diversify(rank(input),count);
/** Right now: one confident answer for what's happening. */
export function rightNow(input:EngineInput,situation:Situation,extraAllowance?:number):Ranked|null{
 return rank(input,{situation,extraAllowance})[0]||null;
}
/** Onboarding payoff: three opportunities from three different moments. */
export function payoff(input:EngineInput,exclude:string[]=[]):Ranked[]{
 return diversify(rank(input).filter(r=>!exclude.includes(r.opportunity.id)),3);
}
