import {z} from 'zod';
import {lifeContexts,extraTimeChoices,type LifeContext,type ExtraTime,type LifeMap} from './life-map.ts';
import {opportunityById,extraFor} from './opportunities.ts';

/**
 * Lightweight feedback and "did it happen?" records. Each event carries the
 * opportunity, where it was shown, the answer, an optional reason, a timestamp
 * and the Life Map state that produced it, so the same records can later feed
 * aggregate learning across people.
 */
export const situations=['working','waiting','kids','home','errands','call','watching','going-somewhere','break','other'] as const;
export type Situation=typeof situations[number];
export const rejectReasons=['wrong-moment','too-much-effort','dislike-type','too-long','cant-here','not-my-thing'] as const;
export type RejectReason=typeof rejectReasons[number];
export const rejectReasonLabels:Record<RejectReason,string>={'wrong-moment':'Wrong moment','too-much-effort':'Too much effort','dislike-type':'Don’t like this kind of movement','too-long':'Takes too long','cant-here':'Can’t do that here','not-my-thing':'Just not my thing'};
export const surfaces=['onboarding','home','right-now','browse'] as const;
export type Surface=typeof surfaces[number];

export type FeedbackEvent={id:string;opportunityId:string;response:'accept'|'reject';reason?:RejectReason;surface:Surface;situation?:Situation;at:string;profile:{contexts:LifeContext[];extraTime:ExtraTime}};
export type OpportunityMoment={id:string;opportunityId:string;status:'planned'|'done'|'skipped';plannedAt:string;doneAt?:string;minutes:number;extraMinutes:number};

const iso=z.string().datetime({offset:true});
const opportunityId=z.string().min(1).max(60).refine(id=>!!opportunityById(id),'Unknown opportunity');
export const feedbackEventSchema=z.object({id:z.string().min(1).max(100),opportunityId,response:z.enum(['accept','reject']),reason:z.enum(rejectReasons).optional(),surface:z.enum(surfaces),situation:z.enum(situations).optional(),at:iso,profile:z.object({contexts:z.array(z.enum(lifeContexts)).max(lifeContexts.length),extraTime:z.enum(extraTimeChoices)}).strict()}).strict();
export const opportunityMomentSchema=z.object({id:z.string().min(1).max(100),opportunityId,status:z.enum(['planned','done','skipped']),plannedAt:iso,doneAt:iso.optional(),minutes:z.number().int().min(0).max(120),extraMinutes:z.number().int().min(0).max(60)}).strict().refine(m=>m.status!=='done'||!!m.doneAt,'Done moments need a time');
export const MAX_FEEDBACK=600,MAX_MOMENTS=1000;

const newId=()=>globalThis.crypto?.randomUUID?globalThis.crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36);

export function recordFeedback(events:FeedbackEvent[]|undefined,input:{opportunityId:string;response:'accept'|'reject';surface:Surface;situation?:Situation;lifeMap?:LifeMap;now?:Date}):FeedbackEvent[]{
 const event:FeedbackEvent={id:newId(),opportunityId:input.opportunityId,response:input.response,surface:input.surface,...(input.situation?{situation:input.situation}:{}),at:(input.now||new Date()).toISOString(),profile:{contexts:[...(input.lifeMap?.contexts||[])],extraTime:input.lifeMap?.extraTime||'few'}};
 return [...(events||[]),event].slice(-MAX_FEEDBACK);
}
/** Attach an optional reason to the most recent rejection of an opportunity. */
export function addReason(events:FeedbackEvent[]|undefined,opportunityId:string,reason:RejectReason):FeedbackEvent[]{
 const list=[...(events||[])];
 for(let i=list.length-1;i>=0;i--)if(list[i].opportunityId===opportunityId&&list[i].response==='reject'){list[i]={...list[i],reason};break;}
 return list;
}

export function planMoment(moments:OpportunityMoment[]|undefined,opportunityId:string,minutes:number,now=new Date()):OpportunityMoment[]{
 const o=opportunityById(opportunityId);if(!o)return moments||[];
 const existing=(moments||[]).filter(m=>!(m.opportunityId===opportunityId&&m.status==='planned'));
 return [...existing,{id:newId(),opportunityId,status:'planned' as const,plannedAt:now.toISOString(),minutes,extraMinutes:extraFor(o,minutes)}].slice(-MAX_MOMENTS);
}
export function resolveMoment(moments:OpportunityMoment[]|undefined,id:string,happened:boolean,minutes?:number,now=new Date()):OpportunityMoment[]{
 return (moments||[]).map(m=>{
  if(m.id!==id||m.status!=='planned')return m;
  if(!happened)return {...m,status:'skipped' as const};
  const o=opportunityById(m.opportunityId)!,mins=Math.max(1,Math.min(120,Math.round(minutes??m.minutes)));
  return {...m,status:'done' as const,doneAt:now.toISOString(),minutes:mins,extraMinutes:Math.min(60,extraFor(o,mins))};
 });
}
export const plannedMoments=(moments:OpportunityMoment[]|undefined)=>(moments||[]).filter(m=>m.status==='planned');

type LegacyEntry={status:string;completedAt?:string;minutes?:number;timeCombined?:number;connecting?:boolean;gave?:string[]};
export type GaveBack={found:number;insideExisting:number;extraUsed:number;useful:number;withPeople:number;moments:number};
/**
 * "What movement gave back" for a period. Counts only things the person said
 * happened: done opportunity moments plus confirmed outcomes from the classic
 * library. Nothing is inferred from planning.
 */
export function movementGaveBack(moments:OpportunityMoment[]|undefined,entries:LegacyEntry[]|undefined,since:Date,now=new Date()):GaveBack{
 const out:GaveBack={found:0,insideExisting:0,extraUsed:0,useful:0,withPeople:0,moments:0};
 for(const m of moments||[]){
  if(m.status!=='done'||!m.doneAt)continue;const at=new Date(m.doneAt);if(at<since||at>now)continue;
  const o=opportunityById(m.opportunityId);if(!o)continue;
  out.moments++;out.found+=m.minutes;out.extraUsed+=Math.min(m.extraMinutes,m.minutes);out.insideExisting+=Math.max(0,m.minutes-m.extraMinutes);
  if(o.movementTypes.includes('useful'))out.useful++;
  if(o.movementTypes.includes('people'))out.withPeople++;
 }
 for(const e of entries||[]){
  if(e.status!=='completed'||!e.completedAt)continue;const at=new Date(e.completedAt);if(at<since||at>now)continue;
  const minutes=e.minutes||0,inside=Math.min(minutes,e.timeCombined||0);
  out.moments++;out.found+=minutes;out.insideExisting+=inside;out.extraUsed+=minutes-inside;
  if(e.gave?.includes('task_completed'))out.useful++;
  if(e.connecting)out.withPeople++;
 }
 return out;
}
export function periodStart(period:'This week'|'This month'|'All time',now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);
 if(period==='This week')start.setDate(start.getDate()-((start.getDay()+6)%7));else if(period==='This month')start.setDate(1);else start.setTime(0);
 return start;
}
