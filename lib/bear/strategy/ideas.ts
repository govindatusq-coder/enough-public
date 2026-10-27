import type {DayMode,Profile} from '../domain/types.ts';

// Bear Ideas: one orchestration layer. Candidates come from the existing pattern suggestions (bills,
// recurring, discounts), the Mental Load Opportunity Engine, the Priority Engine and the Strategic
// Attention Engine. They compete on how much thinking they take off the person versus the attention
// they cost. Bear Ideas is not a priority list and not an inbox: at most five, usually fewer, and
// sometimes nothing. Pure: no store, no clock.
export type IdeaFamily='load'|'priority'|'strategic';
export type IdeaType=
 // Family A: mental-load reduction (the original purpose of Bear Ideas).
 'remember'|'monitor'|'prepare'|'follow_up'|'take_over'|'simplify'|'recurring_pattern'|'save_money'|'prevent'|'reduce_coordination'|'reduce_decisions'
 // Family B: priority (moved here from My Bear).
 |'worth_doing_now'|'prevent_future_pressure'|'unlock_project'|'close_loop'
 // Family C: strategic attention.
 |'protect_time'|'reprioritise'|'make_room_check';
export type IdeaActionKey='accept'|'reject'|'open'|'later'|'dismiss'|'make_room'|'not_this_week'|'protect'|'lower'|'pause'|'block_yes'|'block_no'|'take_over'|'copy';
export interface IdeaAction{key:IdeaActionKey;label:string;primary?:boolean}
// What an idea is worth (0–1 each). Internal only: never shown as numbers.
export interface IdeaScore{loadRemoved:number;pressure:number;strategic:number;decisions:number;money:number;leverage:number;effort:number;uncertainty:number;interruption:number}
export interface Idea{
 id:string;family:IdeaFamily;type:IdeaType;eyebrow:string;title:string;body:string;actions:IdeaAction[];
 href?:string|null;taskId?:string|null;projectId?:string|null;suggestionId?:string|null;suggestionKind?:string|null;
 draft?:string|null;chips?:string[];
 // Plain-language reasons, shown only when the person taps "Why this matters?".
 why?:{key:string;title:string;text:string}[];
 minutes:number|null;   // the person's time if they act on it; null when it only needs a yes
 critical?:boolean;     // a real deadline or safety: survives Chaos days and "nothing right now"
 entity:string;         // what it's about, for dedupe (a task, a project, a bill)
 score:IdeaScore;
}
export type Capacity=NonNullable<Profile['capacityToday']>['value'];
export interface OrchestrateOptions{today:string;history:Profile['ideaHistory'];capacity:Capacity|null;dayMode:DayMode|null;learned:Record<string,number>;max?:number;
 // Present self: the person has already carried a lot today. Silence is a valid answer.
 saturated?:boolean}
export interface Orchestrated{ideas:Idea[];considered:number;askCapacity:boolean;rested:boolean}

const clamp=(n:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,n));
// Idea value: thinking removed, pressure prevented, strategic progress, decisions saved, money and
// leverage, minus effort, uncertainty and the interruption itself.
export function ideaValue(s:IdeaScore){
 return s.loadRemoved+0.9*s.pressure+0.9*s.strategic+0.5*s.decisions+0.6*s.money+0.5*s.leverage-0.3*s.effort-0.3*s.uncertainty-0.2*s.interruption;
}
// Learning shapes HOW Bear helps (which kinds of idea are welcome), never WHETHER something matters:
// dismissing ideas about a project doesn't lower the project, and busyness never raises anything.
export function learnedMultiplier(type:IdeaType,family:IdeaFamily,learned:Record<string,number>){
 const yes=learned[`idea_yes:${type}`]||0,no=learned[`idea_no:${type}`]||0;
 return clamp(1+0.08*yes-0.12*no,family==='strategic'?0.75:0.5,1.3);
}
export function hiddenByHistory(id:string,history:Profile['ideaHistory'],today:string){
 const h=history?.[id];if(!h)return false;
 return !!h.until&&h.until>today;
}
const capMinutes:Record<Capacity,number>={'5':5,'15':15,'30':30,block:240,none:0};
const MIN_VALUE=0.3;

export function orchestrate(candidates:Idea[],o:OrchestrateOptions):Orchestrated{
 const max=Math.min(5,o.max??5);
 // 1. History: set aside, dismissed or just done → resting until its cooldown ends.
 let pool=candidates.filter(c=>!hiddenByHistory(c.id,o.history,o.today));
 // 2. Value, with learning.
 const value=new Map(pool.map(c=>[c.id,ideaValue(c.score)*learnedMultiplier(c.type,c.family,o.learned)+(o.capacity==='block'&&c.family==='strategic'?0.2:0)]));
 // 3. Dedupe: one idea per thing, the most useful one.
 const best=new Map<string,Idea>();for(const c of pool){const cur=best.get(c.entity);if(!cur||value.get(c.id)!>value.get(cur.id)!)best.set(c.entity,c);}
 pool=[...best.values()];
 const considered=pool.length;
 // 4. Attention budget: the day and the room the person said they have.
 let budget=max;
 if(o.dayMode==='chaos'||o.capacity==='none'||o.saturated){pool=pool.filter(c=>c.critical);budget=1;}
 else if(o.dayMode==='wiped')budget=Math.min(budget,2);
 else if(o.dayMode==='full')budget=Math.min(budget,3);
 if(o.capacity&&o.capacity!=='none'){const cap=capMinutes[o.capacity];pool=pool.filter(c=>c.critical||c.minutes===null||c.minutes<=cap);}
 // 5. Nothing useful → nothing.
 pool=pool.filter(c=>c.critical||value.get(c.id)!>=MIN_VALUE).sort((a,b)=>Number(!!b.critical)-Number(!!a.critical)||value.get(b.id)!-value.get(a.id)!);
 // 6. Diversity: at most two of a kind, two strategic, two priority; load-reduction ideas keep a seat.
 const out:Idea[]=[];const perType=new Map<string,number>();const perFamily=new Map<string,number>();
 const fits=(c:Idea)=>(perType.get(c.type)||0)<2&&(c.family==='load'||(perFamily.get(c.family)||0)<2);
 const take=(c:Idea)=>{out.push(c);perType.set(c.type,(perType.get(c.type)||0)+1);perFamily.set(c.family,(perFamily.get(c.family)||0)+1);};
 const reserved=budget>=2?pool.find(c=>c.family==='load'):undefined;
 for(const c of pool){if(out.length>=budget-(reserved&&!out.includes(reserved)?1:0))break;if(fits(c)||c===reserved)take(c);}
 if(reserved&&!out.includes(reserved)&&out.length<budget)take(reserved);
 // 7. Rank: anything critical first, then value.
 out.sort((a,b)=>Number(!!b.critical)-Number(!!a.critical)||value.get(b.id)!-value.get(a.id)!);
 // Ask "what have you got room for?" only when the answer would change which ideas show.
 const nonLoad=out.filter(c=>c.minutes!==null&&c.family!=='load');
 const askCapacity=!o.capacity&&o.dayMode!=='chaos'&&nonLoad.some(c=>c.minutes!<=15)&&pool.some(c=>c.minutes!==null&&c.minutes>30&&c.family!=='load');
 return {ideas:out,considered,askCapacity:askCapacity&&!o.saturated,rested:!!o.saturated&&out.length===0&&considered>0};
}
