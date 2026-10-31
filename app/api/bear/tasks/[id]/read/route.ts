import {json,readJson,withBear} from '@/lib/bear/server/context';
import {readSchema,setRead} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{const {id}=await params;return json(await setRead(store,provider,id,readSchema.parse(await readJson(req))));});
