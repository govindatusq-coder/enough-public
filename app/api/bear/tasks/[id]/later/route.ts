import {json,readJson,withBear} from '@/lib/bear/server/context';
import {laterSchema,notToday} from '@/lib/bear/services/priority';
export const dynamic='force-dynamic';
// "Not today" is information, not failure: Bear steps back until tomorrow and learns a little.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {reason}=laterSchema.parse(await readJson(req));return json(await notToday(store,id,reason??null));});
