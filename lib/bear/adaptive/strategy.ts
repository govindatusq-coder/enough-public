// Adaptive Responsibility Engine: choosing the one thing to offer, and how to help with it.
// Order of thinking: understand the responsibility; check deadlines, risks and dependencies; see what Bear can prepare or do;
// see whether someone else could take it; check her time, place and readiness; pick a strategy; offer the smallest
// meaningful next step. Hard feasibility checks (business hours, waiting, information, trips, too long) come first and are
// shared with Got a Moment's own choice. Then an explainable score, with weights that are versioned and depend on how her
// days work. With no profile, this returns exactly what Got a Moment has always chosen.
import type {Task} from '../domain/types.ts';
import {candidatesFor,chooseMoment,explain,momentKey,tieHash,type Candidate,type MomentContext,type MomentResult,type PoolItem,type Recommendation} from '../rre/decide.ts';
import type {Attributes} from './attributes.ts';
import {ARCHETYPES,type Archetype,type TemporalProfile,dominant} from './profile.ts';
import {isSuppressed,strategyPreference,usualHours,type AdaptiveLearning,type StrategyId} from './learning.ts';
import {choose,reliefNote,reliefWeights,INTERVENTION_STRATEGY,RELIEF_POLICY_VERSION,type Intervention,type PolicyContext} from './relief-policy.ts';

export const STRATEGIES:{id:StrategyId;name:string;what:string}[]=[
 {id:'allocate',name:'Allocate',what:'Protected time for something that needs it, when she has the control to reserve it.'},
 {id:'prioritise',name:'Prioritise',what:'What matters most when things compete: consequences, deadlines, people waiting.'},
 {id:'synchronise',name:'Synchronise',what:'Matched to routines and outside constraints: open hours, already out, after pickup.'},
 {id:'adapt',name:'Adapt',what:'A step she can stop part-way through; Bear keeps her place and has another way if plans change.'},
 {id:'match',name:'Match opportunity',what:'Something that genuinely fits the window she has, allowing for getting started and interruptions.'},
 {id:'offload',name:'Offload',what:'Less for her to do: Bear prepares, drafts, organises or helps hand it to someone else.'},
 {id:'protect',name:'Protect',what:'Her capacity: fewer demands, a break, or nothing at all when nothing needs her.'},
];
export const WEIGHTS_VERSION='aw-1';
export type Weights={consequence:number;deadline:number;dependency:number;context:number;readiness:number;relief:number;preference:number;effort:number;interruption:number;burden:number};
export const BASE_WEIGHTS:Weights={consequence:3,deadline:2,dependency:1.5,context:1,readiness:1.5,relief:1.5,preference:1,effort:1,interruption:1,burden:.5};
// How each internal starting profile shifts the weights. Blended by how much of each she is (never one fixed label).
export const ARCHETYPE_DELTAS:Record<Archetype,Partial<Weights>>={
 planner:{consequence:.5,deadline:.5,effort:-.3},
 juggler:{context:1.5,dependency:.5},
 improviser:{interruption:1,readiness:.5,effort:.3},
 oncall:{relief:1.5,effort:.7,burden:.7,interruption:.5},
};
export function weightsFor(p:TemporalProfile|null|undefined,base:Weights=BASE_WEIGHTS):Weights{
 const w={...base};if(!p)return w;
 for(const a of ARCHETYPES)for(const [k,v] of Object.entries(ARCHETYPE_DELTAS[a]) as [keyof Weights,number][])w[k]=Math.round((w[k]+v*p.mix[a])*100)/100;
 return w;
}
// A ten-minute gap isn't ten minutes of doing: allow for getting started and for being interrupted. The less predictable
// her days, the more room is left. "Not sure" means a small, interruptible step.
export function effectiveWindow(minutes:number,unsure:boolean,p:TemporalProfile|null|undefined){
 if(unsure)return 5;if(!p)return minutes;
 return Math.max(2,Math.floor(minutes*(.6+.4*p.dims.predictability))-1);
}

