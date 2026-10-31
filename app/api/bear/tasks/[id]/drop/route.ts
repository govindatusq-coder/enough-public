import {json,withBear} from '@/lib/bear/server/context';
import {dropTask} from '@/lib/bear/services/completion';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;await dropTask(store,id);return json({ok:true});});
