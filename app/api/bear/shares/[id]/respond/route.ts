import {json,readJson,withBear} from '@/lib/bear/server/context';
import {respond,respondSchema,sharesFor} from '@/lib/bear/board/shares';
import {addOne} from '@/lib/bear/board/service';
import {pushToSender} from '@/lib/bear/server/share-push';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const s=await respond(store,sharesFor(store),id,respondSchema.parse(await readJson(req)),title=>addOne(store,{title,listId:null}));
 // The sender hears straight away (unless it's their quiet hours or push isn't set up; then they see it in the app).
 const pushed=await pushToSender(s).catch(()=>'failed' as const);
 return json({status:s.status,taskId:s.recipientTaskId,pushed});
});
