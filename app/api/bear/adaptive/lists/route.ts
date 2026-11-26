import {json,readJson,withBear} from '@/lib/bear/server/context';
import {chooseListStyle,listStyleSchema} from '@/lib/bear/adaptive/service';
export const dynamic='force-dynamic';
// She chose a set of Bear Brain lists. Nothing is deleted; things in lists that go away come back to My Brain Dump.
export const POST=(req:Request)=>withBear(req,async({store})=>json(await chooseListStyle(store,listStyleSchema.parse(await readJson(req,1024)))),{write:true});
