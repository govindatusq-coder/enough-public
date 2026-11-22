import {json,readJson,withBear} from '@/lib/bear/server/context';
import {breakFeedbackSchema,breakSchema,likeBreak,suggestBreak} from '@/lib/bear/services/moment-break';
export const dynamic='force-dynamic';
// Need a Break: POST {minutes, exclude} for one idea; PUT {id, value:'liked'} when she says "Sounds good".
export const POST=(req:Request)=>withBear(req,async({store})=>json(await suggestBreak(store,breakSchema.parse(await readJson(req,2048)))),{write:true});
export const PUT=(req:Request)=>withBear(req,async({store})=>{const {id}=breakFeedbackSchema.parse(await readJson(req,1024));await likeBreak(store,id);return json({ok:true});},{write:true});
