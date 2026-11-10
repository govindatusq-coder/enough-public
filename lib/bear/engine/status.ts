// What the person sees for one responsibility, in three presentations: Bear's on it / Just need you / All sorted.
// Derived from the real state and evidence, so the card can never say more than is true:
// "All sorted" needs a verified (or closed) responsibility WITH evidence. Nothing else, ever.
import type {ResponsibilityState} from './types.ts';
export type StatusKind='on_it'|'need_you'|'all_sorted';
export interface StatusInput{
 title:string;state:ResponsibilityState;
 nextAction?:{label:string;dueDate?:string|null}|null;
 prepared?:{label:string;value:string;done:boolean}[];
 bearHandling?:string[];
 verification?:{level:string;method:string|null}|null;
}
export interface StatusCardModel{kind:StatusKind;heading:string;title:string;lines:string[];action:{label:string}|null;evidence:string|null}
const NEED_YOU:ResponsibilityState[]=['ready','needs_clarification','awaiting_approval','failed','blocked'];
const HEADING:Record<StatusKind,string>={on_it:'Bear’s on it',need_you:'Just need you',all_sorted:'All sorted'};
const EVIDENCE_WORDS:Record<string,string>={user_confirmation:'You confirmed it.',forwarded_email:'Confirmed by an email you forwarded.',document:'Confirmed by a document.',integration:'Confirmed by the provider.'};
export function statusCardModel(i:StatusInput):StatusCardModel|null{
 if(i.state==='cancelled')return null;
 const prepared=(i.prepared||[]).filter(p=>p.done).map(p=>`${p.label}: done`);
 // All sorted: only with real evidence.
 if((i.state==='verified'||i.state==='closed')&&i.verification)return {kind:'all_sorted',heading:HEADING.all_sorted,title:i.title,lines:prepared,action:null,evidence:EVIDENCE_WORDS[i.verification.method||'']||'Confirmed.'};
 if(NEED_YOU.includes(i.state)){
  const action=i.state==='awaiting_approval'?'Review & approve':i.state==='failed'?'See what happened':i.state==='needs_clarification'?'Answer one question':i.nextAction?.label||null;
  const lines=i.state==='failed'?['That didn’t go through. Nothing was done.']:i.state==='blocked'?['Stuck until something changes.']:[...(i.prepared||[]).filter(p=>!p.done).map(p=>`${p.label}: ${p.value}`)];
  return {kind:'need_you',heading:HEADING.need_you,title:i.title,lines:lines.slice(0,4),action:action?{label:action}:null,evidence:null};
 }
 const lines=i.state==='awaiting_confirmation'?['Sent. Waiting for confirmation.']:i.state==='completed_unverified'?['Looks done. Just waiting for confirmation.']:(i.bearHandling||[]).slice(0,3);
 return {kind:'on_it',heading:HEADING.on_it,title:i.title,lines:[...lines,...prepared].slice(0,4),action:null,evidence:null};
}
