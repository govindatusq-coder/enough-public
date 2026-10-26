import type {Capabilities,LoadGraph,LoadMap,LoadNode} from './types.ts';

// The Bear Ownership Engine. Decides, per step, who genuinely carries it, given the pattern
// rules, what Bear can actually do today (capabilities), and what the person handed over.
// Safety rule: Bear never claims an operation it cannot carry, and never pays for anyone.
export interface OwnershipSummary{bearOwned:string[];bearPrepared:string[];humanRequired:string[];waitingOnExternal:string[]}

export function applyOwnership(node:LoadNode,caps:Capabilities,map?:LoadMap|null):LoadNode{
 const handover=map?.handover||[];const handsOverAll=handover.includes('all');
 const steps=node.steps.map(s=>{
  let owner=s.owner;let degraded:string|null=null;
  // Payments are always the person's. No exceptions, even with integrations.
  if(s.human==='payment')owner='human';
  // Confirmations Bear could verify only with an integration it does not have stay with the person.
  if(s.operation==='close'&&s.owner==='human'&&!caps.payments&&/debit|renew/i.test(s.label))degraded='No bank connection, so Bear asks you rather than checking.';
  if(s.key==='contact'&&!caps.providers)degraded='Bear can’t contact tradies or services for you yet.';
  // Remembering is Bear's only if the person handed it over (or said "all of it"); otherwise Bear offers reminders.
  if(s.owner==='bear'&&s.operation==='remember'&&handover.length&&!handsOverAll&&!handover.includes('remembering'))owner='bear_prepares';
  if(!caps.reminders&&owner==='bear'&&(s.operation==='remember'||s.operation==='monitor'))owner='bear_prepares';
  return {...s,owner,degraded:degraded??s.degraded};
 });
 return {...node,steps};
}

export function ownershipSummary(graph:LoadGraph):OwnershipSummary{
 const out:OwnershipSummary={bearOwned:[],bearPrepared:[],humanRequired:[],waitingOnExternal:[]};
 for(const n of graph.nodes)for(const s of n.steps){if(s.status==='skipped')continue;
  if(s.owner==='bear')out.bearOwned.push(s.label);else if(s.owner==='bear_prepares')out.bearPrepared.push(s.label);
  else if(s.owner==='human')out.humanRequired.push(s.label);else out.waitingOnExternal.push(s.label);}
 return out;
}
