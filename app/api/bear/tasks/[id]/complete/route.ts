import {json,readJson,withBear} from '@/lib/bear/server/context';
import {completeSchema,completeTask} from '@/lib/bear/services/completion';
import {sharesFor} from '@/lib/bear/board/shares';
export const dynamic='force-dynamic';
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const input=completeSchema.parse({...await readJson(req),taskId:id});const res=await completeTask(store,input);
 // Something someone handed her is finished: they see it straight away, without having to chase.
 const task=await store.get('tasks',id);
 if(task?.sharedIn){try{const b=sharesFor(store);const s=await b.get(task.sharedIn.shareId);if(s&&s.status==='accepted')await b.save({...s,status:'done',senderSeen:false});}catch{/* shown next time either opens the app */}}
 return json(res,201);
});
