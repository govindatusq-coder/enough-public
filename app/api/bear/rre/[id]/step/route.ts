import {json,readJson,withBear} from '@/lib/bear/server/context';
import {stepAction,stepSchema} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json(await stepAction(store,id,stepSchema.parse(await readJson(req))));});
