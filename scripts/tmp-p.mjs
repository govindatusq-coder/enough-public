import {cases,conflicts,TODAY} from '../tests/fixtures/priority-cases.mjs';import {run} from '../tests/priority-harness.mjs';
for(const id of process.argv.slice(2)){const c=[...cases,...conflicts].find(x=>x.id===id||x.id.startsWith(id));const {inputs,results}=run(c,TODAY);
for(const [k,i] of inputs.entries()){const r=results[k];console.log(id,i.id,i.pattern,JSON.stringify(i.human),i.deadline,i.flags.join(','),'| imp',r.importance.toFixed(2),'surf',r.surfaceNow,'lca',r.latestComfortableActionAt,'ap',r.actionPriority.toFixed(2),r.support,r.gates);}}
