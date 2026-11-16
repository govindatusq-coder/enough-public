import {json,readJson,withBear} from '@/lib/bear/server/context';
import {bulkSort,bulkSortSchema} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>json(await bulkSort(store,bulkSortSchema.parse(await readJson(req)))));
