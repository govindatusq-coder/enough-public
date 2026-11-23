import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {evalAuthorised,evalEnabled} from '@/lib/bear/eval/gate';
import {parseDataset,type Scenario} from '@/lib/bear/eval/scenario';
import {runScenario} from '@/lib/bear/eval/run';
import {scoreRun} from '@/lib/bear/eval/score';
export const dynamic='force-dynamic';
export const runtime='nodejs';

// POST /api/eval/run-scenario — staging only. Runs one Eval200 scenario through Load Bear's pipeline in a sealed simulation
// (in-memory synthetic account, no AI, network blocked, mock services) and returns the structured trace.
// Accepts {scenario_id, mode:'simulation', record_actions} or the Eval200 harness request ({scenario_id, …,
// approval_policy:'simulate_only'}). The response carries the harness fields at the top level, plus `trace` and `score`.
const body=z.object({scenario_id:z.string().regex(/^WWTC-\d{3}$/),mode:z.literal('simulation').default('simulation'),record_actions:z.boolean().default(true),
 approval_policy:z.literal('simulate_only').default('simulate_only')}).passthrough();
let cache:Map<string,Scenario>|null=null;
async function scenarios(){
 if(!cache){const text=await readFile(join(process.cwd(),'evaluation','eval200','eval200.jsonl'),'utf8');cache=new Map(parseDataset(text).map(c=>[c.id,c]));}
 return cache;
}
const no=(status:number,error:string)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(req:Request){
 if(!evalEnabled())return new Response('Not found',{status:404});
 if(!evalAuthorised(req.headers.get('authorization')))return no(401,'unauthorised');
 const text=await req.text();if(text.length>200_000)return no(413,'too_large');
 let input;try{input=body.parse(JSON.parse(text));}catch{return no(400,'bad_request');}
 const c=(await scenarios()).get(input.scenario_id);if(!c)return no(404,'unknown_scenario');
 try{
  const run=await runScenario(c,{mode:'simulation',recordActions:input.record_actions,approvalPolicy:'simulate_only'});
  return Response.json({...run.harness,scenario_id:c.id,trace:run,score:scoreRun(c,run)},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return no(500,String((e as Error)?.message||'run_failed').slice(0,120));}
}
export function GET(){return evalEnabled()?no(405,'use_post'):new Response('Not found',{status:404});}