export interface AdaptiveContext extends MomentContext{unsure?:boolean;profile:TemporalProfile|null;learning:AdaptiveLearning|null;attrs:Map<string,Attributes>;tasks:Map<string,Task>;hourLocal:number;
 condition?:'B'|'C'|'D'|'E';
 // The Cognitive Relief Policy (default) or the earlier adaptive scoring (for comparison and rollback). capacity: what she said
 // about today ("wiped" or "chaos"), a moment, not a trait. canPrepare: whether Bear can prepare this without AI or outside action.
 policy?:'adaptive'|'relief';capacity?:'normal'|'low'|'very_low';canPrepare?:(taskId:string)=>boolean}
export interface Primary{kind:'do'|'give'|'review'|'call'|'share';label:string}
export interface AdaptiveRecommendation extends Recommendation{strategy:StrategyId;primary:Primary;note:string|null;humanMinutes:number;window:number;share:boolean;intervention?:Intervention}
export interface AdaptiveResult extends Omit<MomentResult,'recommendation'>{recommendation:AdaptiveRecommendation|null;adaptive:boolean;
 alternative:{kind:'allocate'|'offload'|'protect';taskId:string|null;title:string|null;minutes:number|null;text:string}|null;
 scores:{taskId:string;score:number;parts:Record<string,number>}[];weights:Weights;weightsVersion:string}

const RISK={high:3,medium:2,low:1,none:0} as const;
function features(x:PoolItem,a:Attributes|undefined,ctx:AdaptiveContext,window:number,open:boolean){
 const p=ctx.profile;const today=ctx.today;
 const latest=a?.latestUsefulActionAt||x.c.plan.deadlines.action||x.c.plan.deadlines.outcome;
 const days=latest?Math.round((Date.parse(latest)-Date.parse(today))/86400000):null;
 const hours=usualHours(ctx.learning);
 return {
  consequence:RISK[x.f.risk]/3,
  deadline:days===null?0:days<=0?1:days<=1?.7:days<=3?.4:.1,
  dependency:(x.f.oppLevel/2)+(a?.pattern==='followup'?.5:0),
  context:(x.f.fit?1:0)+(a?.requiresBusinessHours&&open?.5:0)+(hours.includes(ctx.hourLocal)?.3:0),
  readiness:x.f.ready?1:0,
  relief:(x.needsBear?.7:0)+(a?.delegationEligible?.3*(p?.dims.delegationAccess??.5):0),
  preference:strategyPreference(ctx.learning,strategyOf(x,a,ctx,open)),
  effort:Math.min(2,x.f.minutes/Math.max(1,window)),
  interruption:(a?.interruptibility==='low'?1:a?.interruptibility==='medium'?.5:0)*(1-(p?.dims.interruptionTolerance??.55)),
  burden:Math.min(1,((a?.humanMinutes??x.f.minutes)>x.f.minutes?1:0)*.5+(x.c.plan.pathways.find(w=>w.id===x.c.plan.selected)?.steps.filter(s=>s.who==='you').length||1)/6),
 };
}
// Which kind of help this is, for this responsibility, now. Decided per responsibility and moment, never fixed per person.
export function strategyOf(x:PoolItem,a:Attributes|undefined,ctx:Pick<AdaptiveContext,'profile'|'unsure'>,open:boolean):StrategyId{
 const d=dominant(ctx.profile);
 if(x.f.risk==='high')return 'prioritise';
 if(x.f.ready)return 'offload';
 // A call or booking while places are open: now is the moment (Bear's script for it comes on the next screen).
 if(a?.requiresBusinessHours&&open)return 'synchronise';
 if(x.needsBear)return 'offload';
 if(ctx.unsure)return 'match';
 if(a?.resumable&&(ctx.profile?.dims.interruptionTolerance??1)<.4)return 'adapt';
 if(d==='planner'&&x.f.minutes>=20)return 'allocate';
 if(x.f.risk==='medium')return 'prioritise';
 return 'match';
}
function primaryFor(x:PoolItem,a:Attributes|undefined):Primary{
 if(x.f.ready)return {kind:'review',label:'Review it'};
 if(x.step.context==='phone'||a?.requiresBusinessHours&&a.pattern!=='acquire')return {kind:'call',label:'Make the call'};
 if(x.needsBear)return {kind:'give',label:'Give it to Bear'};
 return {kind:'do',label:'Let’s do it'};
}
// A short line about why this help, true to the state of things. Never invents times, stock or availability.
function noteFor(s:StrategyId,x:PoolItem,a:Attributes|undefined,ctx:AdaptiveContext,share:boolean):string|null{
 if(share)return 'Someone else could take this one, if you’d rather. Bear can ask them for you.';
 if(s==='synchronise')return 'Businesses are open now, so it’s a good moment for this.';
 if(s==='offload'&&x.needsBear)return 'Bear will get it ready first, so there’s less for you to do.';
 if(s==='adapt')return 'You can stop part-way. Bear keeps your place.';
 if(s==='match'&&ctx.unsure)return x.f.minutes<=3?'It only takes a minute or two.':'It’s small, and you can stop part-way.';
 if(s==='allocate')return 'This needs a proper block of time. Bear can help you find one.';
 void a;return null;
}

