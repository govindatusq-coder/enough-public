// Eval200: run all 200 scenarios through Load Bear's real pipeline in-process (sealed simulation), score them, and save
// traces, scores and the report under evaluation/eval200/runs/<run id>/. The HTTP endpoint and the Python harness give the
// same traces; this runner is the quick path and the one CI-style checks use.
//   node scripts/eval200-run.mjs [--limit N] [--label text]
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {parseDataset} from '../lib/bear/eval/scenario.ts';
import {runScenario} from '../lib/bear/eval/run.ts';
import {aggregate,compareRuns,scoreRun,weakest} from '../lib/bear/eval/score.ts';
import {reportMarkdown} from '../lib/bear/eval/report.ts';

const arg=(k)=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const ROOT=join(import.meta.dirname,'..','evaluation','eval200');
const cases=parseDataset(readFileSync(join(ROOT,'eval200.jsonl'),'utf8')).slice(0,Number(arg('--limit'))||undefined);
const runsDir=join(ROOT,'runs');mkdirSync(runsDir,{recursive:true});
const previous=readdirSync(runsDir).filter(d=>existsSync(join(runsDir,d,'summary.json'))).sort().pop()||null;
const runId=new Date().toISOString().replace(/[:.]/g,'-');const out=join(runsDir,runId);mkdirSync(out);
const rows=[];const started=Date.now();
for(const c of cases){const run=await runScenario(c,{mode:'simulation',recordActions:true,approvalPolicy:'simulate_only'});rows.push({run,score:scoreRun(c,run)});}
const agg=aggregate(rows);const prev=previous?JSON.parse(readFileSync(join(runsDir,previous,'summary.json'),'utf8')):null;
const summary={runId,label:arg('--label'),runner:rows[0]?.run.runner,dataset:'eval200.jsonl',n:rows.length,seconds:Math.round((Date.now()-started)/100)/10,
 previousRunId:previous,aggregate:agg,changes:compareRuns(prev?.aggregate||null,agg),weakest:weakest(rows,20)};
writeFileSync(join(out,'traces.jsonl'),rows.map(r=>JSON.stringify(r.run)).join('\n')+'\n');
writeFileSync(join(out,'scores.jsonl'),rows.map(r=>JSON.stringify(r.score)).join('\n')+'\n');
writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,1)+'\n');
writeFileSync(join(out,'report.md'),reportMarkdown(summary));
console.log(JSON.stringify({runId,n:agg.n,overall:agg.overall,verified:agg.verifiedCompletionRate,avgInterventions:agg.avgInterventions,rcli:agg.avgRcliProxy,safety:agg.safetyFailures,network:agg.blockedNetworkAttempts,failures:agg.failures,dimensions:agg.dimensions},null,1));
