import type {Evidence,LoadGraph} from '../load/types.ts';
import type {CompletionEvidence,EvidenceLevel} from './types.ts';

// How sure Bear is that something is done. Only direct evidence is "confirmed"; the person's word is
// "user confirmed"; time passing is at best "inferred" (an event happened, not that the admin was done).
export function levelOf(e:Pick<Evidence,'source'>):EvidenceLevel{
 if(e.source==='user')return 'user_confirmed';
 if(e.source==='email'||e.source==='receipt'||e.source==='provider')return 'confirmed';
 if(e.source==='time')return 'inferred';
 return 'unknown';
}
export function completionEvidence(source:'user'|'receipt'|'email'|'provider',at:string):CompletionEvidence{
 return {level:source==='user'?'user_confirmed':'confirmed',source,confidence:source==='user'?0.9:1,verifiedAt:at};
}
// What Bear actually knows about a step: done by the person's word, by a document, or not known.
export function stepEvidence(graph:LoadGraph,stepEvidenceKey:string|null):CompletionEvidence{
 if(!stepEvidenceKey)return {level:'unknown',source:null,confidence:0,verifiedAt:null};
 for(const n of graph.nodes){const e=n.evidence.find(x=>x.key===stepEvidenceKey);if(e){const level=levelOf(e);return {level,source:e.source==='system'?'system':e.source,confidence:level==='confirmed'?1:level==='user_confirmed'?0.9:level==='inferred'?0.5:0,verifiedAt:e.at};}}
 return {level:'unknown',source:null,confidence:0,verifiedAt:null};
}
