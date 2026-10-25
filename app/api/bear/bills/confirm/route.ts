import {json,readJson,withBear} from '@/lib/bear/server/context';
import {confirmBill,confirmBillSchema} from '@/lib/bear/services/task-inference';
import {acceptPlan,recommendPlan} from '@/lib/bear/services/reminder-planning';
import {autoSetupEnabled} from '@/lib/bear/services/auto-setup';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const input=confirmBillSchema.parse(await readJson(req));
 const result=await confirmBill(store,input);
 const plan=await recommendPlan(store,result.bill,result.task);
 // Bills are always time-sensitive, so once the person has checked the details Bear plans the reminder itself.
 // They can change it on the bill page; no plan sheet stands between them and being done.
 let planned=false;
 if(autoSetupEnabled(await ensureProfile(store))&&plan.suggested.when){try{await acceptPlan(store,{billId:result.bill.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:plan.followUpDefault});planned=true;}catch{/* the bill page offers the plan */}}
 return json({...result,plan,planned},201);
});