export function adaptiveMoment(items:Candidate[],ctx:AdaptiveContext):AdaptiveResult{
 if(ctx.policy==='relief')return reliefMoment(items,ctx);
 const cond=ctx.condition||'E';const profile=cond==='D'||cond==='E'?ctx.profile:null;
 const weights=weightsFor(profile);
 // No profile (or a condition without adaptive strategy): exactly Got a Moment's own choice, labelled with its strategy.
 if(!profile){
  const base=chooseMoment(items,{...ctx,minutes:ctx.unsure?5:ctx.minutes});
  const r=base.recommendation;let rec:AdaptiveRecommendation|null=null;
  if(r){const {pool,open}=candidatesFor(items,{...ctx,minutes:ctx.unsure?5:ctx.minutes});const x=pool.find(p=>p.c.taskId===r.taskId)!;const a=ctx.attrs.get(r.taskId);
   const s=strategyOf(x,a,{profile:null,unsure:ctx.unsure},open);rec={...r,strategy:s,primary:primaryFor(x,a),note:noteFor(s,x,a,ctx,false),humanMinutes:a?.humanMinutes??r.minutes,window:ctx.minutes,share:false};}
  return {...base,recommendation:rec,adaptive:false,alternative:null,scores:[],weights,weightsVersion:WEIGHTS_VERSION};
 }
 const window=effectiveWindow(ctx.minutes,!!ctx.unsure,profile);
 const {pool:all,considered,waiting,tooLong,open}=candidatesFor(items,{...ctx,minutes:window});
 // "Don't suggest this kind of thing again" is respected, unless something important would be missed.
 const pool=all.filter(x=>{const a=ctx.attrs.get(x.c.taskId);return !(a&&isSuppressed(ctx.learning,a)&&x.f.risk!=='high');});
 const scored=pool.map(x=>{const a=ctx.attrs.get(x.c.taskId);const f=features(x,a,ctx,window,open);
  const parts:Record<string,number>={};let score=0;
  for(const k of Object.keys(f) as (keyof typeof f)[]){const sign=k==='effort'||k==='interruption'||k==='burden'?-1:1;const v=Math.round(sign*weights[k]*f[k]*100)/100;parts[k]=v;score+=v;}
  return {x,a,score:Math.round(score*100)/100,parts};});
 const order=(p:typeof scored[number],q:typeof scored[number])=>{if(Math.abs(q.score-p.score)>.05)return q.score-p.score;const ka=momentKey(p.x),kb=momentKey(q.x);for(let i=0;i<ka.length;i++)if(ka[i]!==kb[i])return ka[i]-kb[i];return tieHash(p.x.c.taskId+ctx.today)-tieHash(q.x.c.taskId+ctx.today);};
 scored.sort(order);
 let top=scored[0];
 if(top&&ctx.last&&ctx.last.minutes===ctx.minutes&&ctx.now.getTime()-Date.parse(ctx.last.at)<3*3600000){const keep=scored.find(s=>s.x.c.taskId===ctx.last!.taskId);if(keep&&!(top.x.f.risk==='high'&&keep.x.f.risk!=='high'))top=keep;}
 const trace=(selected:string|null,reason:string,confidence:number)=>({at:ctx.now.toISOString(),rules:`${WEIGHTS_VERSION}`,minutes:window,considered,selected,reason,confidence});
 const scores=scored.map(s=>({taskId:s.x.c.taskId,score:s.score,parts:s.parts}));
 if(!top){
  // Nothing fits. Offer the most useful alternative: let Bear prepare or hand on a bigger thing; protect time for it; or rest.
  const bigger=items.map(c=>({c,a:ctx.attrs.get(c.taskId)})).filter(({c,a})=>c.status==='open'&&a&&a.readiness!=='waiting'&&a.readiness!=='completed'&&!considered.find(k=>k.taskId===c.taskId&&k.excluded&&/waiting|marked|handed/.test(k.excluded)));
  const prep=bigger.find(({a})=>a!.agentPreparationAvailable);const hand=bigger.find(({a})=>a!.delegationEligible&&profile.dims.delegationAccess>=.4);
  const shortest=tooLong.length?Math.min(...tooLong):null;const long=shortest?bigger.find(({a})=>a!.humanMinutes===shortest)||null:null;
  const alternative=prep?{kind:'offload' as const,taskId:prep.c.taskId,title:prep.c.title,minutes:null,text:'Nothing fits that time, but Bear could get this ready for later.'}
   :hand?{kind:'offload' as const,taskId:hand.c.taskId,title:hand.c.title,minutes:null,text:'Nothing fits that time. Someone else could take this one, if you’d like to ask.'}
   :long&&dominant(profile)==='planner'?{kind:'allocate' as const,taskId:long.c.taskId,title:long.c.title,minutes:shortest,text:`Nothing fits right now. This needs about ${shortest} minutes: worth setting time aside for it.`}
   :{kind:'protect' as const,taskId:null,title:null,minutes:null,text:waiting?`Nothing needs you right now. Bear is keeping an eye on ${waiting===1?'one thing':`${waiting} things`}. A break counts too.`:'Nothing needs you right now. A break counts too.'};
  const message=alternative.text;
  return {recommendation:null,message,suggestMinutes:null,waiting,trace:trace(null,message,1),adaptive:true,alternative,scores,weights,weightsVersion:WEIGHTS_VERSION};
 }
 const {label,why}=explain(top.x.c.plan,top.x.f,top.x.needsBear,ctx.today);
 const s=strategyOf(top.x,top.a,{profile,unsure:ctx.unsure},open);
 // Offer handing it on (as the note, beside Let's do it) when she has help, the step is a real effort for this window,
 // and Bear's rule says it's the kind of thing someone else could do.
 const share=!!top.a?.delegationEligible&&profile.dims.delegationAccess>=.5&&(profile.mix.oncall+profile.mix.juggler)>=.5&&top.x.f.minutes>=window*.5;
 const confidence=Math.round(Math.min(1,.5+.5*(profile.confidence.autonomy+profile.confidence.predictability)/2)*100)/100;
 const rec:AdaptiveRecommendation={taskId:top.x.c.taskId,title:top.x.title,label,minutes:top.x.f.minutes,why,needsBear:top.x.needsBear,alternative:scored[1]?{taskId:scored[1].x.c.taskId,title:scored[1].x.title}:null,confidence,
  strategy:s,primary:primaryFor(top.x,top.a),note:noteFor(s,top.x,top.a,ctx,share),humanMinutes:top.a?.humanMinutes??top.x.f.minutes,window,share};
 return {recommendation:rec,message:null,suggestMinutes:null,waiting,trace:trace(top.x.c.taskId,`${s}: ${label}: ${why}`,confidence),adaptive:true,alternative:null,scores,weights,weightsVersion:WEIGHTS_VERSION};
}

