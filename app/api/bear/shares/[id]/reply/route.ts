import {json,readJson,withBear} from '@/lib/bear/server/context';
import {z} from 'zod';
import {senderReply} from '@/lib/bear/board/shares';
import {sharesForRequest} from '@/lib/bear/server/robot-shares';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {message}=z.object({message:z.string().trim().min(1).max(500)}).strict().parse(await readJson(req));await senderReply((await sharesForRequest(store)),store,id,message);return json({ok:true});});
