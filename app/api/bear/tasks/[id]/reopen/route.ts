import {json,withBear} from '@/lib/bear/server/context';
import {reopenTask} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json({task:await reopenTask(store,id)});});
