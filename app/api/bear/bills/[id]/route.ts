import {json,withBear} from '@/lib/bear/server/context';
import {assistanceFor} from '@/lib/bear/services/assistance';
import {recommendPlan} from '@/lib/bear/services/reminder-planning';
import {readLoad} from '@/lib/bear/services/load';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const bill=await store.get('bills',id);if(!bill)return json({error:"Bear couldn't find that bill."},404);
 const task=await store.get('tasks',bill.taskId);if(!task)return json({error:"Bear couldn't find that bill."},404);
 const reminders=await store.list('reminders',{where:[{column:'bill_id',value:bill.id}],orderBy:{column:'scheduled_for'}});
 const deps=await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]});
 const steps=(await Promise.all(deps.map(d=>store.get('tasks',d.dependsOnTaskId)))).filter(Boolean);
 const active=reminders.filter(r=>['scheduled','snoozed','delivered'].includes(r.status));
 const plan=task.status==='open'&&active.length===0?await recommendPlan(store,bill,task):null;
 const assistance=await assistanceFor(store,bill);
 const expectation=bill.recurringExpectationId?await store.get('recurring_expectations',bill.recurringExpectationId):null;
 const load=await readLoad(store,task);
 return json({bill,task,reminders,steps,plan,assistance,expectation,load:load.view,documentUrl:bill.documentId?`/api/bear/documents/${bill.documentId}`:null});
});
