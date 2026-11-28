import {json,readJson,withBear} from '@/lib/bear/server/context';
import {momentFeedback,momentFeedbackSchema,recommendShare,sharePickSchema} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
// Lighten Load POST {exclude}: one task someone else could do (or null). PUT {taskId, surface, response}: what she chose.
export const POST=(req:Request)=>withBear(req,async({store})=>json(await recommendShare(store,sharePickSchema.parse(await readJson(req)))));
export const PUT=(req:Request)=>withBear(req,async({store})=>{await momentFeedback(store,momentFeedbackSchema.parse(await readJson(req,1024)));return json({ok:true});},{write:true});
