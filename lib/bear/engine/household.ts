// Household coordination: a foundation only (feature-flagged off; no shared tables yet). It defines who
// can see what and how a responsibility is handed to someone else, so the eventual multi-user build has
// tested rules to stand on. Sharing a household never means sharing everything.
export const householdEnabled=()=>process.env.BEAR_HOUSEHOLD_ENABLED==='on';
export type MemberRole='owner'|'adult'|'teen'|'carer';
export type Sensitivity='general'|'financial'|'medical'|'relationship'|'private';
export interface HouseholdMember{userId:string;role:MemberRole}
export interface SharedResponsibility{id:string;ownerId:string;sensitivity:Sensitivity;sharedWith:string[]}
// Visibility: the owner always; others only if explicitly shared with them AND the sensitivity allows it.
// Financial, medical, relationship and private items need a per-item share, never a household-wide one.
export function canView(viewerId:string,r:SharedResponsibility,m:HouseholdMember[]):boolean{
 if(viewerId===r.ownerId)return true;const v=m.find(x=>x.userId===viewerId);if(!v)return false;
 if(!r.sharedWith.includes(viewerId))return false;
 if(r.sensitivity!=='general'&&v.role==='teen')return false;
 return true;
}
export type AssignmentState='proposed'|'invited'|'accepted'|'declined'|'completed'|'verified';
const NEXT:Record<AssignmentState,AssignmentState[]>={proposed:['invited','declined'],invited:['accepted','declined'],accepted:['completed','declined'],declined:['proposed'],completed:['verified','accepted'],verified:[]};
export interface Assignment{responsibilityId:string;assigneeId:string;state:AssignmentState;actedBy:string|null}
// Only the assignee can accept, decline or complete; nobody can accept on their behalf.
export function moveAssignment(a:Assignment,to:AssignmentState,actor:string,verifier?:string):{ok:true;assignment:Assignment}|{ok:false;reason:string}{
 if(!NEXT[a.state].includes(to))return {ok:false,reason:'invalid_transition'};
 if(['accepted','declined','completed'].includes(to)&&actor!==a.assigneeId)return {ok:false,reason:'only_the_assignee'};
 if(to==='verified'&&(!verifier||verifier===a.assigneeId))return {ok:false,reason:'needs_independent_confirmation'};
 return {ok:true,assignment:{...a,state:to,actedBy:actor}};
}
export const isAccepted=(a:Assignment)=>['accepted','completed','verified'].includes(a.state);
