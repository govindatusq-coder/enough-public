import {json,readJson,withBear} from '@/lib/bear/server/context';
import {recommendPlan} from '@/lib/bear/services/reminder-planning';
import {updateTask,updateTaskSchema} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const task=await store.get('tasks',id);if(!task)return json({error:"Bear couldn't find that."},404);
 const project=await store.get('projects',task.projectId);
 const bill=(await store.list('bills',{where:[{column:'task_id',value:task.id}]}))[0]||null;
 if(bill)return json({redirect:`/bear/bills/${bill.id}`});
 const reminders=await store.list('reminders',{where:[{column:'task_id',value:task.id}],orderBy:{column:'scheduled_for'}});
 const deps=await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]});
 const steps=(await Promise.all(deps.map(d=>store.get('tasks',d.dependsOnTaskId)))).filter(Boolean);
 const active=reminders.filter(r=>['scheduled','snoozed','delivered'].includes(r.status));
 const plan=task.status==='open'&&active.length===0&&!task.wishlist&&task.timing!=='flexible'?await recommendPlan(store,null,task):null;
 const documentId=project?.resourceDocumentIds[0]||null;
 return json({task,project,reminders,steps,plan,documentUrl:documentId?`/api/bear/documents/${documentId}`:null});
});
export const PATCH=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{const {id}=await params;return json({task:await updateTask(store,id,updateTaskSchema.parse(await readJson(req)))});});
