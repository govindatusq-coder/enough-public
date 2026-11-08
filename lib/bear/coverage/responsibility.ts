import type {CognitiveOperation,LoadGraph,LoadStep} from '../load/types.ts';
import {levelOf} from './verification.ts';
import type {CapabilityKey,OperationResponsibility,ResponsibilityState} from './types.ts';

// Responsibility per cognitive operation, derived from the existing LoadGraph (no competing lifecycle).
// An operation counts as Bear's ("performedByBear") only when a real system event backs it:
// understanding = Bear extracted it; remembering = a reminder or date Bear holds; planning = Bear
// sequenced steps; closing = completion with evidence. A delivered reminder is not monitoring an outcome,
// a draft is not sending, and a passing deadline is not closure.
const capabilityFor:Record<CognitiveOperation,CapabilityKey>={anticipate:'remind',understand:'extract',identify:'decompose',decide:'record_confirmation',plan:'decompose',coordinate:'draft',remember:'remind',monitor:'verify_external',follow_up:'remind',close:'record_confirmation'};
const STATES:Record<string,ResponsibilityState>={captured:'recognised',covered:'prepared',needs_user:'awaiting_human',waiting:'awaiting_external',resolved:'confirmed'};

export function responsibilityOf(graph:LoadGraph):OperationResponsibility[]{
 const steps=graph.nodes.flatMap(n=>n.steps.map(s=>({s,n})));
 const ops=[...new Set(steps.map(x=>x.s.operation))] as CognitiveOperation[];
 return ops.map(op=>{
  const mine=steps.filter(x=>x.s.operation===op&&x.s.status!=='skipped');
  const human=mine.find(x=>x.s.owner==='human'&&x.s.status==='pending');
  const bearDone=mine.filter(x=>(x.s.owner==='bear'||x.s.owner==='bear_prepares')&&x.s.status==='done');
  const bearHeld=mine.some(x=>x.s.owner==='bear'&&x.s.status==='pending');
  const evidence=mine.flatMap(x=>x.n.evidence.filter(e=>x.s.evidence&&e.key===x.s.evidence));
  const best=evidence.map(levelOf).sort((a,b)=>rank(b)-rank(a))[0]||'unknown';
  const allResolved=mine.length>0&&mine.every(x=>x.s.status==='done');
  const state:ResponsibilityState=allResolved?(best==='confirmed'||best==='user_confirmed'?'confirmed':'awaiting_verification'):human?'awaiting_human':mine.some(x=>x.s.owner==='external_system')?'awaiting_external':bearDone.length||bearHeld?'prepared':'recognised';
  const actor:LoadStep['owner']=human?'human':mine.find(x=>x.s.owner==='external_system')?'external_system':mine[0]?.s.owner||'bear';
  // Monitoring an outside outcome needs an integration Bear doesn't have: never counted as Bear's.
  const performedByBear=op!=='monitor'&&(bearDone.length>0||(op==='remember'&&bearHeld));
  return {operation:op,actor,capability:capabilityFor[op],state,evidence:best,confidence:best==='confirmed'?1:best==='user_confirmed'?0.9:best==='inferred'?0.5:0.3,
   lastVerifiedAt:evidence.map(e=>e.at).sort().pop()||null,nextAction:human?.s.label||null,humanRequired:!!human,performedByBear};
 });
}
const rank=(l:string)=>({confirmed:3,user_confirmed:2,inferred:1,unknown:0} as Record<string,number>)[l]??0;
export const loadStateToResponsibility=(state:string):ResponsibilityState=>STATES[state]||'recognised';
