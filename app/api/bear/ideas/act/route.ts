import {json,readJson,withBear} from '@/lib/bear/server/context';
import {actOnIdea,ideaActSchema} from '@/lib/bear/services/ideas';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json(await actOnIdea(store,ideaActSchema.parse(await readJson(req)))));
