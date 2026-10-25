"use client";
import type {State} from '@/lib/journey';
import type {LifeMap} from '@/lib/life-map';
import type {Ranked} from '@/lib/opportunity-engine';
import {recordFeedback,addReason,planMoment,resolveMoment,type RejectReason,type Situation,type Surface} from '@/lib/opportunity-log';
import {answerQuestion,dismissQuestion} from '@/lib/profiling';

export type OpportunityActions=ReturnType<typeof opportunityActions>;
/** Every Life Map change goes through here, so the page only passes its state updater. */
export function opportunityActions(update:(fn:(s:State)=>State)=>void){
 const stamp=(map:LifeMap):LifeMap=>({...map,updatedAt:new Date().toISOString()});
 return {
  setLifeMap:(map:LifeMap)=>update(s=>({...s,lifeMap:stamp(map)})),
  accept:(r:Ranked,surface:Surface,situation?:Situation)=>update(s=>({...s,
   opportunityFeedback:recordFeedback(s.opportunityFeedback,{opportunityId:r.opportunity.id,response:'accept',surface,situation,lifeMap:s.lifeMap}),
   opportunityMoments:surface==='onboarding'?s.opportunityMoments:planMoment(s.opportunityMoments,r.opportunity.id,r.minutes)})),
  reject:(r:Ranked,surface:Surface,situation?:Situation,reason?:RejectReason)=>update(s=>{const events=recordFeedback(s.opportunityFeedback,{opportunityId:r.opportunity.id,response:'reject',surface,situation,lifeMap:s.lifeMap});return {...s,opportunityFeedback:reason?addReason(events,r.opportunity.id,reason):events};}),
  reason:(opportunityId:string,reason:RejectReason)=>update(s=>({...s,opportunityFeedback:addReason(s.opportunityFeedback,opportunityId,reason)})),
  resolve:(momentId:string,happened:boolean)=>update(s=>({...s,opportunityMoments:resolveMoment(s.opportunityMoments,momentId,happened)})),
  answer:(questionId:string,answer:string)=>update(s=>s.lifeMap?{...s,lifeMap:answerQuestion(s.lifeMap,questionId,answer)}:s),
  dismiss:(questionId:string)=>update(s=>s.lifeMap?{...s,lifeMap:dismissQuestion(s.lifeMap,questionId)}:s)
 };
}
