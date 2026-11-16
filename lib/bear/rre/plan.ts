// RRE part 2: the plan Bear keeps for each responsibility, its status, and the execution state machine.
// The plan is stored with the task (validated shape, versioned); the task stays the single record of the responsibility.
import {addDays,daysBetween} from '../domain/dates.ts';
import {deadlinesFor,opportunitiesFor,pathwaysFor,rankPathways,understand,type Deadlines,type Dependency,type Kind,type Method,type Opportunity,type Pathway,type Step} from './model.ts';

export type ExecState='not_started'|'preparing'|'ready_for_review'|'awaiting_approval'|'approved'|'executing'|'waiting_external'|'completed'|'failed'|'cancelled';
export type RStatus='captured'|'planning'|'ready'|'awaiting_approval'|'in_progress'|'waiting'|'completed'|'blocked';
export interface Prepared{kind:'shopping'|'draft'|'call'|'steps'|'shortlist'|'bill'|'form'|'note';title:string;lines:string[];links:{label:string;url:string}[];draft?:{to:string;subject:string;body:string}|null;note:string;at:string}
export interface Plan{v:1;rules:string;kind:Kind;outcome:string;people:string[];item:string|null;deadlineSource:'stated'|'known_date'|null;
 pathways:Pathway[];selected:string;chosenBy:'bear'|'you';opportunities:Opportunity[];deadlines:Deadlines;dependencies:Dependency[];
 stepIndex:number;execution:{state:ExecState;log:{at:string;text:string}[];prepared:Prepared|null;key:string|null};
 dismissed:string[];builtAt:string;basis?:string}
export const RULES_VERSION='rre-1';

export interface PlanInput{id:string;title:string;original:string;dueAt:string|null;listId:string|null;today:string;children?:string[];minutesGuess:number;prefer?:{method?:Method|null;avoid?:Method|null};chosen?:string|null}
export function buildPlan(i:PlanInput,now=new Date()):Plan{
 const u=understand({title:i.title,original:i.original,dueAt:i.dueAt,listId:i.listId,today:i.today,children:i.children});
 const paths=pathwaysFor(u,{title:i.title,today:i.today,minutesGuess:i.minutesGuess});
 const ranked=rankPathways(paths,i.prefer||{});const chosen=i.chosen&&paths.find(p=>p.id===i.chosen&&p.feasibility!=='infeasible');
 const sel=chosen||ranked[0];
 return {v:1,rules:RULES_VERSION,kind:u.kind,outcome:u.outcome,people:u.people,item:u.item,deadlineSource:u.deadlineSource,pathways:paths,selected:sel.id,chosenBy:chosen?'you':'bear',
  opportunities:opportunitiesFor(u,paths,i.today),deadlines:deadlinesFor(u,sel),dependencies:[],stepIndex:0,
  execution:{state:'not_started',log:[],prepared:null,key:null},dismissed:[],builtAt:now.toISOString()};
}
export const selectedPath=(p:Plan)=>p.pathways.find(x=>x.id===p.selected)||p.pathways[0];
export const currentStep=(p:Plan):Step|null=>selectedPath(p).steps[p.stepIndex]||null;

// What the person sees: one plain status, kept separate from the execution state of the current step.
export function statusOf(p:Plan,taskStatus:string,today:string):RStatus{
 if(taskStatus==='done')return 'completed';
 const s=currentStep(p);if(!s)return 'completed';
 const openDep=p.dependencies.find(d=>d.status==='open');
 if(openDep)return openDep.expectedBy&&openDep.expectedBy<today?'ready':'waiting';
 if(selectedPath(p).feasibility==='infeasible')return 'blocked';
 if(p.execution.state==='ready_for_review'||p.execution.state==='awaiting_approval')return 'awaiting_approval';
 if(p.stepIndex===0&&s.who==='bear')return p.execution.state==='not_started'?'captured':'planning';
 if(p.stepIndex>0)return 'in_progress';
 return 'ready';
}
export const statusLabel:Record<RStatus,string>={captured:'Captured',planning:'Planning',ready:'Ready for action',awaiting_approval:'Ready for you to check',in_progress:'In progress',waiting:'Waiting for a response',completed:'Completed',blocked:'Blocked'};

// Moving through the plan. Each move is recorded; nothing is marked complete until the outcome itself is confirmed.
export function advance(p:Plan,now:Date,today:string,note:string):Plan{
 const path=selectedPath(p);const next=p.stepIndex+1;const at=now.toISOString();
 const log=[...p.execution.log,{at,text:note}].slice(-30);
 const s=path.steps[next];
 if(!s)return {...p,stepIndex:next,execution:{...p.execution,state:'completed',log}};
 if(s.kind==='wait'){
  // Waiting on something outside her control (a delivery, a reply): Bear checks back on the expected day.
  const expectedBy=addDays(today,s.waitDays||2);
  const dep:Dependency={id:`${path.id}-${s.id}`,what:s.text,kind:s.id==='deliver'?'delivery':'external',expectedBy,status:'open'};
  return {...p,stepIndex:next,dependencies:[...p.dependencies.filter(d=>d.id!==dep.id),dep],deadlines:{...p.deadlines,followUp:expectedBy},execution:{...p.execution,state:'waiting_external',log}};
 }
 return {...p,stepIndex:next,execution:{...p.execution,state:s.who==='you'?'ready_for_review':'not_started',log}};
}
// The thing she was waiting on happened (it arrived, they replied).
export function resolveWait(p:Plan,now:Date,today:string,note:string):Plan{
 const s=currentStep(p);if(!s||s.kind!=='wait')return p;
 const met={...p,dependencies:p.dependencies.map(d=>d.status==='open'?{...d,status:'met' as const}:d)};
 return advance(met,now,today,note);
}
// The pathway failed (it didn't arrive, the shop was out): switch to the next feasible way and keep the responsibility open.
export function switchPathway(p:Plan,to:string,now:Date,why:string,by:'you'|'bear'):Plan{
 const target=p.pathways.find(x=>x.id===to);if(!target||target.feasibility==='infeasible')return p;
 const failedLog={at:now.toISOString(),text:why};
 return {...p,selected:to,chosenBy:by,stepIndex:0,dependencies:[],deadlines:{...p.deadlines,action:p.deadlines.outcome&&target.leadDays?addDays(p.deadlines.outcome,-target.leadDays):p.deadlines.outcome,followUp:null},
  execution:{state:'not_started',log:[...p.execution.log,failedLog].slice(-30),prepared:null,key:null}};
}
export const daysLeft=(iso:string|null,today:string)=>iso?daysBetween(today,iso):null;
