import {understand} from '../lib/bear/load/engine.ts';
import {currentCapabilities} from '../lib/bear/load/types.ts';
import {addDays} from '../lib/bear/domain/dates.ts';
import {inputFromGraph} from '../lib/bear/priority/input.ts';
import {prioritise,selectAction} from '../lib/bear/priority/engine.ts';
const caps=currentCapabilities();
export const PANIC=/\b(urgent|critical|asap|immediately|overdue|panic|now!)\b/i;
export function run(c,today){
 const ctx={today,availableMinutes:null,dayMode:null,values:{values:[],goals:[]},struggles:[],strengths:[],learned:{},otherDeadlines:[],...(c.ctx||{})};
 const inputs=c.items.map(it=>{const {graph}=understand({text:it.text,today,caps});return inputFromGraph(graph,{id:it.id,title:graph.nodes[0].title,area:'home',createdAt:addDays(today,-(it.createdDaysAgo||0))+'T09:00:00Z',postpones:it.postpones||0,notes:it.text});});
 const results=inputs.map(i=>prioritise(i,{...ctx,otherDeadlines:inputs.filter(o=>o.id!==i.id).map(o=>o.deadline).filter(Boolean)}));
 return {inputs,results,sel:selectAction(results),ctx};
}
export function check(c,today){
 const notes=[];const {results,sel,inputs,ctx}=run(c,today);const e=c.expect;const by=id=>results.find(r=>r.id===id);
 if('top' in e&&(sel.top?.id??null)!==e.top)notes.push(`top ${sel.top?.id??null} (${sel.top?by(sel.top.id).explanation.primaryReason:''}), expected ${e.top}`);
 if(e.label&&by('x')?.timingLabel!==e.label)notes.push(`label ${by('x')?.timingLabel}, expected ${e.label}`);
 if(e.tier!==undefined&&sel.top&&sel.top.tier!==e.tier)notes.push(`tier ${sel.top.tier}, expected ${e.tier}`);
 for(const q of e.quiet||[])if(by(q).surfaceNow)notes.push(`${q} surfaced`);
 if(e.order){const ids=sel.ranked.map(r=>r.id);for(let k=0;k<e.order.length;k++)if(ids[k]!==e.order[k])notes.push(`order ${ids.join('>')}, expected ${e.order.join('>')} first`);}
 if(e.support)for(const s of e.support)if(by(s).support!=='prepare_more'||!by(s).firstStep)notes.push(`${s} support ${by(s).support}`);
 if(e.rises){const [a,b]=e.rises;if(!(by(a).actionPriority>by(b).actionPriority))notes.push(`${a} ${by(a).actionPriority.toFixed(2)} does not outrank ${b} ${by(b).actionPriority.toFixed(2)}`);}
 for(const id of e.calm||[]){const r=by(id);if(PANIC.test(r.explanation.headline+r.timingLabel))notes.push(`${id} uses panic language`);if(r.tier<2)notes.push(`${id} escalated to tier ${r.tier}`);}
 // Universal rules: no surfacing without a human action; explanations never empty when surfaced.
 for(const r of results){const i=inputs.find(x=>x.id===r.id);if(r.surfaceNow&&!i.human)notes.push(`${r.id} surfaced with nothing for the person to do`);if(r.surfaceNow&&!r.explanation.reasons.length)notes.push(`${r.id} has no reasons`);}
 return {id:c.id,pattern:c.pattern||'CONFLICT',ok:!notes.length,notes,ctx};
}
