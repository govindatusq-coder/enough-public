import {json,readJson,withBear} from '@/lib/bear/server/context';
import {z} from 'zod';
import {openInvite,sharesFor} from '@/lib/bear/board/shares';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const {token}=z.object({token:z.string().max(80)}).strict().parse(await readJson(req));const s=await openInvite(sharesFor(store),token);
 return json({share:{id:s.id,mode:s.mode,status:s.status,title:s.title,notes:s.notes,dueAt:s.dueAt,from:s.senderName,mine:s.senderId===store.userId,messages:s.messages}});});
