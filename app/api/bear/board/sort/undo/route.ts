import {json,readJson,withBear} from '@/lib/bear/server/context';
import {unsort,unsortSchema} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json(await unsort(store,unsortSchema.parse(await readJson(req)))));
