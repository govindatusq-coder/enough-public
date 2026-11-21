import {json} from '@/lib/bear/server/context';
import {shareBearDeps} from '@/lib/bear/server/sharebear';
import {claimWindow} from '@/lib/bear/server/outbox-robot';
import {runFollowUps} from '@/lib/bear/sharebear/service';
export const dynamic='force-dynamic';export const maxDuration=60;
// Share Bear follow-up, on the same 15-minute schedule as reminders: one nudge while waiting for an answer, one reminder on
// the day it's due, one "still waiting" note to her, and expiry. One run per window across instances; counts only.
export async function GET(req:Request){
 const deps=await shareBearDeps(req);if(!deps)return json({skipped:'store_unavailable'});
 if(process.env.NEXT_PUBLIC_SUPABASE_URL){const c=await claimWindow('sb:'+Math.floor(Date.now()/600000));if(c!=='claimed')return json({skipped:c==='taken'?'already_ran_this_window':'lock_unavailable'});}
 return json({...(await runFollowUps(deps)),sms:deps.sms.mode});
}
