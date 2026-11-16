import {json,withBear} from '@/lib/bear/server/context';
import {skip} from '@/lib/bear/rre/service';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await skip(store,id);return json({ok:true});});
