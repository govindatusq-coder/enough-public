import {json,withBear} from '@/lib/bear/server/context';
import {detailView} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json(await detailView(store,id));});
