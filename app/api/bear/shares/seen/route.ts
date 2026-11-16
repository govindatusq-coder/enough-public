import {json,withBear} from '@/lib/bear/server/context';
import {sharesForRequest} from '@/lib/bear/server/robot-shares';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const b=(await sharesForRequest(store));const {sent}=await b.mine();for(const s of sent)if(!s.senderSeen)await b.save({...s,senderSeen:true});return json({ok:true});});
