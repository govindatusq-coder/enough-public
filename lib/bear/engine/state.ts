import type {Completion,Task} from '../domain/types.ts';
import {graphState} from '../load/engine.ts';
import type {ResponsibilityState,VerificationMethod} from './types.ts';

// The state machine. Transitions are validated deterministically; "verified" needs real evidence.
const EXEC:ResponsibilityState[]=['awaiting_approval','executing','awaiting_confirmation','failed','blocked'];
const T:Record<ResponsibilityState,ResponsibilityState[]>={
 identified:[...EXEC,'needs_clarification','planned','ready','in_progress','waiting','completed_unverified','verified','cancelled'],
 needs_clarification:[...EXEC,'planned','ready','in_progress','waiting','completed_unverified','verified','cancelled'],
 planned:[...EXEC,'needs_clarification','ready','in_progress','waiting','completed_unverified','verified','cancelled'],
 ready:[...EXEC,'needs_clarification','planned','in_progress','waiting','completed_unverified','verified','cancelled'],
 in_progress:[...EXEC,'needs_clarification','planned','ready','waiting','completed_unverified','verified','cancelled'],
 waiting:[...EXEC,'needs_clarification','planned','ready','in_progress','completed_unverified','verified','cancelled'],
 completed_unverified:[...EXEC,'verified','ready','in_progress','planned','closed','cancelled'],
 verified:['closed','ready','in_progress','planned'],
 closed:['ready','planned'],
 cancelled:['ready','planned'],
 // Execution states: reachable from the working states and from each other, and back out again. Never straight to closed.
 awaiting_approval:['needs_clarification','planned','ready','in_progress','waiting','completed_unverified','verified','cancelled',...EXEC],
 executing:['needs_clarification','planned','ready','in_progress','waiting','completed_unverified','verified','cancelled',...EXEC],
 awaiting_confirmation:['needs_clarification','planned','ready','in_progress','waiting','completed_unverified','verified','cancelled',...EXEC],
 failed:['needs_clarification','planned','ready','in_progress','waiting','completed_unverified','cancelled',...EXEC],
 blocked:['needs_clarification','planned','ready','in_progress','waiting','completed_unverified','cancelled',...EXEC],
};
export const canTransition=(from:ResponsibilityState|null,to:ResponsibilityState)=>from===null?to!=='closed':from===to||T[from].includes(to);
export interface TransitionCheck{ok:boolean;reason?:'invalid_transition'|'verification_needs_evidence'}
// A reminder firing, a draft, a deadline passing, opening the app or a model's guess is never evidence.
export function checkTransition(from:ResponsibilityState|null,to:ResponsibilityState,verification?:VerificationMethod|null):TransitionCheck{
 if(!canTransition(from,to))return {ok:false,reason:'invalid_transition'};
 if(to==='verified'&&!verification)return {ok:false,reason:'verification_needs_evidence'};
 return {ok:true};
}
export function verificationOf(c:Completion|null|undefined):VerificationMethod|null{
 const e=c?.evidence;if(!e)return null;
 if(e.level==='user_confirmed')return 'user_confirmation';
 if(e.level==='confirmed')return e.source==='email'?'forwarded_email':e.source==='provider'?'integration':'document';
 return null;
}
// What state a responsibility is really in, from the load graph and completion evidence.
// What the execution log says about the actions Bear has put to the person or sent: the worst unresolved one wins.
export type ExecSummary='failed'|'executing'|'awaiting_approval'|'awaiting_confirmation'|'blocked'|null;
export function stateOf(task:Task,completion?:Completion|null,today?:string,exec:ExecSummary=null):ResponsibilityState{
 if(task.status==='dropped')return 'cancelled';
 if(task.status==='archived')return 'closed';
 if(exec&&task.status!=='done')return exec;
 if(task.status==='done')return verificationOf(completion)?'verified':'completed_unverified';
 const g=task.load;if(!g)return 'identified';
 const st=graphState(g);
 const steps=g.nodes.flatMap(n=>n.steps);
 if(st==='resolved')return 'completed_unverified';
 if(st==='captured'&&(steps.some(s=>s.key.startsWith('need_')&&s.status==='pending')||g.nodes.some(n=>n.clarification&&!n.evidence.some(e=>e.key==='clarified'))))return 'needs_clarification';
 if(st==='waiting')return 'waiting';
 const humanDone=steps.some(s=>s.owner==='human'&&s.status==='done');
 const humanNow=steps.some(s=>s.owner==='human'&&s.status==='pending'&&(!s.surfaceFrom||!today||s.surfaceFrom<=today));
 if(humanDone&&steps.some(s=>s.owner==='human'&&s.status==='pending'))return 'in_progress';
 if(humanNow||st==='needs_user')return 'ready';
 return 'planned';
}
// Plain words for the person (the state names stay internal).
export const stateWords:Record<ResponsibilityState,string>={
 identified:'Bear has it.',needs_clarification:'One quick question first.',planned:'Bear has it planned.',ready:'One thing needs you.',
 in_progress:'Under way.',waiting:'Waiting to hear back.',completed_unverified:'Looks done. Just waiting for confirmation.',
 verified:'Done.',closed:'Done and closed off.',cancelled:'No longer needed.',
 awaiting_approval:'Ready for you to look over.',executing:'Bear’s doing it now.',awaiting_confirmation:'Sent. Waiting for confirmation.',failed:'That didn’t go through. Nothing was done.',blocked:'Stuck until something changes.',
};
