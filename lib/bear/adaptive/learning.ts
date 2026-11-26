// Adaptive Responsibility Engine: what Bear learns from her choices, kept in four separate, small stores she can inspect,
// correct or reset: where she files things (categories), which kinds of help she takes (strategies), when she tends to
// finish things (timing), and how she likes to hear from Bear (communication, in Settings). Her explicit choices always
// beat inferred ones, and a change in what Bear has learned never moves things she has already filed.
// Dismissals are read cautiously: "not now" says nothing about motivation.
import type {Attributes} from './attributes.ts';

export type StrategyId='allocate'|'prioritise'|'synchronise'|'adapt'|'match'|'offload'|'protect';
export const FEEDBACK=['helped','wrong_moment','too_much_effort','rather_bear','dont_suggest'] as const;
export type Feedback=typeof FEEDBACK[number];
export interface CategoryCorrection{pattern:string;domain:string;tags:string[];suggested:string|null;chosen:string;explicit:boolean;at:string}
export interface AdaptiveLearning{
 category:{key:string;listId:string;n:number;explicit:boolean;at:string}[];corrections:CategoryCorrection[];
 strategy:Partial<Record<StrategyId,{yes:number;no:number}>>;timing:number[];
 feedback:{kind:Feedback;strategy:StrategyId|null;pattern:string|null;at:string}[];
 suppressed:{pattern:string;domain:string;at:string}[];lastFeedbackAskAt:string|null;
}
export const emptyLearning=():AdaptiveLearning=>({category:[],corrections:[],strategy:{},timing:Array(24).fill(0),feedback:[],suppressed:[],lastFeedbackAskAt:null});
const keysOf=(a:Pick<Attributes,'pattern'|'domain'|'contextTags'>)=>[`pd:${a.pattern}|${a.domain}`,`d:${a.domain}`,`p:${a.pattern}`,...a.contextTags.map(t=>`t:${t}`)];
const WEIGHT=(k:string)=>k.startsWith('pd:')?3:k.startsWith('d:')?2:1;

