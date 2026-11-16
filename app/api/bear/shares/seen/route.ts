import {json,withBear} from '@/lib/bear/server/context';
import {sharesFor} from '@/lib/bear/board/shares';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const b=sharesFor(store);const {sent}=await b.mine();for(const s of sent)if(!s.senderSeen)await b.save({...s,senderSeen:true});return json({ok:true});});
