import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {runAddTasks} from '@/lib/bear/services/chat-tools';
import {todayFor} from '@/lib/bear/services/sort-service';
import {ensureProfile} from '@/lib/bear/services/profile';
import {loadConversation,saveConversation} from '@/lib/bear/services/moment-chat';
export const dynamic='force-dynamic';export const maxDuration=60;
// Her answer to a to-do list Bear proposed in Bear Boost: save the items she kept, or leave it. Only a list Bear really
// proposed in her own conversation can be saved, and only once (a second tap gets the same result back).
const schema=z.object({actionId:z.string().min(3).max(80),keep:z.array(z.number().int().min(0).max(14)).max(15),cancel:z.boolean().optional()}).strict();
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const {actionId,keep,cancel}=schema.parse(await readJson(req,8*1024));
 await ensureProfile(store);const messages=await loadConversation(store);
 const m=messages.find(x=>x.actions?.some(a=>a.id===actionId&&a.kind==='proposed_tasks'));if(!m)return json({error:'That list isn’t in your conversation any more.'},404);
 const a=m.actions!.find(x=>x.id===actionId)!;
 if(a.state==='verified_success'||a.state==='cancelled')return json({action:a});
 if(cancel||!keep.length){a.state='cancelled';await saveConversation(store,messages);return json({action:a});}
 const chosen=(a.proposal||[]).filter((_,i)=>keep.includes(i));
 const {today,children}=await todayFor(store);
 const said=messages.map(x=>x.text).join('\n')+'\n'+chosen.map(c=>`${c.title} ${c.original}`).join('\n');
 const out=await runAddTasks(store,{tasks:chosen},said,today,children);
 a.state=out.items.length?'verified_success':'failed';a.items=out.items.map(i=>i.title);a.taskId=out.items[0]?.taskId||null;a.detail=out.items.length?'Saved in Bear Brain':'Couldn’t save these. Try again.';
 await saveConversation(store,messages);return json({action:a});
},{write:true});
