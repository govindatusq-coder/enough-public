import {json,readJson,withBear} from '@/lib/bear/server/context';
import {changeSchema,changeSorted} from '@/lib/bear/services/sort-service';
export const dynamic='force-dynamic';
// Change one of the things Bear just sorted: by a tap (taskId + light or domain) or by a sentence ("actually, the dentist is urgent").
export const PATCH=(req:Request)=>withBear(req,async({store})=>json(await changeSorted(store,changeSchema.parse(await readJson(req)))));
