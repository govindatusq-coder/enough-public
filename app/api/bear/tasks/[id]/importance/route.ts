import {json,readJson,withBear} from '@/lib/bear/server/context';
import {importanceSchema,setImportance} from '@/lib/bear/services/priority';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;const {level}=importanceSchema.parse(await readJson(req));await setImportance(store,id,level);return json({ok:true});});
