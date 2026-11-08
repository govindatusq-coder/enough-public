import type {LoadGraph} from '../load/types.ts';
import {patterns} from '../load/patterns.ts';
import type {PatternId} from '../load/types.ts';

// PLAN: a dependency-aware plan as a directed graph, validated deterministically. Plans can come from the
// Load Pattern Engine or (later) from a model; either way they are checked here before anything trusts them:
// no cycles, no missing prerequisites, no deadline that falls after something that depends on it.
export interface PlanStep{id:string;label:string;owner:'bear'|'bear_prepares'|'human'|'external_system';status:'pending'|'done'|'skipped';dueAt:string|null;dependsOn:string[];group?:string}
export interface PlanIssue{kind:'cycle'|'missing_prerequisite'|'contradictory_deadline'|'unassigned'|'blocked'|'unnecessary';stepIds:string[];detail:string}
export interface Plan{steps:PlanStep[];order:string[];parallel:string[][];next:string[];issues:PlanIssue[];valid:boolean}

export function planFromGraph(g:LoadGraph):PlanStep[]{
 const out:PlanStep[]=[];
 for(const n of g.nodes){
  // An attached load (consent, payment) is its own branch: it runs in parallel with its siblings.
  for(const s of n.steps)out.push({id:s.id,label:s.label,owner:s.owner,status:s.status,dueAt:s.dueAt,dependsOn:[...s.dependsOn],group:n.role==='attached'?n.title:'main'});
 }
 return out;
}
export function validatePlan(steps:PlanStep[]):Plan{
 const ids=new Set(steps.map(s=>s.id));const by=new Map(steps.map(s=>[s.id,s]));const issues:PlanIssue[]=[];
 for(const s of steps){
  const missing=s.dependsOn.filter(d=>!ids.has(d));if(missing.length)issues.push({kind:'missing_prerequisite',stepIds:[s.id,...missing],detail:'Depends on a step that does not exist.'});
  if(!s.owner)issues.push({kind:'unassigned',stepIds:[s.id],detail:'Nobody owns this step.'});
  if(s.status==='skipped')issues.push({kind:'unnecessary',stepIds:[s.id],detail:'Not needed for this one.'});
  for(const d of s.dependsOn){const p=by.get(d);if(p?.dueAt&&s.dueAt&&p.dueAt>s.dueAt)issues.push({kind:'contradictory_deadline',stepIds:[d,s.id],detail:'A prerequisite is due after the step that needs it.'});}
 }
 // Topological order (Kahn); anything left over is in a cycle.
 const indeg=new Map(steps.map(s=>[s.id,s.dependsOn.filter(d=>ids.has(d)).length]));const order:string[]=[];const layers:string[][]=[];
 let frontier=steps.filter(s=>indeg.get(s.id)===0).map(s=>s.id);
 while(frontier.length){layers.push(frontier);order.push(...frontier);const nextF:string[]=[];
  for(const id of frontier)for(const s of steps)if(s.dependsOn.includes(id)){const v=indeg.get(s.id)!-1;indeg.set(s.id,v);if(v===0)nextF.push(s.id);}
  frontier=nextF;}
 const cyclic=steps.filter(s=>!order.includes(s.id)).map(s=>s.id);
 if(cyclic.length)issues.push({kind:'cycle',stepIds:cyclic,detail:'These steps wait on each other.'});
 const done=(id:string)=>by.get(id)?.status!=='pending';
 const next=steps.filter(s=>s.status==='pending'&&s.dependsOn.filter(d=>ids.has(d)).every(done)&&!cyclic.includes(s.id)).map(s=>s.id);
 for(const s of steps)if(s.status==='pending'&&!next.includes(s.id)&&!cyclic.includes(s.id))issues.push({kind:'blocked',stepIds:[s.id],detail:'One thing needs to happen first.'});
 const parallel=layers.map(l=>l.filter(id=>by.get(id)!.status==='pending')).filter(l=>l.length>1);
 return {steps,order,parallel,next,issues,valid:!issues.some(i=>i.kind==='cycle'||i.kind==='missing_prerequisite'||i.kind==='contradictory_deadline'||i.kind==='unassigned')};
}
export const planFor=(g:LoadGraph)=>validatePlan(planFromGraph(g));

// What each existing pattern needs, so plans, verification and copy agree (extends, never replaces, the
// ten patterns). Completion criteria and evidence come straight from each pattern's closure rules.
export interface PatternKnowledge{commonDependencies:string[];requiredEvidence:string[];safeNextActions:string[];failureConditions:string[];completionCriteria:string;uncertaintyChecks:string[]}
const extra:Partial<Record<PatternId,Omit<PatternKnowledge,'requiredEvidence'|'completionCriteria'|'commonDependencies'>>>={
 BILL_PAYMENT:{safeNextActions:['show amount, due date and reference','plan a reminder before the due date','draft a question to the biller'],failureConditions:['amount disputed','insufficient funds','direct debit failed'],uncertaintyChecks:['is it already paid or on direct debit?','is the amount right?']},
 SCHOOL_EVENT:{safeNextActions:['keep each deadline separately','prepare payment details','make one packing list'],failureConditions:['consent missed','payment missed','equipment missing on the day'],uncertaintyChecks:['which child?','is the date a deadline or the event?']},
 APPOINTMENT:{safeNextActions:['hold the date and time','prepare what to bring','draft a booking or rescheduling message'],failureConditions:['missed appointment','referral missing'],uncertaintyChecks:['is it booked or still to book?']},
 FORM_APPLICATION:{safeNextActions:['list what the form needs','plan a reminder before it is due'],failureConditions:['missing documents','submitted late','rejected'],uncertaintyChecks:['where is it submitted?','what documents are needed?']},
 REPAIR_PROBLEM:{safeNextActions:['draft a message to the landlord or tradie','note when it was reported'],failureConditions:['no response','safety risk'],uncertaintyChecks:['is it urgent or unsafe?','rental or owned?']},
 WAITING_FOR_RESPONSE:{safeNextActions:['remember when a reply is due','draft a follow-up'],failureConditions:['no reply by the expected date'],uncertaintyChecks:['when did they say they would reply?']},
 PURCHASE_REQUIRED:{safeNextActions:['make a list','estimate cost (when the AI service is connected)'],failureConditions:['not bought in time'],uncertaintyChecks:['by when is it needed?']},
 RENEWAL:{safeNextActions:['hold the expiry date','plan a reminder with lead time'],failureConditions:['lapsed','prerequisite (inspection) missing'],uncertaintyChecks:['does it auto-renew?','is the expiry date right?']},
 INVITATION_EVENT:{safeNextActions:['draft an RSVP','plan a present if going'],failureConditions:['missed RSVP'],uncertaintyChecks:['going or not?']},
 REPLENISHMENT:{safeNextActions:['add to the next shop','remember the usual interval'],failureConditions:['ran out of something essential'],uncertaintyChecks:['is it essential (medication)?']},
};
export function patternKnowledge(id:PatternId):PatternKnowledge{
 const p=patterns[id];const e=extra[id]||{safeNextActions:['hold onto it'],failureConditions:[],uncertaintyChecks:['what would make this feel sorted?']};
 return {commonDependencies:p.decomposition.typicalDependencies,requiredEvidence:p.closure.evidence,completionCriteria:p.closure.description,...e};
}
