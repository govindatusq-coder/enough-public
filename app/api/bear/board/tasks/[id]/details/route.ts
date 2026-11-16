import {json,readJson,withBear} from '@/lib/bear/server/context';
import {detailsSchema,setDetails} from '@/lib/bear/board/service';
export const dynamic='force-dynamic';
export const PATCH=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await setDetails(store,id,detailsSchema.parse(await readJson(req)));return json({ok:true});});
