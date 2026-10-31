import {cognitiveOperations,type CognitiveLoadVector,type LoadGraph,type Ownership} from './types.ts';
import {patterns} from './patterns.ts';

// Cognitive responsibility absorbed: for each operation the load would otherwise need,
// who now carries it. Internal (analytics and tests), not a number shown to the person.
export function cognitiveLoadVector(graph:LoadGraph):CognitiveLoadVector{
 const v=Object.fromEntries(cognitiveOperations.map(o=>[o,null])) as CognitiveLoadVector;
 const rank:Record<Ownership,number>={human:0,external_system:1,bear_prepares:2,bear:3};
 for(const n of graph.nodes){const p=patterns[n.pattern];
  for(const s of n.steps){if(s.status==='skipped')continue;const cur=v[s.operation];
   // An operation counts as Bear's only if every step of it is Bear's; one human step keeps it human.
   if(cur===null||rank[s.owner]<rank[cur])v[s.operation]=s.owner;}
  // Operations the load needs with no explicit step: Bear's if the pattern lets Bear own them, else the person's.
  for(const op of p.cognitiveOperations)if(v[op]===null)v[op]=p.ownershipRules.bearCanOwn.some(b=>b.startsWith(op))?'bear':'human';
 }
 return v;
}
export function absorbed(v:CognitiveLoadVector){const needed=Object.values(v).filter(x=>x!==null);return needed.length?needed.filter(x=>x==='bear'||x==='bear_prepares').length/needed.length:0;}
