import {json,withBear} from '@/lib/bear/server/context';
import {openTasks} from '@/lib/bear/board/service';
import {helpKind} from '@/lib/bear/board/help';
import {readinessOf} from '@/lib/bear/board/logic';
export const dynamic='force-dynamic';
// Bear Helps: open things where Bear can get the work ready (a draft, call notes, steps, bill details, a prepared form).
export const GET=(req:Request)=>withBear(req,async({store})=>{
 const tasks=await openTasks(store);const bills=new Set((await store.list('bills')).filter(b=>b.status!=='dropped'&&b.status!=='archived').map(b=>b.taskId));
 const items=tasks.filter(t=>!(t.sharedOut?.mode==='transfer'&&t.readiness==='waiting')).map(t=>({id:t.id,title:t.title,kind:helpKind(t,bills.has(t.id)),readiness:readinessOf(t),savedAt:t.progress?.savedAt||null,dueAt:t.dueAt})).filter(i=>i.kind);
 items.sort((a,b)=>(a.readiness==='in_progress'?0:1)-(b.readiness==='in_progress'?0:1)||(a.dueAt||'9999').localeCompare(b.dueAt||'9999'));
 return json({items});
});
