import {json,readJson,withBear} from '@/lib/bear/server/context';
import {momentSchema,recommend} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
// Bear Boost One useful action for the time she has (or an honest "nothing needs you").
export const POST=(req:Request)=>withBear(req,async({store})=>json(await recommend(store,momentSchema.parse(await readJson(req)))));
