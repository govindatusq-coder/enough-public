// Eval200 report: the run's summary as Markdown for people to read. Numbers come straight from the saved summary.
import type {Aggregate,ScenarioScore} from './score.ts';
type Summary={runId:string;label?:string|null;runner?:string;n:number;seconds:number;previousRunId:string|null;aggregate:Aggregate;changes:ReturnType<typeof import('./score.ts').compareRuns>;weakest:ScenarioScore[]};
const pct=(x:number)=>`${Math.round(x*1000)/10}%`;
export function reportMarkdown(s:Summary){
 const a=s.aggregate;const L:string[]=[];
 L.push(`# Eval200 run ${s.runId}`,'',`Runner ${s.runner||'?'} · ${s.n} scenarios · ${s.seconds}s · sealed simulation (no database, no AI, network blocked, mock services only).`,'');
 L.push('Scores are from an automated, unvalidated grader that checks Load Bear’s trace against each scenario. They are not evidence that Load Bear reduces mental load.','');
 L.push('## Headline','',`| Measure | Value |`,`|---|---|`,
  `| Overall score (0–100) | ${a.overall} |`,`| Verified completion rate | ${pct(a.verifiedCompletionRate)} |`,`| Average interventions handed to her | ${a.avgInterventions} |`,
  `| RCLI proxy (preliminary, unvalidated) | ${a.avgRcliProxy} |`,`| Safety failures | ${a.safetyFailures} |`,`| Approval violations | ${a.approvalViolations} |`,
  `| Fabricated evidence | ${a.fabricatedEvidence} |`,`| Real-world actions | ${a.realWorldActions} |`,`| Outbound network attempts blocked | ${a.blockedNetworkAttempts} |`,'');
 L.push('## Dimensions (0–4)','','| Dimension | Mean |','|---|---|',...Object.entries(a.dimensions).map(([k,v])=>`| ${k.replace(/_/g,' ')} | ${v} |`),'');
 L.push('## Cognitive work per scenario (mean)','','| Count | Mean |','|---|---|',...Object.entries(a.metrics).map(([k,v])=>`| ${k} | ${v} |`),'');
 L.push('## By category','','| Category | n | Score | Interventions |','|---|---|---|---|',...Object.entries(a.byCategory).sort((x,y)=>x[1].overall-y[1].overall).map(([k,v])=>`| ${k} | ${v.n} | ${v.overall} | ${v.avgInterventions} |`),'');
 L.push('## By source and locale','','| Source | n | Score |','|---|---|---|',...Object.entries(a.bySource).map(([k,v])=>`| ${k} | ${v.n} | ${v.overall} |`),'','| Locale | n | Score |','|---|---|---|',...Object.entries(a.byLocale).map(([k,v])=>`| ${k} | ${v.n} | ${v.overall} |`),'');
 L.push('## Failure types','','| Failure | Scenarios |','|---|---|',...Object.entries(a.failures).map(([k,v])=>`| ${k} | ${v} |`),'');
 L.push('## The 20 weakest scenarios','','| Scenario | Category | Score | Why |','|---|---|---|---|',...s.weakest.map(w=>`| ${w.scenarioId} | ${w.category} | ${w.overall} | ${w.reasons.slice(0,4).join('; ').replace(/\|/g,'/')} |`),'');
 if(s.changes){L.push(`## Changes since ${s.previousRunId}`,'',`Overall ${s.changes.overall>=0?'+':''}${s.changes.overall}; interventions ${s.changes.avgInterventions>=0?'+':''}${s.changes.avgInterventions}; RCLI proxy ${s.changes.avgRcliProxy>=0?'+':''}${s.changes.avgRcliProxy}.`,'');}
 return L.join('\n')+'\n';
}
