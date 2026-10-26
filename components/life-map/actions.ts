"use client";
import type {State} from '@/lib/journey';
import {localDay,type LifeMap} from '@/lib/life-map';
import type {Ranked} from '@/lib/opportunity-engine';
import {recordFeedback,addReason,planMoment,resolveMoment,type RejectReason,type Situation,type Surface} from '@/lib/opportunity-log';
import {answerQuestion,dismissQuestion} from '@/lib/profiling';
import {upsertCommitment,changeCommitment,type AdaptiveMovementCommitment,type CommitmentStatus,type InviteMode} from '@/lib/goal-fitting';
import {recordCheckIn,addNotTodayReason,recordReview,type CheckIn,type NotTodayReason,type ReviewChoice} from '@/lib/follow-through';

export type OpportunityActions=ReturnType<typeof opportunityActions>;
/** Every Life Map change goes through here, so the page only passes its state updater. */
export function opportunityActions(update:(fn:(s:State)=>State)=>void){
 const stamp=(map:LifeMap):LifeMap=>({...map,updatedAt:new Date().toISOString()});
 return {
  setLifeMap:(map:LifeMap)=>update(s=>({...s,lifeMap:stamp(map)})),
  // "I'd do that" records exactly what it always has. Goal fitting starts after, from the page.
  accept:(r:Ranked,surface:Surface,situation?:Situation)=>update(s=>({...s,
   opportunityFeedback:recordFeedback(s.opportunityFeedback,{opportunityId:r.opportunity.id,response:'accept',surface,situation,lifeMap:s.lifeMap}),
   opportunityMoments:surface==='onboarding'?s.opportunityMoments:planMoment(s.opportunityMoments,r.opportunity.id,r.minutes)})),
  reject:(r:Ranked,surface:Surface,situation?:Situation,reason?:RejectReason)=>update(s=>{const events=recordFeedback(s.opportunityFeedback,{opportunityId:r.opportunity.id,response:'reject',surface,situation,lifeMap:s.lifeMap});return {...s,opportunityFeedback:reason?addReason(events,r.opportunity.id,reason):events};}),
  reason:(opportunityId:string,reason:RejectReason)=>update(s=>({...s,opportunityFeedback:addReason(s.opportunityFeedback,opportunityId,reason)})),
  resolve:(momentId:string,happened:boolean)=>update(s=>({...s,opportunityMoments:resolveMoment(s.opportunityMoments,momentId,happened)})),
  answer:(questionId:string,answer:string)=>update(s=>s.lifeMap?{...s,lifeMap:answerQuestion(s.lifeMap,questionId,answer)}:s),
  dismiss:(questionId:string)=>update(s=>s.lifeMap?{...s,lifeMap:dismissQuestion(s.lifeMap,questionId)}:s),

  // ── Follow-through (adaptiveGoalFittingV1) ──
  /** Saves a fitted commitment. Saying yes to the idea counts as saying yes for today, so the first check-in follows. */
  adopt:(commitment:AdaptiveMovementCommitment,map?:LifeMap)=>update(s=>{
   const withLink=commitment.plannedMomentId?commitment:{...commitment,plannedMomentId:(s.opportunityMoments||[]).filter(m=>m.opportunityId===commitment.originalSuggestionId&&m.status==='planned').at(-1)?.id};
   const parts=recordCheckIn({commitments:upsertCommitment(s.commitments,withLink),events:s.followThrough,moments:s.opportunityMoments},{commitmentId:withLink.id,kind:'accepted',source:'fitting'});
   return {...s,...(map?{lifeMap:stamp(map)}:{}),commitments:parts.commitments,followThrough:parts.events};
  }),
  /** "I'd do that" on something already adopted: link the fresh planned moment and count it as a yes for today. */
  again:(commitmentId:string)=>update(s=>{
   const commitments=(s.commitments||[]).map(c=>{if(c.id!==commitmentId)return c;const latest=(s.opportunityMoments||[]).filter(m=>m.opportunityId===c.originalSuggestionId&&m.status==='planned').at(-1);return {...c,status:c.status==='paused'?'active' as const:c.status,...(latest?{plannedMomentId:latest.id}:{})};});
   const parts=recordCheckIn({commitments,events:s.followThrough,moments:s.opportunityMoments},{commitmentId,kind:'accepted',source:'invitation'});
   return {...s,commitments:parts.commitments,followThrough:parts.events};
  }),
  checkIn:(input:CheckIn)=>update(s=>{const parts=recordCheckIn({commitments:s.commitments,events:s.followThrough,moments:s.opportunityMoments},input);return {...s,commitments:parts.commitments,followThrough:parts.events,opportunityMoments:parts.moments};}),
  notTodayReason:(commitmentId:string,reason:NotTodayReason)=>update(s=>({...s,followThrough:addNotTodayReason(s.followThrough,commitmentId,reason)})),
  review:(commitmentId:string,choice:ReviewChoice,offer?:number)=>update(s=>{const parts=recordReview({commitments:s.commitments,events:s.followThrough},commitmentId,choice,new Date(),offer);return {...s,commitments:parts.commitments,followThrough:parts.events};}),
  change:(commitmentId:string,patch:{usual?:number;invite?:InviteMode;status?:CommitmentStatus})=>update(s=>({...s,commitments:(s.commitments||[]).map(c=>c.id===commitmentId?changeCommitment(c,patch):c)})),
  fullOnDay:(on:boolean)=>update(s=>{const next={...s};if(on)next.dayLoad={day:localDay(),load:'full-on'};else delete next.dayLoad;return next;})
 };
}
