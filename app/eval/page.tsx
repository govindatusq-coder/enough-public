import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {notFound} from 'next/navigation';
import {evalEnabled} from '@/lib/bear/eval/gate';
import type {Aggregate,ScenarioScore} from '@/lib/bear/eval/score';
import './eval.css';
export const dynamic='force-dynamic';
export const metadata={title:'Eval200 dashboard',robots:{index:false}};

// Internal developer dashboard for Eval200 runs. Not part of the app people use: it 404s unless BEAR_EVAL_ENABLED=1, and
// always in production. Reads the run summaries saved by scripts/eval200-run.mjs.
type Summary={runId:string;label?:string|null;runner?:string;n:number;seconds:number;previousRunId:string|null;aggregate:Aggregate;
 changes:null|{overall:number;avgInterventions:number;avgRcliProxy:number;dimensions:Record<string,number>;byCategory:Record<string,number>;failures:Record<string,number>};weakest:ScenarioScore[]};
async function runs():Promise<Summary[]>{
 const dir=join(process.cwd(),'evaluation','eval200','runs');let names:string[]=[];try{names=await readdir(dir);}catch{return [];}
 const out:Summary[]=[];for(const n of names.sort().reverse()){try{out.push(JSON.parse(await readFile(join(dir,n,'summary.json'),'utf8')));}catch{/* not a finished run */}}
 return out;
}
const sign=(x:number)=>x>0?`+${x}`:`${x}`;
const Bar=({value,max}:{value:number;max:number})=><span className="ev-bar"><span style={{width:`${Math.max(0,Math.min(1,value/max))*100}%`}}/></span>;
export default async function EvalDashboard(){
 if(!evalEnabled())notFound();
 const all=await runs();const s=all.find(r=>r.n>=200)||all[0];
 if(!s)return <main className="ev"><h1>Eval200</h1><p>No runs yet. Run <code>node scripts/eval200-run.mjs</code>.</p></main>;
 const a=s.aggregate;const c=s.changes;
 const tiles:[string,string,string|null][]=[
  ['Overall score',`${a.overall}`,c?sign(c.overall):null],['Verified completion',`${Math.round(a.verifiedCompletionRate*1000)/10}%`,null],
  ['Avg interventions',`${a.avgInterventions}`,c?sign(c.avgInterventions):null],['RCLI proxy*',`${a.avgRcliProxy}`,c?sign(c.avgRcliProxy):null],
  ['Safety failures',`${a.safetyFailures}`,null],['Real-world actions',`${a.realWorldActions}`,null]];
 return <main className="ev">
  <header><h1>Eval200</h1><p>Internal. Run {s.runId} · {s.n} scenarios · {s.runner} · sealed simulation (no database, no AI, network blocked, mock services).</p></header>
  <p className="ev-warn">Automated, unvalidated grading of Load Bear’s trace against each scenario. It is not evidence that Load Bear reduces mental load. *The RCLI proxy is a preliminary count of work handed back to the parent, kept separate from any validated measure.</p>
  <section className="ev-tiles">{tiles.map(([k,v,d])=><div key={k} className="ev-tile"><span>{k}</span><b>{v}</b>{d&&<small>{d} vs previous</small>}</div>)}</section>
  <section><h2>Dimensions (0–4)</h2><table><tbody>{Object.entries(a.dimensions).map(([k,v])=><tr key={k}><th>{k.replace(/_/g,' ')}</th><td>{v}</td><td><Bar value={v} max={4}/></td><td>{c?sign(c.dimensions[k]??0):''}</td></tr>)}</tbody></table></section>
  <section><h2>By category</h2><table><thead><tr><th>Category</th><th>n</th><th>Score</th><th/><th>Interventions</th><th>Change</th></tr></thead><tbody>
   {Object.entries(a.byCategory).sort((x,y)=>x[1].overall-y[1].overall).map(([k,v])=><tr key={k}><th>{k}</th><td>{v.n}</td><td>{v.overall}</td><td><Bar value={v.overall} max={100}/></td><td>{v.avgInterventions}</td><td>{c?sign(c.byCategory[k]??0):''}</td></tr>)}</tbody></table></section>
  <section><h2>Common failure types</h2><table><tbody>{Object.entries(a.failures).map(([k,v])=><tr key={k}><th>{k.replace(/_/g,' ')}</th><td>{v}</td><td><Bar value={v} max={a.n}/></td><td>{c?sign(c.failures[k]??0):''}</td></tr>)}</tbody></table></section>
  <section><h2>Cognitive work per scenario (mean)</h2><table><tbody>{Object.entries(a.metrics).map(([k,v])=><tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table></section>
  <section><h2>20 weakest scenarios</h2><table><thead><tr><th>Scenario</th><th>Category</th><th>Score</th><th>Why</th></tr></thead><tbody>
   {s.weakest.map(w=><tr key={w.scenarioId}><th>{w.scenarioId}</th><td>{w.category}</td><td>{w.overall}</td><td>{w.reasons.slice(0,3).join('; ')}</td></tr>)}</tbody></table></section>
  <section><h2>Runs</h2><table><thead><tr><th>Run</th><th>n</th><th>Score</th><th>Interventions</th><th>RCLI proxy</th></tr></thead><tbody>
   {all.map(r=><tr key={r.runId}><th>{r.runId}{r.label?` (${r.label})`:''}</th><td>{r.n}</td><td>{r.aggregate.overall}</td><td>{r.aggregate.avgInterventions}</td><td>{r.aggregate.avgRcliProxy}</td></tr>)}</tbody></table></section>
 </main>;
}
