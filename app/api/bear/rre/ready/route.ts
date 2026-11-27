import {json,readJson,withBear} from '@/lib/bear/server/context';
import {readyAmong,readySchema} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
// After a brain dump: which of the new things Bear can get ready itself.
export const POST=(req:Request)=>withBear(req,async({store})=>json(await readyAmong(store,readySchema.parse(await readJson(req)))));
