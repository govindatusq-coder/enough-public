import {z} from 'zod';
import type Anthropic from '@anthropic-ai/sdk';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {chatFromEnv} from '@/lib/bear/ai/chat';
import {addTasksTool,changeTaskTool,runAddTasks,runChangeTask} from '@/lib/bear/services/chat-tools';
import {todayFor,type SortedItem} from '@/lib/bear/services/sort-service';
import {ensureProfile} from '@/lib/bear/services/profile';
import {stamp} from '@/lib/bear/store/store';
import type {AIInference} from '@/lib/bear/domain/types';
export const dynamic='force-dynamic';
export const maxDuration=120;
// Mama Bear's chat. Each message goes to the AI with the recent conversation; it decides whether the person is chatting,
// asking something, sharing a link, or giving Bear things to do, and acts through add_tasks / web search / page reading.
// When the AI is not connected or fails, the reply says so and the app falls back to its own reading (`fallback: true`).
const DAILY_CHAT=150;
const schema=z.object({text:z.string().trim().min(1).max(8000),history:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().max(4000)}).strict()).max(24).default([]),recent:z.array(z.string().uuid()).max(60).default([])}).strict();
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const {text,history,recent}=schema.parse(await readJson(req,96*1024));
 const chat=chatFromEnv([addTasksTool,changeTaskTool] as unknown as Anthropic.Beta.BetaToolUnion[]);
 if(!chat)return json({fallback:true,reason:'off'},200);
 const since=Date.now()-24*3600000;
 const used=(await store.list('ai_inferences',{where:[{column:'service',value:'Chat'}]})).filter(i=>Date.parse(i.createdAt)>=since).length;
 if(used>=DAILY_CHAT)return json({fallback:true,reason:'limit'},200);
 const {today,children}=await todayFor(store);const profile=await ensureProfile(store);
 const weekday=new Date(`${today}T12:00:00`).toLocaleDateString('en-AU',{weekday:'long'});
 // The conversation must start with the person and take turns; the newest message goes last.
 const turns=[...history.filter((h,i)=>!(i===0&&h.role==='assistant')),{role:'user' as const,content:text}].filter(h=>h.content.trim());
 const said=turns.map(t=>t.content).join('\n');const items:SortedItem[]=[];const changed:SortedItem[]=[];const started=Date.now();
 try{
  const r=await chat(turns,{today,weekday,name:(profile.name||'').split(/\s+/)[0]||'',children},async(name,input)=>{
   if(name==='change_task'){const out=await runChangeTask(store,input,[...recent,...items.map(i=>i.taskId).filter((x):x is string=>!!x)],today);if(out.item)changed.push(out.item);return out.result;}
   if(name!=='add_tasks')return 'Unknown tool.';
   const out=await runAddTasks(store,input,said,today,children);items.push(...out.items);return out.result;
  });
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Chat',provider:'anthropic',model:r.model,promptHash:'chat-1',rawOutput:{tools:r.toolCalls.map(c=>c.name),added:items.length,changed:changed.length},latencyMs:Date.now()-started,ok:true,error:null,usage:r.usage}));
  return json({reply:r.text,sorted:items,changed});
 }catch{
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Chat',provider:'anthropic',model:'',promptHash:'chat-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:'chat_failed'})).catch(()=>null);
  // Anything already added stays added; the person is told, and the app takes the message its own way if nothing was.
  return json(items.length?{reply:'I’ve added what I could. Something went wrong after that, so check the list.',sorted:items}:{fallback:true,reason:'error'},200);
 }
},{write:true});
