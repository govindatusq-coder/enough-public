// Cognitive Relief Policy: a decision layer inside the Adaptive Responsibility Engine.
// The question for each responsibility: what is the least burdensome, reliable way to resolve or reduce it, with the least
// unnecessary involvement from her? Objectives in order: protect against serious foreseeable consequences; respect what she
// has said and chosen; reduce what she has to remember, decide, research, organise, coordinate, monitor and do; give her time
// back; resolve things; make progress when resolution isn't possible. Never throughput, time used or interactions.
//
// Two stages. Stage 1 (hard): the shared feasibility checks, then consequence protection (a deadline at risk is never
// starved by easier things). Stage 2: among what is feasible, the intervention with the best expected net relief:
//   utility = net relief + meaningful progress + consequence + preference + fit + long-term relief
//           − interaction cost − interruption risk − uncertainty − downstream coordination
// The estimates are versioned heuristics, not measurements of anyone's load, and are never shown as numbers.
import type {PoolItem} from '../rre/decide.ts';
import type {Attributes} from './attributes.ts';
import type {TemporalProfile} from './profile.ts';
import {strategyPreference,type AdaptiveLearning,type StrategyId} from './learning.ts';

export const RELIEF_POLICY_VERSION='crp-1';
export const BURDENS=['remembering','anticipation','informationSearch','decisionMaking','planning','coordination','monitoring','interruptionRecovery','executionEffort'] as const;
export type BurdenKey=typeof BURDENS[number];
export type Burden=Record<BurdenKey,number>&{confidence:number};
// Bear's internal repertoire. She never picks one; it's how Bear chooses what to offer.
export type Intervention='prepare'|'review'|'do'|'transfer'|'none';
export const INTERVENTION_STRATEGY:Record<Intervention,StrategyId>={prepare:'offload',review:'offload',do:'match',transfer:'offload',none:'protect'};
export interface InterventionEstimate{intervention:Intervention;removed:Burden;introduced:Burden;humanMinutes:number;interactions:number;decisions:number;
 progress:number;resolution:number;interruptionRisk:number;consequenceRisk:number;permissionRequired:boolean;capabilityAvailable:boolean;confidence:number}
export interface ReliefWeights{relief:number;progress:number;consequence:number;preference:number;context:number;longTerm:number;interaction:number;interruption:number;uncertainty:number;coordination:number}
export const RELIEF_WEIGHTS:ReliefWeights={relief:1.2,progress:1,consequence:2.5,preference:.5,context:.6,longTerm:.6,interaction:.35,interruption:.8,uncertainty:.4,coordination:.8};
// Starting assumptions by how her days work (blended; never restrictions).
const DELTAS:Record<'planner'|'juggler'|'improviser'|'oncall',Partial<ReliefWeights>>={
 planner:{progress:.3,consequence:.3},juggler:{context:.5,coordination:.2},improviser:{interruption:.4,progress:.1},oncall:{relief:.6,interaction:.25,interruption:.3},
};
export function reliefWeights(p:TemporalProfile|null|undefined):ReliefWeights{const w={...RELIEF_WEIGHTS};if(!p)return w;
 for(const [k,d] of Object.entries(DELTAS) as [keyof typeof DELTAS,Partial<ReliefWeights>][])for(const [x,v] of Object.entries(d) as [keyof ReliefWeights,number][])w[x]=Math.round((w[x]+v*p.mix[k])*100)/100;return w;}

const zero=():Burden=>({remembering:0,anticipation:0,informationSearch:0,decisionMaking:0,planning:0,coordination:0,monitoring:0,interruptionRecovery:0,executionEffort:0,confidence:0});
const sum=(b:Burden)=>BURDENS.reduce((a,k)=>a+b[k],0);
const RISK={high:1,medium:.6,low:.25,none:0} as const;

