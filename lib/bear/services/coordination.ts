import type {CapacityWindow} from '../domain/types.ts';
// Nash-inspired coordination engine (MVP): scores candidate action plans by
// completion probability against total burden. Extensible to more agents later
// (partner, children, providers) by adding terms to `burden` and `feasible`.
export interface PlanCandidate{id:string;window:CapacityWindow;deadlineRisk:number;timeCost:number;cognitiveEffort:number;financialCost:number;dependencyReadiness:number;interruptionCost:number;valueAlignment:number;delegationOpportunity:number;completionProbability:number}
export interface PlanScore{id:string;score:number;reasons:string[]}
export function scorePlan(c:PlanCandidate):PlanScore{
 const reasons:string[]=[];
 const burden=c.timeCost*0.25+c.cognitiveEffort*0.3+c.financialCost*0.1+c.interruptionCost*0.35;
 const completion=c.completionProbability*(0.6+0.4*c.dependencyReadiness)*(1-c.deadlineRisk*0.8);
 const score=completion*0.7-burden*0.25+c.valueAlignment*0.05+c.delegationOpportunity*0.05;
 if(c.completionProbability>=0.7)reasons.push('you usually have a little more space then');
 if(c.deadlineRisk<0.2)reasons.push("you'll still have plenty of time before it's due");
 if(c.interruptionCost>0.6)reasons.push('it would interrupt something');
 return {id:c.id,score,reasons};
}
export function bestPlan(candidates:PlanCandidate[]):PlanScore|null{if(!candidates.length)return null;return candidates.map(scorePlan).sort((a,b)=>b.score-a.score)[0];}
