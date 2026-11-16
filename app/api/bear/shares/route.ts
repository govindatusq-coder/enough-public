import {json,readJson,withBear} from '@/lib/bear/server/context';
import {z} from 'zod';
import {shareSchema,shareTask,sharesFor,syncMine} from '@/lib/bear/board/shares';
import {completeTask} from '@/lib/bear/services/completion';
import {pushToSender} from '@/lib/bear/server/share-push';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const GET=(req:Request)=>withBear(req,async({store})=>{const b=sharesFor(store);const r=await syncMine(store,b,id=>completeTask(store,{taskId:id,method:'shared',evidence:'user'} as never),s=>pushToSender(s));return json(r);});
export const POST=(req:Request)=>withBear(req,async({store,user})=>{
 const body=await readJson(req);const {taskId}=z.object({taskId:z.string().uuid()}).passthrough().parse(body);const {taskId:_t,...rest}=body as Record<string,unknown>;void _t;
 const profile=await ensureProfile(store);
 const r=await shareTask(store,sharesFor(store),profile.name||user.name||'',taskId,shareSchema.parse(rest));
 return json({shareId:r.share.id,link:new URL(r.link,req.url).toString()},201);
});
