import {json,withBear} from '@/lib/bear/server/context';
import {revoke} from '@/lib/bear/board/shares';
import {sharesForRequest} from '@/lib/bear/server/robot-shares';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await revoke(store,(await sharesForRequest(store)),id);return json({ok:true});});
