import type {LoadGraph,LoadNode,LoadStep,MinimumHumanAction} from './types.ts';
import {parentHas} from './closure.ts';

// The Minimum Human Action Engine: the smallest meaningful thing only the person can do now.
// Returns null when there is nothing: that is a success state, not a gap to fill.
export function stepActive(step:LoadStep,node:LoadNode,graph:LoadGraph){
 if(step.status!=='pending')return false;
 const ev=new Set(node.evidence.map(e=>e.key));
 if(step.skipIf.some(k=>ev.has(k)))return false;
 if(step.requiresEvidence&&!ev.has(step.requiresEvidence))return false;
 if(node.gate?.evidence&&!parentHas(graph,node,node.gate.evidence))return false;
 return step.dependsOn.every(d=>{const dep=node.steps.find(s=>s.id===d);return !dep||dep.status!=='pending'||dep.skipIf.some(k=>ev.has(k))||(!!dep.requiresEvidence&&!ev.has(dep.requiresEvidence));});
}
export function labelFor(step:LoadStep,node:LoadNode){const ev=new Set(node.evidence.map(e=>e.key));return step.labelIf.find(l=>ev.has(l.evidence))?.label||step.label;}

export function humanCandidates(graph:LoadGraph,today:string){
 const out:{node:LoadNode;step:LoadStep;order:number}[]=[];let order=0;
 for(const node of graph.nodes){if(node.state==='resolved')continue;
  for(const step of node.steps){order++;
   if(step.owner!=='human'||!stepActive(step,node,graph))continue;
   if(step.surfaceFrom&&step.surfaceFrom>today)continue;
   out.push({node,step,order});}}
 // Missing information and safety first; then the earliest deadline; then the natural order.
 const rank=(c:{step:LoadStep})=>c.step.key.startsWith('need_')||c.step.key==='safe'?0:1;
 return out.sort((a,b)=>rank(a)-rank(b)||(a.step.dueAt||'9999').localeCompare(b.step.dueAt||'9999')||a.order-b.order);
}

export function minimumHumanAction(graph:LoadGraph,today:string):MinimumHumanAction|null{
 const primary=graph.nodes.find(n=>n.id===graph.primaryId);
 if(primary?.clarification&&!primary.evidence.some(e=>e.key==='clarified'))return {nodeId:primary.id,stepId:`${primary.id}:clarify`,kind:'decision',headline:primary.clarification.question,cta:'Choose',dueAt:null,choices:primary.clarification.choices.map(c=>({label:c,evidence:'clarified:'+c}))};
 const c=humanCandidates(graph,today)[0];if(!c)return null;
 return {nodeId:c.node.id,stepId:c.step.id,kind:c.step.human||'confirmation',headline:labelFor(c.step,c.node),cta:c.step.cta||'Done',dueAt:c.step.dueAt,choices:c.step.choices};
}

// The next thing only the person can do, whether or not it has surfaced yet. The Priority Engine
// uses this to decide when it is worth surfacing (sometimes earlier than the pattern's default).
export function nextHumanStep(graph:LoadGraph){
 const out:{node:LoadNode;step:LoadStep}[]=[];
 for(const node of graph.nodes){if(node.state==='resolved')continue;for(const step of node.steps)if(step.owner==='human'&&stepActive(step,node,graph))out.push({node,step});}
 const rank=(c:{step:LoadStep})=>c.step.key.startsWith('need_')||c.step.key==='safe'?0:1;
 return out.sort((a,b)=>rank(a)-rank(b)||(a.step.surfaceFrom||'0000').localeCompare(b.step.surfaceFrom||'0000')||(a.step.dueAt||'9999').localeCompare(b.step.dueAt||'9999'))[0]||null;
}
// How many pending steps (here and in attached loads) are waiting on this step being done.
export function downstreamOf(graph:LoadGraph,stepId:string){
 const all=graph.nodes.flatMap(n=>n.steps.map(s=>({n,s})));const seen=new Set<string>([stepId]);let grew=true;
 while(grew){grew=false;for(const {s} of all)if(!seen.has(s.id)&&s.status==='pending'&&s.dependsOn.some(d=>seen.has(d))){seen.add(s.id);grew=true;}}
 const node=graph.nodes.find(n=>n.steps.some(s=>s.id===stepId));
 const gated=node?graph.nodes.filter(n=>n.parentId===node.id&&n.gate?.evidence).length:0;
 return seen.size-1+gated;
}
