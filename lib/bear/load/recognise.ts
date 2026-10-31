import {patternPriority,patterns,v1Patterns} from './patterns.ts';
import type {LoadEntities,PatternId} from './types.ts';

// Recognition: deterministic signal scoring over the input, plus an optional hint from the
// AI reader (its capture kind). Low confidence never forces a pattern: it becomes UNKNOWN_LOAD.
export interface Recognition{primary:PatternId;confidence:number;attached:PatternId[];ranked:{id:PatternId;score:number;confidence:number}[]}
export const toConfidence=(score:number)=>Math.round((1-Math.exp(-score/1.6))*100)/100;

export function scorePatterns(text:string,kindHint?:string|null){
 return v1Patterns.map(p=>{
  let score=0;
  // Several distinct signals of the same kind are stronger evidence than one (capped, so one long
  // message can't drown out everything else).
  for(const s of p.recognition.signals){const g=new RegExp(s.match.source,s.match.flags.includes('g')?s.match.flags:s.match.flags+'g');const hits=new Set((text.match(g)||[]).map(m=>m.toLowerCase().trim()));if(hits.size)score+=s.weight*(1+0.5*(Math.min(hits.size,3)-1));}
  // The AI's reading confirms a pattern the words already point to; on its own it never decides.
  if(kindHint&&p.recognition.captureKinds?.includes(kindHint)&&score>0)score+=1.2;
  return {id:p.id,score,confidence:toConfidence(score)};
 }).sort((a,b)=>b.score-a.score||patternPriority.indexOf(a.id)-patternPriority.indexOf(b.id));
}

export function recognise(text:string,entities:LoadEntities,kindHint?:string|null):Recognition{
 const ranked=scorePatterns(text,kindHint);
 for(const r of ranked.slice(1)){const p=patterns[r.id];if(r.confidence<p.recognition.confidenceThreshold)continue;
  if(p.recognition.dominates?.some(d=>d.pattern===ranked[0].id&&d.when.test(text))){ranked.splice(ranked.indexOf(r),1);ranked.unshift(r);break;}}
 const top=ranked[0];
 if(!top||top.confidence<patterns[top.id].recognition.confidenceThreshold)return {primary:'UNKNOWN_LOAD',confidence:top?.confidence??0,attached:[],ranked};
 const attached=(patterns[top.id].attaches||[]).filter(a=>a.when(entities,text)).map(a=>a.pattern);
 return {primary:top.id,confidence:top.confidence,attached,ranked};
}
