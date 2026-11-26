// Adaptive Responsibility Engine: the temporal profile (Temporal Autonomy–Strategy Fit model).
// How much control she has over her time, how predictable it is, and what helps, as estimates between 0 and 1 with a
// confidence for each. Scored deterministically from her onboarding answers (no AI), versioned, and always editable.
// Never a label shown to her, and never inferred from nationality, gender, age or occupation.
// Low autonomy or many interruptions describe her circumstances, not a shortcoming.

export const PROFILE_VERSION='tp-1';
export const DIMENSIONS=['autonomy','predictability','interruptionTolerance','discretionaryTime','deferAbility','dependence',
 'cognitiveCapacity','delegationAccess','planningPreference','opportunisticPreference'] as const;
export type Dimension=typeof DIMENSIONS[number];
export type Archetype='planner'|'juggler'|'improviser'|'oncall';
export const ARCHETYPES:Archetype[]=['planner','juggler','improviser','oncall'];

// The onboarding answers, as stored. Every one is optional.
export const CONTROL=['plan_own','fixed_routine','flexible_changing','depends_others','depends_day'] as const;
export const HOW_DONE=['in_advance','routine','grab_moment','when_urgent','someone_helps'] as const;
export const BARRIERS=['competing','not_enough_time','interruptions','exhausted','depend_on_others','remembering','getting_started','following_up'] as const;
export const ASSIST=['organise','what_needs_attention','find_moments','prepare','share','take_off_plate'] as const;
export const HELPERS=['regularly','sometimes_if_organised','rarely','independent','depends'] as const;
export const COMMS=['only_when_open','daily_checkin','important_only','as_i_go'] as const;
export const COUNTRIES=['AU','CA','US','Other'] as const;
export interface TemporalAnswers{control?:typeof CONTROL[number]|null;howDone?:typeof HOW_DONE[number]|null;barriers?:(typeof BARRIERS[number])[];
 assist?:(typeof ASSIST[number])[];helpers?:typeof HELPERS[number]|null;comms?:typeof COMMS[number]|null;country?:typeof COUNTRIES[number]|null}

export interface TemporalProfile{
 version:string;answers:TemporalAnswers;
 // Typical circumstances and stable preferences, each 0–1, with how sure Bear is (0 = a neutral guess).
 dims:Record<Dimension,number>;confidence:Record<Dimension,number>;
 // A blend of the four internal starting profiles (sums to 1). Engineering only; never shown to her.
 mix:Record<Archetype,number>;
 // What she asked Bear to help with, and how she wants to hear from Bear. Notifications are never switched on from this.
 assist:(typeof ASSIST[number])[];comms:typeof COMMS[number]|null;
 scoredAt:string;
}
// Right now (a moment, not a trait): how long she has and how she feels, if she said. Kept for the session only.
export interface MomentaryState{minutes:number|null;unsure:boolean;at:string}

const clamp=(x:number)=>Math.max(0,Math.min(1,Math.round(x*100)/100));
type Effect=Partial<Record<Dimension,number>>;
// Q1 sets autonomy and predictability (the two principal axes) and how easily things can be put off.
const CONTROL_FX:Record<typeof CONTROL[number],{set:Effect;conf:number}>={
 plan_own:{set:{autonomy:.85,predictability:.7,deferAbility:.7,discretionaryTime:.6},conf:.8},
 fixed_routine:{set:{autonomy:.3,predictability:.85,deferAbility:.45,discretionaryTime:.4},conf:.8},
 flexible_changing:{set:{autonomy:.7,predictability:.3,deferAbility:.6,discretionaryTime:.5},conf:.8},
 depends_others:{set:{autonomy:.2,predictability:.25,deferAbility:.3,discretionaryTime:.3,dependence:.75},conf:.8},
 depends_day:{set:{autonomy:.5,predictability:.35,deferAbility:.5,discretionaryTime:.45},conf:.5},
};
// Q2: how things actually get done, mostly a preference (planning ahead versus grabbing moments).
const HOW_FX:Record<typeof HOW_DONE[number],{set:Effect;nudge?:Effect}>={
 in_advance:{set:{planningPreference:.85,opportunisticPreference:.25},nudge:{predictability:.05,autonomy:.05}},
 routine:{set:{planningPreference:.55,opportunisticPreference:.3},nudge:{predictability:.05}},
 grab_moment:{set:{planningPreference:.2,opportunisticPreference:.9},nudge:{predictability:-.05}},
 when_urgent:{set:{planningPreference:.2,opportunisticPreference:.5},nudge:{deferAbility:-.1,cognitiveCapacity:-.05}},
 someone_helps:{set:{planningPreference:.4,opportunisticPreference:.4},nudge:{delegationAccess:.2}},
};
// Q3: what gets in the way adjusts the typical circumstances a little (never a judgement).
const BARRIER_FX:Record<typeof BARRIERS[number],Effect>={
 competing:{cognitiveCapacity:-.1},not_enough_time:{discretionaryTime:-.2},interruptions:{interruptionTolerance:-.3},
 exhausted:{cognitiveCapacity:-.2},depend_on_others:{dependence:.2,autonomy:-.05},remembering:{},getting_started:{},following_up:{},
};
const HELPERS_FX:Record<typeof HELPERS[number],{v:number;conf:number}>={regularly:{v:.85,conf:.8},sometimes_if_organised:{v:.55,conf:.8},rarely:{v:.2,conf:.8},independent:{v:.1,conf:.8},depends:{v:.5,conf:.5}};

