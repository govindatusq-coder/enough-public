import {json,withBear} from '@/lib/bear/server/context';
import {helpFor} from '@/lib/bear/board/help';
import {readinessOf,minutesFor} from '@/lib/bear/board/logic';
import {ensureProfile} from '@/lib/bear/services/profile';
export const dynamic='force-dynamic';
// Everything needed to pick a task up again: what Bear prepared, and whatever she had already done.
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,aiAvailable})=>{
 const {id}=await params;const task=await store.get('tasks',id);if(!task)return json({error:"Bear couldn't find that."},404);
 const bill=(await store.list('bills',{where:[{column:'task_id',value:id}]}))[0]||null;const profile=await ensureProfile(store);
 return json({task:{id:task.id,title:task.title,status:task.status,dueAt:task.dueAt,notes:task.notes??null,listId:task.listId??null,minutes:minutesFor(task),minutesBy:task.minutesBy??null,readiness:readinessOf(task),sharedOut:task.sharedOut??null,sharedIn:task.sharedIn??null},
  help:helpFor(task,bill,profile.name||''),progress:task.progress??null,aiAvailable});
});
