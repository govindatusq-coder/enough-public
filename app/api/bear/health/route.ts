import {createClient} from '@supabase/supabase-js';
import {json} from '@/lib/bear/server/context';
import {indexes} from '@/lib/bear/store/store';
import {pushConfig} from '@/lib/bear/server/push';
import {providerFromEnv} from '@/lib/bear/ai/provider';
import {inboundConfig} from '@/lib/bear/server/inbound';
import {calendarConfig} from '@/lib/bear/calendar/config';
export const dynamic='force-dynamic';
export const maxDuration=30;
// The owner's one-glance check. Protected by BEAR_CRON_SECRET. Returns yes/no flags and COUNTS only: never a name, a document,
// a message or anything about a family. Anything it can't check says so instead of guessing.
export async function GET(req:Request){
 const secret=process.env.BEAR_CRON_SECRET;if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return json({error:'Not allowed.'},401);
 const config={ai:!!providerFromEnv(),push:!!pushConfig(),serviceRoleKey:!!process.env.SUPABASE_SERVICE_ROLE_KEY,inboundEmail:inboundConfig().ready,calendar:calendarConfig().ready};
 const out:Record<string,unknown>={build:(process.env.NEXT_PUBLIC_BEAR_BUILD||'dev').slice(0,12),config,problems:[] as string[]};const problems=out.problems as string[];
 if(!config.serviceRoleKey){problems.push('SUPABASE_SERVICE_ROLE_KEY is not set: scheduled reminders and these database checks cannot run.');out.database=null;out.reminders=null;out.ai=null;return json({ok:false,...out});}
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 // Which tables are missing (a migration not applied)?
 const names=[...Object.keys(indexes),'job_runs'];const missing:string[]=[];
 await Promise.all(names.map(async t=>{const {error}=await admin.from('bear_'+t).select('*',{count:'exact',head:true}).limit(1);if(error&&(error.code==='42P01'||/does not exist|schema cache/i.test(error.message)))missing.push('bear_'+t);}));
 out.database={missingTables:missing.sort()};if(missing.length)problems.push(`Missing tables (apply their migrations): ${missing.sort().join(', ')}`);
 const since=new Date(Date.now()-24*3600000).toISOString();
 // Reminders: did the job run, did it fail, is anything overdue and unsent?
 const run=await admin.from('bear_job_runs').select('started_at,status,delivered,failed').eq('job','reminders').order('started_at',{ascending:false}).limit(1);
 const overdue=await admin.from('bear_reminders').select('id',{count:'exact',head:true}).eq('status','scheduled').lt('scheduled_for',new Date(Date.now()-3*3600000).toISOString());
 const last=run.data?.[0]||null;out.reminders={lastRun:last,overdueUnsent:overdue.error?null:overdue.count??0};
 if(!last)problems.push('The reminder job has not recorded a run (check the GitHub Actions schedule and its secrets).');
 else if(Date.now()-new Date(last.started_at).getTime()>2*3600000)problems.push('The reminder job has not run in over 2 hours.');
 if(last?.status==='failed')problems.push('The last reminder run failed.');
 if((overdue.count||0)>0)problems.push(`${overdue.count} reminders are overdue by 3+ hours and still unsent.`);
 // AI: calls, failures and MEASURED tokens in the last 24 hours (never estimated).
 const ai=await admin.from('bear_ai_inferences').select('body').gte('created_at',since).limit(5000);
 const rows=(ai.data||[]).map(r=>r.body as {model:string;ok:boolean;usage?:{inputTokens:number;outputTokens:number}|null});
 const tokens=rows.reduce((a,r)=>({i:a.i+(r.usage?.inputTokens||0),o:a.o+(r.usage?.outputTokens||0),n:a.n+(r.usage?1:0)}),{i:0,o:0,n:0});
 const pi=Number(process.env.BEAR_PRICE_INPUT_PER_MTOK),po=Number(process.env.BEAR_PRICE_OUTPUT_PER_MTOK);
 out.ai={last24h:{calls:rows.length,failures:rows.filter(r=>!r.ok).length,callsWithMeasuredUsage:tokens.n,inputTokens:tokens.i,outputTokens:tokens.o},
  estimatedUsd:Number.isFinite(pi)&&Number.isFinite(po)?+((tokens.i*pi+tokens.o*po)/1e6).toFixed(2):null,estimateBasis:Number.isFinite(pi)&&Number.isFinite(po)?'tokens measured; prices supplied by the owner (BEAR_PRICE_*)':'no prices supplied, so no cost is estimated'};
 if(rows.length>=10&&rows.filter(r=>!r.ok).length/rows.length>0.3)problems.push('More than 30% of AI reads failed in the last 24 hours.');
 return json({ok:problems.length===0,...out});
}
