import type Anthropic from '@anthropic-ai/sdk';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {ChatError,chatFromEnv,describeError} from '@/lib/bear/ai/chat';
import {todayFor} from '@/lib/bear/services/sort-service';
import {ensureProfile} from '@/lib/bear/services/profile';
import {stamp} from '@/lib/bear/store/store';
import type {AIInference} from '@/lib/bear/domain/types';
import {DAILY_MOMENT_CHAT,SITTING_GAP_MS,contextTurns,draftMessage,feelingsOnly,findResponsibilities,proposeTasks,loadConversation,momentSystemPrompt,momentTools,offlineReply,prepareHelp,saveConversation,sendSchema,suggestForTime,withSafety,type MomentAction,type MomentMessage} from '@/lib/bear/services/moment-chat';
export const dynamic='force-dynamic';
export const maxDuration=120;
// Got a Moment?: the one entry point for talking to Bear. The conversation is private to the person (kept on her own
// profile). Bear acts only through the tools in moment-chat.ts, each backed by the responsibility engine; nothing here sends,
// books, buys or shares. The person's words are never written to logs.

// The kept conversation, and whether it is recent enough to carry on (otherwise the screen opens fresh; nothing is deleted).
export const GET=(req:Request)=>withBear(req,async({store})=>{
 await ensureProfile(store);const messages=await loadConversation(store);
 const last=messages[messages.length-1];
 return json({messages,resume:!!last&&Date.now()-Date.parse(last.at)<SITTING_GAP_MS});
});
// Clear the conversation (her choice).
export const DELETE=(req:Request)=>withBear(req,async({store})=>{await ensureProfile(store);await saveConversation(store,[]);return json({ok:true});},{write:true});

export const POST=(req:Request)=>withBear(req,async({store,provider})=>{
 const {id,text}=sendSchema.parse(await readJson(req,32*1024));
 await ensureProfile(store);
 const history=await loadConversation(store);
 // The same message sent twice (a retry after a dropped connection) gets the reply already given, not a second one.
 const seen=history.findIndex(m=>m.id===id&&m.role==='user');
 if(seen>=0){const reply=history[seen+1]?.role==='bear'?history[seen+1]:null;if(reply)return json({messages:[history[seen],reply]});}
 const now=new Date();
 const mine:MomentMessage={id,role:'user',at:now.toISOString(),text};
 const base=seen>=0?history.slice(0,seen):history;
 const convo=[...base,mine];
 const reply=async(t:string,actions:MomentAction[]):Promise<Response>=>{
  const bear:MomentMessage={id:`b-${id}`,role:'bear',at:new Date().toISOString(),text:withSafety(t,text),...(actions.length?{actions}:{})};
  await saveConversation(store,[...convo,bear]);return json({messages:[mine,bear]});
 };
 const {today,children}=await todayFor(store);const profile=await ensureProfile(store);
 const weekday=new Date(`${today}T12:00:00`).toLocaleDateString('en-AU',{weekday:'long'});
 const ctx={today,weekday,name:(profile.name||'').split(/\s+/)[0]||'',children};
 // When she is talking about how she feels (and asking for nothing practical), Bear has no tools: no list or card comes back.
 const quiet=feelingsOnly(text);
 const chat=chatFromEnv((quiet?[]:momentTools) as unknown as Anthropic.Beta.BetaToolUnion[],{system:momentSystemPrompt(ctx)+(quiet?'\nRight now she is talking about how she feels. Respond to that only, briefly and kindly. No tasks, lists, plans or offers of help with tasks.':''),web:false});
 const since=Date.now()-24*3600000;
 const used=chat?(await store.list('ai_inferences',{where:[{column:'service',value:'MomentChat'}]})).filter(i=>Date.parse(i.createdAt)>=since).length:0;
 if(!chat||used>=DAILY_MOMENT_CHAT){const o=await offlineReply(store,text,now);return reply(o.text,o.actions);}
 const actions:MomentAction[]=[];const started=Date.now();
 try{
  const r=await chat(contextTurns(convo),ctx,async(name,input)=>{
   const i=(input||{}) as Record<string,unknown>;
   if(name==='find_responsibilities'){const o=await findResponsibilities(store,typeof i.query==='string'?i.query.slice(0,120):null,now);actions.push(...o.actions);return o.result;}
   if(name==='suggest_for_time'){const o=await suggestForTime(store,Number(i.minutes),now);actions.push(...o.actions);return o.result;}
   if(name==='prepare_help'){const o=await prepareHelp(store,provider,i.task_id,now);actions.push(...o.actions);return o.result;}
   if(name==='draft_message'){const o=await draftMessage(store,input);actions.push(...o.actions);return o.result;}
   if(name==='propose_tasks'){const o=proposeTasks(input);actions.push(...o.actions);return o.result;}
   return 'Unknown tool.';
  });
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'MomentChat',provider:'anthropic',model:r.model,promptHash:'moment-1',rawOutput:{tools:r.toolCalls.map(c=>c.name),actions:actions.map(a=>a.kind)},latencyMs:Date.now()-started,ok:true,error:null,usage:r.usage}));
  // A responsibility already shown as a suggestion or as prepared work is not shown again as a plain card.
  const shown=new Set(actions.filter(a=>a.kind!=='responsibility').map(a=>a.taskId));
  return reply(r.text,actions.filter(a=>a.kind!=='responsibility'||!shown.has(a.taskId)).slice(0,6));
 }catch(e){
  const why=e instanceof ChatError?e.message:describeError(e);console.error('[bear] moment chat failed:',why);
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'MomentChat',provider:'anthropic',model:'',promptHash:'moment-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:why.slice(0,600)})).catch(()=>null);
  if(actions.length)return reply('I got part of the way there, then something went wrong. Here’s what I have.',actions);
  const o=await offlineReply(store,text,now);
  return reply(o.actions.length?o.text:'Sorry, I lost my train of thought just then. Could you say that again?',o.actions);
 }
},{write:true});