export function scoreProfile(a:TemporalAnswers,now=new Date()):TemporalProfile{
 const dims=Object.fromEntries(DIMENSIONS.map(d=>[d,.5])) as Record<Dimension,number>;
 const confidence=Object.fromEntries(DIMENSIONS.map(d=>[d,0])) as Record<Dimension,number>;
 dims.interruptionTolerance=.55;
 const set=(fx:Effect,conf:number)=>{for(const [k,v] of Object.entries(fx) as [Dimension,number][]){dims[k]=v;confidence[k]=Math.max(confidence[k],conf);}};
 const nudge=(fx:Effect,conf:number)=>{for(const [k,v] of Object.entries(fx) as [Dimension,number][]){dims[k]+=v;confidence[k]=Math.max(confidence[k],conf);}};
 if(a.control&&CONTROL_FX[a.control])set(CONTROL_FX[a.control].set,CONTROL_FX[a.control].conf);
 if(a.howDone&&HOW_FX[a.howDone]){set(HOW_FX[a.howDone].set,.7);if(HOW_FX[a.howDone].nudge)nudge(HOW_FX[a.howDone].nudge!,.3);}
 for(const b of a.barriers||[])if(BARRIER_FX[b])nudge(BARRIER_FX[b],.5);
 if(a.helpers&&HELPERS_FX[a.helpers]){dims.delegationAccess=HELPERS_FX[a.helpers].v+(a.howDone==='someone_helps'?.1:0);confidence.delegationAccess=HELPERS_FX[a.helpers].conf;}
 for(const d of DIMENSIONS)dims[d]=clamp(dims[d]);
 // The blend: bilinear in autonomy (a) and predictability (p), so it always sums to 1 and moves smoothly.
 const A=dims.autonomy,P=dims.predictability;
 const mix={planner:clamp(A*P),juggler:clamp((1-A)*P),improviser:clamp(A*(1-P)),oncall:clamp((1-A)*(1-P))};
 return {version:PROFILE_VERSION,answers:a,dims,confidence,mix,assist:[...(a.assist||[])],comms:a.comms??null,scoredAt:now.toISOString()};
}
export const dominant=(p:TemporalProfile|null|undefined):Archetype|null=>{if(!p)return null;const [k,v]=Object.entries(p.mix).sort((x,y)=>y[1]-x[1])[0] as [Archetype,number];return v>=.3?k:null;};
// How sure Bear is overall about how her time works (the two principal axes).
export const profileConfidence=(p:TemporalProfile|null|undefined)=>p?Math.round(((p.confidence.autonomy+p.confidence.predictability)/2)*100)/100:0;

// The warm explanation shown at the end of onboarding: written from the scored profile, never from a label.
export function explainProfile(p:TemporalProfile):string{
 const d=p.dims;const parts:string[]=[];
 if(d.dependence>=.65||d.autonomy<=.3)parts.push('You’ve got a lot to fit around other people’s schedules.');
 else if(d.predictability>=.7&&d.autonomy<=.45)parts.push('Your days follow a pattern, even if it isn’t always yours to set.');
 else if(d.predictability<=.4&&d.autonomy>=.6)parts.push('You’ve got some freedom, but your days rarely go to plan.');
 else if(d.autonomy>=.7&&d.predictability>=.6)parts.push('You can usually plan your own time.');
 else parts.push('Every day is a bit different.');
 const help:string[]=[];
 if(d.predictability>=.7&&d.autonomy<=.45)help.push('organise things around your usual routines');
 if(d.autonomy>=.7&&d.predictability>=.6)help.push('help you plan ahead and protect time for what matters');
 if(d.opportunisticPreference>=.7||d.predictability<=.4)help.push('find things that fit when a moment comes up');
 if(p.assist.includes('prepare')||d.cognitiveCapacity<=.35||d.autonomy<=.3)help.push('prepare what I can, so you can just finish it');
 if(d.delegationAccess>=.5&&(p.assist.includes('share')||p.assist.includes('take_off_plate')))help.push('help you hand things to other people');
 if(d.interruptionTolerance<=.3)help.push('keep your place when you get interrupted');
 const list=(help.length?help:['keep track of things and bring them back when it suits you']).slice(0,3);
 const joined=list.length===1?list[0]:`${list.slice(0,-1).join(', ')} and ${list[list.length-1]}`;
 return `${parts[0]} I’ll ${joined}.`;
}
