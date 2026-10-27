import {json,readJson,withBear} from '@/lib/bear/server/context';
import {relianceSchema,setReliance} from '@/lib/bear/services/priority';
export const dynamic='force-dynamic';
// "Is someone relying on you for this?" Optional; null = Bear decide.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {reliance}=relianceSchema.parse(await readJson(req));await setReliance(store,id,reliance);return json({ok:true});});
