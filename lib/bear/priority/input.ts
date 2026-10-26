import type {AreaKey} from '../domain/types.ts';
import {downstreamOf,nextHumanStep} from '../load/action.ts';
import {graphState} from '../load/engine.ts';
import type {LoadGraph} from '../load/types.ts';
import type {PriorityInput} from './types.ts';

// Ownership comes first: the Priority Engine only ever sees the remaining human action.
export function inputFromGraph(graph:LoadGraph,o:{id:string;title:string;area:AreaKey;createdAt:string;postpones?:number;snoozedUntil?:string|null;importanceOverride?:PriorityInput['importanceOverride'];projectPriority?:PriorityInput['projectPriority'];notes?:string|null;dueAt?:string|null}):PriorityInput{
 const primary=graph.nodes.find(n=>n.id===graph.primaryId)!;const next=nextHumanStep(graph);const node=next?.node||primary;const e=node.entities;
 const waiting=graph.nodes.find(n=>n.state==='waiting'&&n.waiting);
 const deadline=next?.step.dueAt||e.dueDate||e.expiryDate||e.rsvpDate||primary.entities.dueDate||primary.entities.expiryDate||primary.entities.eventDate||o.dueAt||null;
 return {
  id:o.id,title:o.title,pattern:node.pattern,area:o.area,flags:[...new Set([...(primary.entities.flags||[]),...(e.flags||[])])],
  human:next?{kind:next.step.human||'confirmation',label:next.step.label,dueAt:next.step.dueAt||deadline,surfaceFrom:next.step.surfaceFrom}:null,
  waitingOn:waiting?.waiting?.waitingFor||null,resolved:graphState(graph)==='resolved',deadline,
  dependents:next?downstreamOf(graph,next.step.id):0,
  bearSteps:graph.nodes.reduce((n,x)=>n+x.steps.filter(s=>s.owner==='bear'&&s.status!=='skipped').length,0),
  createdAt:o.createdAt,postpones:o.postpones||0,snoozedUntil:o.snoozedUntil||null,importanceOverride:o.importanceOverride||null,projectPriority:o.projectPriority||null,
  text:`${o.title} ${o.notes||''} ${graph.nodes.map(n=>n.title).join(' ')}`,
 };
}
