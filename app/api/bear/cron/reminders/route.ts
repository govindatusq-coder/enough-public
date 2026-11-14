import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {json} from '@/lib/bear/server/context';
import {pushConfig,sendPush} from '@/lib/bear/server/push';
import {SupabaseStore} from '@/lib/bear/store/supabase';
import {deliverForUser} from '@/lib/bear/services/delivery';
import {deliverOutbox} from '@/lib/bear/services/outbox';
import {allOutboxes,claimWindow,robotState,saveOutbox} from '@/lib/bear/server/outbox-robot';
export const dynamic='force-dynamic';
export const maxDuration=120;
// Scheduled delivery of due reminders by Web Push. Secured by BEAR_CRON_SECRET and requires
// the service-role key because it runs for every user with a push subscription; it does
// nothing else with that key. Without push configured it reports and exits.
export async function GET(req:Request){
 const secret=process.env.BEAR_CRON_SECRET;const authed=!!secret&&req.headers.get('authorization')===`Bearer ${secret}`;
 if(!pushConfig())return json({delivered:0,skipped:'push_not_configured'});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 // Without the database's master key (or without the caller's secret) the job reads the delivery outbox instead. That path needs no
 // caller secret (owner-approved): it only ever sends reminders that are already due, once, and the window lock stops repeat calls
 // doing any work. It returns counts only.
 if(!serviceKey||!authed)return outboxRun();
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,{auth:{persistSession:false}});
 // Run lock + visibility: one row per 10-minute window. A second run in the same window exits instead of double-sending.
 const now=new Date();const runKey=String(Math.floor(now.getTime()/600000));
 const lock=await admin.from('bear_job_runs').insert({job:'reminders',run_key:runKey});
 if(lock.error?.code==='23505')return json({delivered:0,skipped:'already_ran_this_window'});
 const tracked=!lock.error;   // if the table isn't there yet (migration not applied) the job still runs, just without the record
 const {data:subs,error}=await admin.from('bear_push_subscriptions').select('user_id,body');
 if(error){if(tracked)await admin.from('bear_job_runs').update({status:'failed',finished_at:new Date().toISOString(),note:'subscriptions_unavailable'}).eq('job','reminders').eq('run_key',runKey);return json({error:'Subscriptions unavailable.'},503);}
 const byUser=new Map<string,{endpoint:string;keys:{p256dh:string;auth:string}}[]>();
 for(const row of subs||[]){if(!/^https:\/\//.test(row.body?.endpoint||''))continue;const list=byUser.get(row.user_id)||[];list.push(row.body);byUser.set(row.user_id,list);}
 let delivered=0,failed=0,gone=0,usersFailed=0;
 for(const [userId,subscriptions] of byUser){
  try{const r=await deliverForUser(new SupabaseStore(userId,admin),subscriptions,sendPush,now);delivered+=r.delivered;failed+=r.failed;gone+=r.gone.length;
   for(const endpoint of r.gone)await admin.from('bear_push_subscriptions').delete().eq('user_id',userId).eq('body->>endpoint',endpoint);}
  catch{usersFailed++;}   // one person's problem never stops everyone else's reminders
 }
 const status=usersFailed>0&&delivered===0?'failed':'ok';
 if(tracked)await admin.from('bear_job_runs').update({status,finished_at:new Date().toISOString(),delivered,failed:failed+usersFailed}).eq('job','reminders').eq('run_key',runKey);
 // A run where every attempt failed returns an error so the scheduler (GitHub Actions) turns red and the owner is notified.
 return json({delivered,failed,removedSubscriptions:gone,usersFailed,users:byUser.size},status==='failed'?500:200);
}

async function outboxRun(){
 const now=new Date();const claim=await claimWindow(String(Math.floor(now.getTime()/600000)));
 if(claim==='taken')return json({delivered:0,skipped:'already_ran_this_window'});
 if(claim==='unavailable')return json({delivered:0,skipped:robotState()==='ready'?'outbox_lock_failed':'outbox_'+robotState()});
 const boxes=await allOutboxes();if(!boxes)return json({delivered:0,skipped:'outbox_unreadable'},503);
 let delivered=0,failed=0,usersFailed=0;
 for(const box of boxes){
  try{const r=await deliverOutbox(box,sendPush,now);delivered+=r.delivered;failed+=r.failed;if(r.changed)await saveOutbox(r.box);}
  catch{usersFailed++;}   // one person's problem never stops everyone else's reminders
 }
 return json({delivered,failed,usersFailed,users:boxes.length,via:'outbox'},usersFailed>0&&delivered===0?500:200);
}