// What this responsibility still asks of her, now (0–1 each).
export function burdenOf(x:PoolItem,a:Attributes|undefined,saved=false):Burden{
 const p=x.c.plan;const her=a?a.humanMinutes:x.f.minutes;const steps=p.pathways.find(w=>w.id===p.selected)?.steps||[];const hers=steps.slice(p.stepIndex).filter(s=>s.who==='you');
 const watched=!!a&&a.labour.monitoring==='bear';const started=(p.stepIndex>0&&hers.length>0)||saved;
 return {
  remembering:Math.min(1,(watched?.1:.5)+(p.deadlines.outcome?.3:0)),
  anticipation:p.deadlines.outcome?(a?.latestUsefulActionAt?.1:.3):(a?.missingInformation.length?.5:.2),
  informationSearch:a?.agentPreparationAvailable?(['acquire','gifts','appointment'].includes(p.kind)?.6:.4):.1,
  decisionMaking:Math.min(1,(hers.some(s=>s.kind==='decide')?.4:0)+(x.f.ready?.3:0)+(p.pathways.length>1&&p.chosenBy==='bear'?.1:0)),
  planning:hers.length>2?.5:her>=30?.4:.1,
  coordination:['followup','call','appointment'].includes(p.kind)?.4:.1,
  monitoring:p.dependencies.some(d=>d.status==='open')||steps.slice(p.stepIndex).some(s=>s.kind==='wait')?(watched?.2:.5):0,
  interruptionRecovery:started&&a?.resumable?.5:0,
  executionEffort:Math.min(1,her/60),
  confidence:a?Math.min(1,.4+(a.confidence.domain+a.confidence.pattern)/2):.3,
 };
}
export interface PolicyContext{window:number;profile:TemporalProfile|null;learning:AdaptiveLearning|null;delegationAccess:number;openBusiness:boolean;
 capacity:'normal'|'low'|'very_low';canPrepare:(x:PoolItem)=>boolean;
 // Someone already said no to this once: asking again is worth less, and costs her more coordinating.
 declinedBefore?:(taskId:string)=>boolean}
