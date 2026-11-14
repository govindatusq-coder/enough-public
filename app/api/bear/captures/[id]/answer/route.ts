import {z} from 'zod';
import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {replyKind} from '@/lib/bear/services/sorter';
import {placeSorted,sortParts,todayFor} from '@/lib/bear/services/sort-service';
import {updateTask} from '@/lib/bear/services/task-edit';
export const dynamic='force-dynamic';
export const maxDuration=60;
// The answer to Bear's one question about a picture it could not read ("What do you need to do, and by when?"). The answer is
// the task; the picture stays attached to it. Bear does not ask a second question: if no date is given, the task has none.
const schema=z.object({text:z.string().trim().min(1).max(2000),guess:z.string().trim().max(120).optional()}).strict();
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store,provider})=>{
 const {id}=await params;const capture=await store.get('captures',id);if(!capture)throw new HttpError('Bear couldn’t find that picture.',404);
 const {text,guess}=schema.parse(await readJson(req,8*1024));
 if(replyKind(text)==='closing'){await store.update('captures',id,{status:'rejected'});return json({say:'No problem. I’ve left that one.'});}
 const {today,children}=await todayFor(store);const parts=await sortParts(text,provider,today,children);
 const sorted=[];
 for(const p of parts){
  const item=await placeSorted(store,p,'text',today);sorted.push(item);
  if(!item.taskId||item.already)continue;
  const task=await store.get('tasks',item.taskId);if(!task)continue;
  await updateTask(store,task.id,{notes:[guess?`From a picture you gave Bear (about “${guess}”).`:'From a picture you gave Bear.',task.notes||''].filter(Boolean).join('\n').slice(0,1000)}).catch(()=>null);
  // The picture is kept with the task, so it can be opened from there.
  if(capture.documentId){const project=await store.get('projects',task.projectId);if(project&&!project.resourceDocumentIds.includes(capture.documentId))await store.update('projects',project.id,{resourceDocumentIds:[...project.resourceDocumentIds,capture.documentId]}).catch(()=>null);}
 }
 await store.update('captures',id,{status:'verified'}).catch(()=>null);
 return json({sorted},201);
});
