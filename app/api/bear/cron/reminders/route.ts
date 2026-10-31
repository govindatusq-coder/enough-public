import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {json} from '@/lib/bear/server/context';
import {pushConfig,sendPush} from '@/lib/bear/server/push';
import {SupabaseStore} from '@/lib/bear/store/supabase';
import {dueReminders,markDelivered} from '@/lib/bear/services/reminders';
export const dynamic='force-dynamic';
export const maxDuration=120;
// Scheduled delivery of due reminders by Web Push. Secured by BEAR_CRON_SECRET and requires
// the service-role key because it runs for every user with a push subscription; it does
// nothing else with that key. Without push configured it reports and exits.
export async function GET(req:Request){
 const secret=process.env.BEAR_CRON_SECRET;const auth=req.headers.get('authorization');
 if(!secret||auth!==`Bearer ${secret}`)return json({error:'Not allowed.'},401);
 if(!pushConfig())return json({delivered:0,skipped:'push_not_configured'});
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!serviceKey)return json({delivered:0,skipped:'service_role_key_missing'});
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,serviceKey,{auth:{persistSession:false}});
 const {data:subs,error}=await admin.from('bear_push_subscriptions').select('user_id,body');if(error)return json({error:'Subscriptions unavailable.'},503);
 const byUser=new Map<string,{endpoint:string;keys:{p256dh:string;auth:string}}[]>();
 for(const row of subs||[]){const list=byUser.get(row.user_id)||[];list.push(row.body);byUser.set(row.user_id,list);}
 let delivered=0,gone=0;const now=new Date();
 for(const [userId,subscriptions] of byUser){
  const store=new SupabaseStore(userId,admin);
  for(const due of await dueReminders(store,now)){
   if(due.reminder.deliveredVia.includes('push'))continue;
   let sent=false;
   for(const s of subscriptions){const result=await sendPush(s,{title:'Load Bear',body:due.decision.message,url:due.billId?`/bear/bills/${due.billId}?reminder=${due.reminder.id}`:'/bear/home',tag:due.reminder.id});if(result==='sent')sent=true;if(result==='gone'){gone++;for(const row of await store.list('push_subscriptions',{where:[{column:'endpoint',value:s.endpoint}]}))await store.remove('push_subscriptions',row.id);}}
   if(sent){await markDelivered(store,due.reminder.id,'push',now);delivered++;}
  }
 }
 return json({delivered,removedSubscriptions:gone,users:byUser.size});
}
