import {json,readJson,withBear} from '@/lib/bear/server/context';
import {confirmTask,confirmTaskSchema} from '@/lib/bear/services/task-inference';
import {recommendPlan} from '@/lib/bear/services/reminder-planning';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{const input=confirmTaskSchema.parse(await readJson(req));const result=await confirmTask(store,input);const plan=await recommendPlan(store,null,result.task);return json({...result,plan},201);});
