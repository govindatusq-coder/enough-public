import type {AreaKey} from '../domain/types.ts';
import type {HumanActionKind,PatternId} from '../load/types.ts';

// The Priority Engine's model. WHY (importance: values, goals, responsibilities, consequences),
// WHEN (deadlines, lead times, dependencies, future pressure) and HOW (effort, aversion,
// strengths, capacity) are kept apart: how something gets done never decides whether it matters.

export const valueAreas=['family','relationships','career','financial_security','health','home','learning','independence','community','rest','enjoyment','creativity','parenting','caregiving'] as const;
export type ValueArea=typeof valueAreas[number];

export interface ValueEntry{key:ValueArea;source:'user'|'inferred';confidence:number}
export interface UserGoal{id:string;text:string;kind:'goal'|'responsibility'|'non_negotiable';area?:AreaKey|null;createdAt:string}
export interface LearnedPriority{pattern:PatternId;importanceShift:number;aversion:number;confidence:number}
export interface ValuesGoalsMap{values:ValueEntry[];goals:UserGoal[];learnedPriorities?:LearnedPriority[]}

// 0–1 throughout. Internal only: never shown as numbers.
export interface PriorityVector{
 consequence:number;valuesAlignment:number;goalContribution:number;
 deadlinePressure:number;futureUrgency:number;
 dependencyLeverage:number;waitingLeadTime:number;
 reversibility:number;
 currentOpportunity:number;currentCapacityFit:number;
 humanActionRequired:number;
 taskAversiveness:number;expectedEffort:number;
 capabilityFit:number;preferenceFit:number;
 confidence:number;
}
export type ReasonKey='matters'|'pressure'|'depends'|'window'|'bear'|'safety'|'deadline'|'lead';
export interface Reason{key:ReasonKey;title:string;text:string}
export interface PriorityExplanation{
 primaryReason:string;contributingReasons:string[];timingReason?:string;goalLinks?:string[];valueLinks?:string[];
 dependencyReason?:string;pressurePreventionReason?:string;confidence:number;
 headline:string;reasons:Reason[];
}
export type Gate='safety'|'non_negotiable'|'overdue';
export type TimingLabel='Worth doing now'|'Good to do this week'|'Coming up'|'Later is fine'|'Waiting'|'Bear is handling it'|'Nothing needed yet'|'Sorted';

export interface PriorityInput{
 id:string;title:string;pattern:PatternId;area:AreaKey;flags:string[];
 // The remaining human action (after ownership): null when Bear or someone else has it all.
 human:{kind:HumanActionKind;label:string;dueAt:string|null;surfaceFrom:string|null}|null;
 waitingOn:string|null;resolved:boolean;
 deadline:string|null;          // the date the load itself is due / expires / happens
 dependents:number;             // pending steps that wait on the human action
 bearSteps:number;              // steps Bear genuinely carries (remember, monitor, follow up)
 createdAt:string;postpones:number;snoozedUntil:string|null;
 importanceOverride:'very'|'nice'|'not'|null;
 projectPriority:'now'|'soon'|'later'|'none'|null;
 text:string;                   // title + notes, for lead-time and keyword reading
 // The person marked it "no rush": held quietly, never pushed (labelled "Later is fine").
 quiet?:boolean;
}
export interface PriorityContext{
 today:string;availableMinutes:number|null;dayMode:'good'|'full'|'wiped'|'chaos'|null;
 values:ValuesGoalsMap;struggles:string[];strengths:string[];
 learned:Record<string,number>;           // loadMap.learned.choices
 otherDeadlines:string[];                 // for congestion
}
export interface PriorityResult{
 id:string;vector:PriorityVector;gates:Gate[];tier:number;
 latestSafeActionAt:string|null;latestComfortableActionAt:string|null;
 futurePressureRisk:number;pressurePreventionValue:number;dependencyLeverage:number;
 importance:number;globalPriority:number;actionPriority:number;
 trajectory:{today:number;in7:number;in14:number};
 surfaceNow:boolean;support:'normal'|'prepare_more';firstStep:string|null;minutes:number;action:string|null;deadline:string|null;bearSteps:number;
 timingLabel:TimingLabel;explanation:PriorityExplanation;
 askImportance:boolean;
}
