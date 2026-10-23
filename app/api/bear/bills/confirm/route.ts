import {json,readJson,withBear} from '@/lib/bear/server/context';
import {confirmBill,confirmBillSchema} from '@/lib/bear/services/task-inference';
import {recommendPlan} from '@/lib/bear/services/reminder-planning';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const input=confirmBillSchema.parse(await readJson(req));
 const result=await confirmBill(store,input);
 const plan=await recommendPlan(store,result.bill,result.task);
 return json({...result,plan},201);
});
