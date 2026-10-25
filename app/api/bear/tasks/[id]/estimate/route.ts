import {json,withBear} from '@/lib/bear/server/context';
import {estimateTaskCost} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{const {id}=await params;return json({task:await estimateTaskCost(store,provider,id)});});
