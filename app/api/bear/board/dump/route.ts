import {json,readJson,withBear} from '@/lib/bear/server/context';
import {dumpSchema,unload} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';export const maxDuration=60;
export const POST=(req:Request)=>withBear(req,async({store,provider})=>json(await unload(store,provider,dumpSchema.parse(await readJson(req))),201));
