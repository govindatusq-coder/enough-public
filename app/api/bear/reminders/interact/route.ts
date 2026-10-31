import {json,readJson,withBear} from '@/lib/bear/server/context';
import {interact,interactSchema} from '@/lib/bear/services/reminders';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json({reminder:await interact(store,interactSchema.parse(await readJson(req)))}));
