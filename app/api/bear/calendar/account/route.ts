import {json,withBear} from '@/lib/bear/server/context';
import {disconnect} from '@/lib/bear/calendar/accounts';
export const dynamic='force-dynamic';
// Disconnect: Bear deletes its stored (encrypted) tokens. The person can also remove Bear's access in their Microsoft account.
export const DELETE=(req:Request)=>withBear(req,async({store})=>{await disconnect(store);return json({connected:false});},{write:true});
