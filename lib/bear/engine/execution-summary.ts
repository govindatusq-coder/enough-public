import type {ResponsibilityEvent} from './types.ts';
import type {ExecSummary} from './state.ts';

// What the append-only log says about each action, by idempotency key. Pure: no storage, no network.
// "accepted" is never "confirmed": a provider taking an action is not proof the outcome happened.
export type ApprovalStatus='none'|'requested'|'granted'|'declined'|'expired'|'revoked';
export type ExecutionStatus='none'|'started'|'accepted'|'confirmed'|'failed'|'unknown';
export const STUCK_MS=10*60*1000;
const byKey=(events:ResponsibilityEvent[],key:string)=>events.filter(e=>e.metadata?.key===key);
export function approvalStatus(events:ResponsibilityEvent[],key:string,now=new Date()):ApprovalStatus{
 const ev=byKey(events,key).filter(e=>['approval_requested','approval_granted','approval_declined','approval_revoked'].includes(e.eventType));
 const last=ev[ev.length-1];if(!last)return 'none';
 const requested=[...ev].reverse().find(e=>e.eventType==='approval_requested');
 if(last.eventType==='approval_declined')return 'declined';if(last.eventType==='approval_revoked')return 'revoked';
 const expires=requested?.metadata?.expiresAt;if(typeof expires==='string'&&new Date(expires).getTime()<=now.getTime())return 'expired';
 return last.eventType==='approval_granted'?'granted':'requested';
}
export function executionStatus(events:ResponsibilityEvent[],key:string):{status:ExecutionStatus;attempts:number;retrySafe:boolean;lastAt:string|null}{
 const ev=byKey(events,key).filter(e=>e.eventType.startsWith('execution_')||e.eventType==='action_failed');
 const attempts=ev.filter(e=>e.eventType==='execution_started').length;const last=ev[ev.length-1];
 if(!last)return {status:'none',attempts:0,retrySafe:false,lastAt:null};
 const lastAt=last.at;
 if(ev.some(e=>e.eventType==='execution_confirmed'))return {status:'confirmed',attempts,retrySafe:false,lastAt};
 if(last.eventType==='execution_accepted')return {status:'accepted',attempts,retrySafe:false,lastAt};
 if(last.eventType==='action_failed')return {status:'failed',attempts,retrySafe:last.metadata?.retrySafe===true,lastAt};
 if(last.eventType==='execution_unknown')return {status:'unknown',attempts,retrySafe:false,lastAt};
 return {status:'started',attempts,retrySafe:false,lastAt};   // started with no outcome: a crash or timeout; nobody knows
}
// The worst unresolved thing wins, so the person is never told "done" while something is wrong.
export function summariseExecution(events:ResponsibilityEvent[],now=new Date()):ExecSummary{
 const keys=[...new Set(events.map(e=>e.metadata?.key).filter((k):k is string=>typeof k==='string'))];
 let waitingConfirmation=false,approval=false,executing=false;
 for(const k of keys){const x=executionStatus(events,k);
  if(x.status==='failed'||x.status==='unknown')return 'failed';
  // Started and never finished for a long time means a crash or a lost reply, not "still going".
  if(x.status==='started'){if(x.lastAt&&now.getTime()-new Date(x.lastAt).getTime()>STUCK_MS)return 'failed';executing=true;}
  if(x.status==='accepted')waitingConfirmation=true;
  if(x.status==='none'){const a=approvalStatus(events,k,now);if(a==='requested'||a==='granted')approval=true;}}
 return executing?'executing':approval?'awaiting_approval':waitingConfirmation?'awaiting_confirmation':null;
}
