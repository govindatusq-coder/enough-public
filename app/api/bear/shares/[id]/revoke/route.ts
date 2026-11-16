import {json,withBear} from '@/lib/bear/server/context';
import {revoke,sharesFor} from '@/lib/bear/board/shares';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await revoke(store,sharesFor(store),id);return json({ok:true});});
