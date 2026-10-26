// Runs one fixture through the real engine and scores it on the five dimensions.
import {understand,applyAction,recompute,graphState} from '../lib/bear/load/engine.ts';
import {describe} from '../lib/bear/load/view.ts';
import {stepActive} from '../lib/bear/load/action.ts';
import {currentCapabilities} from '../lib/bear/load/types.ts';
export const caps=currentCapabilities();
// Claims Bear cannot honestly make with today's capabilities.
export const FORBIDDEN=/\b(inbox|your email|watch(?:ing)? your|monitor(?:ing)? your|I’ll (?:pay|book|contact|call|email|order|buy)|I'll (?:pay|book|contact|call|email|order|buy)|tracking your|I’ve paid|I’ve booked)\b/i;

function find(graph,key){for(const n of graph.nodes){if(n.state==='resolved')continue;for(const s of n.steps){if(!stepActive(s,n,graph))continue;if(s.evidence===key||s.choices?.some(c=>c.evidence===key))return {n,s};}}return null;}
export function walk(graph,keys,today){
 for(const key of keys){
  if(key==='event_occurred')continue;
  const hit=find(graph,key);if(!hit)return {graph,missing:key};
  graph=applyAction(graph,{stepId:hit.s.id,evidence:hit.s.choices?.some(c=>c.evidence===key)?key:null},today,caps).graph;
 }
 return {graph,missing:null};
}
export function score(c,TODAY){
 const r={id:c.id,pattern:c.pattern,recognition:true,decomposition:true,ownership:true,burden:true,closure:true,notes:[]};
 const {graph,recognition}=understand({text:c.text,today:TODAY,caps});
 // 1. Recognition
 if(recognition.primary!==c.pattern){r.recognition=false;r.notes.push(`primary ${recognition.primary}`);}
 for(const a of c.attached||[])if(!recognition.attached.includes(a)){r.recognition=false;r.notes.push(`missing attached ${a}`);}
 // 2. Decomposition
 const steps=graph.nodes.flatMap(n=>n.steps.map(s=>({...s,node:n})));
 const keys=new Set(steps.map(s=>s.key));
 for(const k of c.steps||[])if(!keys.has(k)){r.decomposition=false;r.notes.push(`missing step ${k}`);}
 for(const k of c.noSteps||[])if(keys.has(k)){r.decomposition=false;r.notes.push(`unneeded step ${k}`);}
 const activeHuman=steps.filter(s=>s.owner==='human'&&stepActive(s,s.node,graph));
 if(activeHuman.length>6){r.decomposition=false;r.notes.push(`${activeHuman.length} human steps`);}
 if(steps.some(s=>/[{}]/.test(s.label))){r.decomposition=false;r.notes.push('unfilled label');}
 // 3. Ownership (no false capability claims)
 const view=describe(graph,TODAY);
 const words=[view.headline,view.needsYou?.headline||'',...view.covered,...view.waiting.map(w=>w.line),...view.comingUp.map(x=>x.line),...steps.filter(s=>s.owner==='bear').map(s=>s.label)].join(' | ');
 if(FORBIDDEN.test(words)){r.ownership=false;r.notes.push('false claim: '+words.match(FORBIDDEN)[0]);}
 if(steps.some(s=>s.human==='payment'&&s.owner!=='human')){r.ownership=false;r.notes.push('Bear owns a payment');}
 if(graph.nodes.some(n=>n.waiting&&n.waiting.monitoringMethod!=='time_based')){r.ownership=false;r.notes.push('claims integration monitoring');}
 // 4. Human burden: the single smallest action, or nothing
 const kind=view.needsYou?view.needsYou.kind:null;
 if(c.resolvedAtCapture){if(view.state!=='resolved'){r.burden=false;r.notes.push(`expected resolved at capture, got ${view.state}`);}}
 else if(kind!==c.first){r.burden=false;r.notes.push(`first action ${kind} (${view.needsYou?.headline||'none'}), expected ${c.first}`);}
 if(view.needsYou&&view.needsYou.headline.length>110){r.burden=false;r.notes.push('long action');}
 // 5. Closure: the right evidence closes it; look-alike progress does not
 if(!c.resolvedAtCapture){
  const done=walk(graph,c.close,TODAY);const at=c.after||TODAY;
  const finalG=recompute(done.graph,at,caps);
  if(done.missing){r.closure=false;r.notes.push(`no step gives ${done.missing}`);}
  else if(graphState(finalG)!=='resolved'){r.closure=false;r.notes.push(`not resolved after ${c.close.join(',')} (state ${graphState(finalG)})`);}
  if(c.notClose){
   const partial=c.notClose.reduce((g,k)=>{const hit=find(g,k);if(hit)return applyAction(g,{stepId:hit.s.id,evidence:hit.s.choices?.some(x=>x.evidence===k)?k:null},TODAY,caps).graph;const g2=structuredClone(g);g2.nodes[0].evidence.push({key:k,at:new Date().toISOString(),source:'system'});return recompute(g2,TODAY,caps);},graph);
   if(graphState(recompute(partial,TODAY,caps))==='resolved'){r.closure=false;r.notes.push(`closed by look-alike ${c.notClose.join(',')}`);}
  }
 }
 return r;
}