// She moved something into a list. Explicit moves teach Bear; Bear's own guesses never do (so its rules can't reinforce themselves).
export function learnCategory(l:AdaptiveLearning|null|undefined,a:Pick<Attributes,'pattern'|'domain'|'contextTags'>,suggested:string|null,chosen:string,explicit:boolean,at:string):AdaptiveLearning{
 const x={...emptyLearning(),...(l||{})};
 const corrections=[{pattern:a.pattern,domain:a.domain,tags:a.contextTags.slice(0,6),suggested,chosen,explicit,at},...x.corrections].slice(0,200);
 if(!explicit)return {...x,corrections};
 const category=[...x.category];
 for(const key of keysOf(a)){const i=category.findIndex(c=>c.key===key&&c.listId===chosen);
  if(i>=0)category[i]={...category[i],n:category[i].n+1,explicit:true,at};else category.push({key,listId:chosen,n:1,explicit:true,at});}
 return {...x,category:category.sort((p,q)=>q.at.localeCompare(p.at)).slice(0,400),corrections};
}
// What her corrections say about a new responsibility like this one: a list, once the evidence is real (the same kind of
// thing filed the same way at least twice, and clearly ahead of any other list).
export function learnedList(l:AdaptiveLearning|null|undefined,a:Pick<Attributes,'pattern'|'domain'|'contextTags'>,listIds:Set<string>):{listId:string;score:number}|null{
 if(!l?.category.length)return null;const keys=new Set(keysOf(a));const score=new Map<string,number>();const top=new Map<string,number>();
 for(const c of l.category){if(!c.explicit||!keys.has(c.key)||!listIds.has(c.listId))continue;score.set(c.listId,(score.get(c.listId)||0)+WEIGHT(c.key)*Math.min(c.n,5));
  if(c.key.startsWith('pd:')||c.key.startsWith('d:'))top.set(c.listId,Math.max(top.get(c.listId)||0,c.n));}
 const ranked=[...score.entries()].sort((p,q)=>q[1]-p[1]);if(!ranked.length)return null;const [id,s]=ranked[0];const second=ranked[1]?.[1]||0;
 return (top.get(id)||0)>=2&&s>=second*1.5?{listId:id,score:s}:null;
}
export function learnStrategy(l:AdaptiveLearning|null|undefined,s:StrategyId,accepted:boolean):AdaptiveLearning{
 const x={...emptyLearning(),...(l||{})};const cur=x.strategy[s]||{yes:0,no:0};
 return {...x,strategy:{...x.strategy,[s]:accepted?{...cur,yes:Math.min(cur.yes+1,200)}:{...cur,no:Math.min(cur.no+1,200)}}};
}
// A gentle preference between -1 and 1 from what she has taken up before (needs a few choices before it counts).
export function strategyPreference(l:AdaptiveLearning|null|undefined,s:StrategyId){const c=l?.strategy?.[s];if(!c||c.yes+c.no<3)return 0;return Math.round(((c.yes-c.no)/(c.yes+c.no))*100)/100;}
export function learnTiming(l:AdaptiveLearning|null|undefined,hour:number):AdaptiveLearning{const x={...emptyLearning(),...(l||{})};const t=[...(x.timing?.length===24?x.timing:Array(24).fill(0))];t[hour]=Math.min((t[hour]||0)+1,999);return {...x,timing:t};}
export function learnFeedback(l:AdaptiveLearning|null|undefined,kind:Feedback,ctx:{strategy:StrategyId|null;pattern:string|null;domain:string|null},at:string):AdaptiveLearning{
 let x={...emptyLearning(),...(l||{})};x={...x,feedback:[{kind,strategy:ctx.strategy,pattern:ctx.pattern,at},...x.feedback].slice(0,100),lastFeedbackAskAt:at};
 if(kind==='dont_suggest'&&ctx.pattern)x={...x,suppressed:[{pattern:ctx.pattern,domain:ctx.domain||'general',at},...x.suppressed.filter(s=>!(s.pattern===ctx.pattern&&s.domain===(ctx.domain||'general')))].slice(0,50)};
 if(ctx.strategy&&(kind==='helped'||kind==='rather_bear'))x=learnStrategy(x,ctx.strategy,true);
 if(ctx.strategy&&kind==='too_much_effort')x=learnStrategy(x,ctx.strategy,false);
 if(kind==='rather_bear')x=learnStrategy(x,'offload',true);
 return x;
}
export const isSuppressed=(l:AdaptiveLearning|null|undefined,a:Pick<Attributes,'pattern'|'domain'>)=>!!l?.suppressed?.some(s=>s.pattern===a.pattern&&s.domain===a.domain);
// Ask for optional feedback at most once a day, and never twice in a row.
export const mayAskFeedback=(l:AdaptiveLearning|null|undefined,now:Date)=>!l?.lastFeedbackAskAt||now.getTime()-Date.parse(l.lastFeedbackAskAt)>20*3600000;
export function resetLearning(l:AdaptiveLearning|null|undefined,what:'category'|'strategy'|'timing'|'feedback'|'all'):AdaptiveLearning{
 const x={...emptyLearning(),...(l||{})};const e=emptyLearning();
 if(what==='all')return e;if(what==='category')return {...x,category:[],corrections:[]};if(what==='strategy')return {...x,strategy:{}};
 if(what==='timing')return {...x,timing:e.timing};return {...x,feedback:[],suppressed:[],lastFeedbackAskAt:null};
}
// The hours she most often finishes things (for Synchronise), once there is enough to go on.
export function usualHours(l:AdaptiveLearning|null|undefined):number[]{const t=l?.timing||[];const total=t.reduce((a,b)=>a+b,0);if(total<8)return [];
 return t.map((n,h)=>({n,h})).filter(x=>x.n>=Math.max(2,total*.12)).sort((a,b)=>b.n-a.n).slice(0,3).map(x=>x.h);}