// The ways Bear could help with this responsibility now, each with what it would take off her and what it would ask of her.
export function interventionsFor(x:PoolItem,a:Attributes|undefined,b:Burden,ctx:PolicyContext):InterventionEstimate[]{
 const out:InterventionEstimate[]=[];const risk=RISK[x.f.risk];const step=x.f.minutes;
 const est=(i:Intervention,rm:Partial<Burden>,intro:Partial<Burden>,e:Partial<InterventionEstimate>):InterventionEstimate=>({intervention:i,removed:{...zero(),...rm,confidence:b.confidence},introduced:{...zero(),...intro,confidence:b.confidence},
  humanMinutes:0,interactions:1,decisions:0,progress:.5,resolution:0,interruptionRisk:0,consequenceRisk:risk,permissionRequired:false,capabilityAvailable:true,confidence:b.confidence,...e});
 const interr=(a?.interruptibility==='low'?.7:a?.interruptibility==='medium'?.35:.1)*(1-(ctx.profile?.dims.interruptionTolerance??.55));
 // Bear prepares first (internal and reversible: a draft, a shortlist, the details). She then only has to look.
 if(x.needsBear&&ctx.canPrepare(x))out.push(est('prepare',{informationSearch:b.informationSearch*.8,decisionMaking:b.decisionMaking*.4,planning:b.planning*.4,anticipation:b.anticipation*.5,remembering:b.remembering*.2},
  {decisionMaking:.1},{humanMinutes:Math.min(2,step),interactions:1,decisions:1,progress:.9,interruptionRisk:.05}));
 // Already prepared: a quick review is the next step.
 if(x.f.ready)out.push(est('review',{executionEffort:b.executionEffort*.5,decisionMaking:b.decisionMaking*.6,remembering:b.remembering*.3,informationSearch:b.informationSearch},
  {},{humanMinutes:Math.min(step,5),interactions:1,decisions:1,progress:.9,resolution:.3,interruptionRisk:interr*.5}));
 // Hand it on (Share Bear): only when someone could, she has help, and the coordination it asks is worth it. It isn't hers
 // to stop thinking about until they accept; Bear follows up, so the monitoring left with her is small.
 if(a?.delegationEligible&&ctx.delegationAccess>=.4&&ctx.window>=2){const p=ctx.delegationAccess*(x.c.plan.dependencies.length?0.8:1)*(ctx.declinedBefore?.(x.c.taskId)?.5:1);
  out.push(est('transfer',{executionEffort:b.executionEffort*.9*p,remembering:b.remembering*.6*p,planning:b.planning*.5*p},{coordination:.3,monitoring:.1,decisionMaking:.1},
   {humanMinutes:2,interactions:2,decisions:1,progress:p,resolution:p*.8,interruptionRisk:.05,permissionRequired:true}));}
 // Doing the next step herself, now.
 const fits=step<=ctx.window;const last=(x.c.plan.pathways.find(w=>w.id===x.c.plan.selected)?.steps.slice(x.c.plan.stepIndex).filter(s=>s.who==='you'&&s.kind!=='wait').length||1)<=1;
 if(fits)out.push(est('do',{executionEffort:b.executionEffort*(last?1:.5),remembering:last?b.remembering:b.remembering*.3,interruptionRecovery:b.interruptionRecovery,monitoring:0},
  {executionEffort:Math.min(1,step/Math.max(1,ctx.window))*.4},{humanMinutes:step,interactions:1,decisions:0,progress:.8,resolution:last?.8:.2,interruptionRisk:interr}));
 return out;
}
export interface Scored{x:PoolItem;a:Attributes|undefined;burden:Burden;best:InterventionEstimate;utility:number;parts:Record<string,number>}
export function utilityOf(e:InterventionEstimate,x:PoolItem,a:Attributes|undefined,ctx:PolicyContext,w:ReliefWeights,deferrals:number){
 const net=(sum(e.removed)-sum(e.introduced))/3;
 const pref=strategyPreference(ctx.learning,INTERVENTION_STRATEGY[e.intervention]);
 const fit=(x.f.fit?.6:0)+(a?.requiresBusinessHours&&ctx.openBusiness?.4:0);
 const longTerm=e.removed.remembering+e.removed.monitoring;
 // Things put off again and again aren't left to slide when they matter (consequential, not aspirations).
 const deferral=x.f.risk!=='none'&&!x.f.aspiration?Math.min(1.5,deferrals*.5):0;
 const parts={relief:w.relief*net,progress:w.progress*e.progress,consequence:w.consequence*e.consequenceRisk+deferral,preference:w.preference*pref,context:w.context*fit,longTerm:w.longTerm*longTerm,
  interaction:-w.interaction*(e.interactions+e.decisions)*(ctx.capacity==='normal'?1:ctx.capacity==='low'?1.5:2.2),interruption:-w.interruption*e.interruptionRisk,uncertainty:-w.uncertainty*(1-e.confidence),
  coordination:-w.coordination*(e.introduced.coordination+e.introduced.monitoring)};
 for(const k of Object.keys(parts) as (keyof typeof parts)[])parts[k]=Math.round(parts[k]*100)/100;
 return {utility:Math.round(Object.values(parts).reduce((p,q)=>p+q,0)*100)/100,parts};
}
// Below this, offering anything costs her more than it gives (unless something consequential is at stake): Bear doesn't intervene.
export const NO_INTERVENTION_BELOW=.2;
export function choose(pool:{x:PoolItem;a:Attributes|undefined;saved?:boolean}[],ctx:PolicyContext,w:ReliefWeights):{top:Scored|null;scored:Scored[];reason:string}{
 const scored:Scored[]=[];
 for(const {x,a,saved} of pool){const b=burdenOf(x,a,!!saved);const opts=interventionsFor(x,a,b,ctx);if(!opts.length)continue;const deferrals=x.c.plan.dismissed.length;
  let best:Scored|null=null;for(const e of opts){const u=utilityOf(e,x,a,ctx,w,deferrals);if(!best||u.utility>best.utility)best={x,a,burden:b,best:e,...u};}
  if(best)scored.push(best);}
 if(!scored.length)return {top:null,scored,reason:'nothing feasible'};
 // Stage 1, consequence protection: a deadline at risk is offered ahead of anything easier.
 const atRisk=scored.filter(s=>s.x.f.risk==='high');const pool2=atRisk.length?atRisk:scored;
 pool2.sort((p,q)=>q.utility-p.utility);let top=pool2[0];
 // Easy-task bias guard: a quick, low-stakes thing doesn't win over something that matters and fits nearly as well.
 if(top.x.f.risk!=='medium'&&top.x.f.risk!=='high'){const m=pool2.find(s=>s.x.f.risk==='medium'&&s.utility>=top.utility*.8);if(m)top=m;}
 // Choosing not to intervene: nothing consequential, and offering anything would cost more than it gives.
 const consequential=top.x.f.risk==='high'||top.x.f.risk==='medium';
 if(!consequential&&(top.utility<NO_INTERVENTION_BELOW||ctx.capacity==='very_low'))return {top:null,scored:pool2,reason:ctx.capacity==='very_low'?'capacity':'low_relief'};
 return {top,scored:pool2,reason:'best_relief'};
}
// What she'd still have to do now, in words (shown as the existing note; never a number).
export function reliefNote(e:InterventionEstimate,prepared:boolean,started:boolean):string|null{
 if(started&&e.intervention==='do')return 'Pick up where you left off. Bear kept your place.';
 if(e.intervention==='review'||prepared)return 'Bear has got it ready. It just needs a quick look.';
 if(e.intervention==='prepare')return 'Bear will get it ready first, so there’s less for you to do.';
 if(e.intervention==='transfer')return 'Someone else could take this one. Bear can ask them and keep track of the answer.';
 return null;
}
