import {json,readJson,withBear} from '@/lib/bear/server/context';
import {capacitySchema,setCapacity} from '@/lib/bear/services/ideas';
export const dynamic='force-dynamic';
// "What have you got room for?" Only for today, only if the person says. Bear has no calendar access.
export const POST=(req:Request)=>withBear(req,async({store})=>{const {value}=capacitySchema.parse(await readJson(req));await setCapacity(store,value);return json({ok:true});});