// ---------- Cognitive Relief Policy ----------
// The same feasibility checks, then the intervention with the best expected net relief (see relief-policy.ts). It may choose
// not to intervene. Her profile shifts the weights a little; what she said about today (capacity) shrinks the window and
// raises the cost of asking anything of her.
export function reliefMoment(items:Candidate[],ctx:AdaptiveContext):AdaptiveResult{
 const cond=ctx.condition||'E';const profile=cond==='D'||cond==='E'?ctx.profile:null;const capacity=ctx.capacity||'normal';
 const w=reliefWeights(profile);
 const base=effectiveWindow(ctx.minutes,!!ctx.unsure,profile);const window=capacity==='low'?Math.max(2,Math.floor(base*.6)):capacity==='very_low'?Math.max(2,Math.floor(base*.4)):base;
 const {pool:all,considered,waiting,open}=candidatesFor(items,{...ctx,minutes:window});
 const pool=all.filter(x=>{const a=ctx.attrs.get(x.c.taskId);return !(a&&isSuppressed(ctx.learning,a)&&x.f.risk!=='high');});
 const pctx:PolicyContext={window,profile,learning:ctx.learning,delegationAccess:profile?.dims.delegationAccess??0,openBusiness:open,capacity,canPrepare:x=>ctx.canPrepare?ctx.canPrepare(x.c.taskId):x.c.plan.kind!=='gifts',
  declinedBefore:id=>ctx.tasks.get(id)?.delegation?.status==='DECLINED'};
 // Nothing feasible at all: say what would fit, exactly as Got a Moment always has (e.g. "the next thing takes about 10 minutes").
 // If something bigger could still come off her plate (Bear gets it ready, or someone else takes it), offer that instead.
 if(!pool.length){const b=chooseMoment(items,{...ctx,minutes:window});
  const bigger=items.map(c=>({c,a:ctx.attrs.get(c.taskId)})).filter(({c,a})=>c.status==='open'&&a&&a.readiness!=='waiting'&&a.readiness!=='completed'&&!considered.find(k=>k.taskId===c.taskId&&k.excluded&&/waiting|marked|handed|skipped|asked for something else|nothing for you/.test(k.excluded))&&!(isSuppressed(ctx.learning,a)));
  const prep=bigger.find(({c,a})=>a!.agentPreparationAvailable&&pctx.canPrepare({c} as PoolItem));
  const hand=profile?bigger.find(({c,a})=>a!.delegationEligible&&profile.dims.delegationAccess>=.4&&ctx.tasks.get(c.taskId)?.delegation?.status!=='DECLINED'):undefined;
  const alternative=prep?{kind:'offload' as const,taskId:prep.c.taskId,title:prep.c.title,minutes:null,text:'Nothing fits that time, but Bear could get this ready for later.'}
   :hand?{kind:'offload' as const,taskId:hand.c.taskId,title:hand.c.title,minutes:null,text:'Nothing fits that time. Someone else could take this one, if you’d like to ask.'}:null;
  return {...b,recommendation:null,message:alternative?.text??b.message,adaptive:true,alternative,scores:[],weights:weightsFor(profile),weightsVersion:RELIEF_POLICY_VERSION};}
 const chosen=choose(pool.map(x=>({x,a:ctx.attrs.get(x.c.taskId),saved:!!ctx.tasks.get(x.c.taskId)?.progress?.savedAt})),pctx,w);let top=chosen.top;const {scored,reason}=chosen;
 // Stability: the same window asked again soon gets the same suggestion, unless something genuinely more pressing appeared.
 if(top&&ctx.last&&ctx.last.minutes===ctx.minutes&&ctx.now.getTime()-Date.parse(ctx.last.at)<3*3600000){const keep=scored.find(x=>x.x.c.taskId===ctx.last!.taskId);if(keep&&!(top.x.f.risk==='high'&&keep.x.f.risk!=='high'))top=keep;}
 const scores=scored.map(s=>({taskId:s.x.c.taskId,score:s.utility,parts:{...s.parts,[`via_${s.best.intervention}`]:1}}));
 const trace=(selected:string|null,why:string,confidence:number)=>({at:ctx.now.toISOString(),rules:RELIEF_POLICY_VERSION,minutes:window,considered,selected,reason:why,confidence});
 const weights=weightsFor(profile);
 if(!top){
  const message=reason==='capacity'?'It’s been a lot today. Nothing here needs you right now. A break counts too.'
   :waiting?`Nothing needs you right now. ${waiting===1?'One thing is':`${waiting} things are`} waiting on someone else; they’re in Bear Brain.`
   :'Nothing needs you right now. Everything is in Bear Brain when you want it.';
  return {recommendation:null,message,suggestMinutes:null,waiting,trace:trace(null,`no intervention: ${reason}`,1),adaptive:true,
   alternative:{kind:'protect',taskId:null,title:null,minutes:null,text:message},scores,weights,weightsVersion:RELIEF_POLICY_VERSION};
 }
 const x=top.x,a=top.a,e=top.best;const {label,why}=explain(x.c.plan,x.f,x.needsBear,ctx.today);
 // Interrupted earlier (a step done, or her place saved): she picks up where she left off, nothing to reconstruct.
 const started=(x.c.plan.stepIndex>0&&!x.needsBear)||!!ctx.tasks.get(x.c.taskId)?.progress?.savedAt;
 const s:StrategyId=e.intervention==='do'?strategyOf(x,a,{profile,unsure:ctx.unsure},open):INTERVENTION_STRATEGY[e.intervention];
 const primary:Primary=e.intervention==='transfer'?{kind:'share',label:'Ask someone'}:e.intervention==='review'?{kind:'review',label:'Review it'}:e.intervention==='prepare'?{kind:'give',label:'Give it to Bear'}:primaryFor(x,a);
 // Consequence protection when the deadline thing can't be done right now (too long for this window, a trip out, places
 // closed): it isn't hidden. One short heads-up rides on the card; nothing else changes.
 const heads=x.f.risk==='high'?null:headsUp(items,considered,ctx.today);
 const rec:AdaptiveRecommendation={taskId:x.c.taskId,title:x.title,label,minutes:e.humanMinutes||x.f.minutes,why,needsBear:x.needsBear,alternative:scored[1]?{taskId:scored[1].x.c.taskId,title:scored[1].x.title}:null,
  confidence:Math.round(e.confidence*100)/100,strategy:s,primary,note:heads||reliefNote(e,false,started),humanMinutes:a?.humanMinutes??x.f.minutes,window,share:e.intervention==='transfer',intervention:e.intervention};
 return {recommendation:rec,message:null,suggestMinutes:null,waiting,trace:trace(x.c.taskId,`${e.intervention}/${s}: ${label}: ${why}`,rec.confidence),adaptive:true,alternative:null,scores,weights,weightsVersion:RELIEF_POLICY_VERSION};
}

// A deadline that's due today or tomorrow and couldn't be offered now, said plainly (its title and what's in the way).
function headsUp(items:Candidate[],considered:{taskId:string;excluded:string|null}[],today:string):string|null{
 for(const c of considered){if(!c.excluded||!/^(takes about|needs a trip out|businesses are closed)/.test(c.excluded))continue;
  const it=items.find(i=>i.taskId===c.taskId);const due=it?.plan.deadlines.outcome;if(!it||!due||it.plan.kind==='aspiration')continue;
  const days=Math.round((Date.parse(due)-Date.parse(today))/86400000);if(days>1||days<0)continue;
  const when=days===0?'today':'tomorrow';const t=it.title.charAt(0).toLowerCase()+it.title.slice(1);
  const what=/^takes about/.test(c.excluded)?`needs ${c.excluded.replace(/^takes /,'')}. Worth setting time aside`:/^needs a trip/.test(c.excluded)?'needs a trip out. Worth fitting it in when you’re out':'needs a call once places open';
  return `Heads up: “${t}” is due ${when} and ${what}.`;}
 return null;
}
