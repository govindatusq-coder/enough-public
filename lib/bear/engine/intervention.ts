import type {ResponsibilityState} from './types.ts';

// The intervention policy: when to interrupt and when to stay silent. It sits on top of the existing
// Priority Engine and notification decision engine (it doesn't replace them): given what they know, it
// picks one of a small set of moves, and silence is a first-class answer.
export type InterventionDecision='do_nothing'|'update_silently'|'prepare_action'|'request_clarification'|'request_approval'|'send_reminder'|'escalate';
export interface InterventionInput{
 state:ResponsibilityState;daysToDeadline:number|null;latestSafeIn:number|null;consequence:'low'|'medium'|'high';
 humanCanActNow:boolean;bearCanPrepare:boolean;preparedAlready:boolean;missingInfo:string[];canInferMissing:boolean;
 needsApproval:boolean;remindersToday:number;quietHours:boolean;dayMode:'good'|'full'|'wiped'|'chaos'|null;
 declinedRecently:boolean;newInformation:boolean;
}
export function decideIntervention(i:InterventionInput):{decision:InterventionDecision;reason:string}{
 if(['verified','closed','cancelled'].includes(i.state))return {decision:'do_nothing',reason:'nothing left to do'};
 if(i.newInformation&&!i.humanCanActNow&&i.missingInfo.length===0)return {decision:'update_silently',reason:'new information, nothing for the person yet'};
 // Before asking: is it known, inferable, can it wait, can Bear prepare without it?
 const urgent=i.latestSafeIn!==null&&i.latestSafeIn<=0;
 if(i.missingInfo.length&&!i.canInferMissing){
  if(i.bearCanPrepare&&!i.preparedAlready&&!urgent)return {decision:'prepare_action',reason:'prepare what can be prepared first'};
  if(urgent||(i.daysToDeadline!==null&&i.daysToDeadline<=7))return {decision:'request_clarification',reason:'one question, because it blocks progress soon'};
  return {decision:'do_nothing',reason:'the question can wait'};
 }
 if(i.needsApproval)return {decision:'request_approval',reason:'permission is needed before acting'};
 if(i.bearCanPrepare&&!i.preparedAlready)return {decision:'prepare_action',reason:'make the person’s part smaller first'};
 if(!i.humanCanActNow)return {decision:'do_nothing',reason:'nothing the person can do yet'};
 // A real deadline with a high consequence can come through a hard day or quiet hours, once.
 if(urgent&&i.consequence==='high')return {decision:i.remindersToday>=1?'escalate':'send_reminder',reason:'real deadline, real consequence'};
 if(i.quietHours||i.dayMode==='chaos'||i.declinedRecently||i.remindersToday>=2)return {decision:'do_nothing',reason:'protect attention'};
 if(i.dayMode==='wiped'&&!urgent)return {decision:'do_nothing',reason:'a gentler day'};
 if(urgent||(i.daysToDeadline!==null&&i.daysToDeadline<=2))return {decision:'send_reminder',reason:'the comfortable moment is now'};
 return {decision:'do_nothing',reason:'nothing adds value right now'};
}
