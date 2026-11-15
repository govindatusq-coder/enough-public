import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
// Mama Bear's chat: the AI reads each message in the light of the conversation and decides what it is (a chat, a question, a
// link, or things to do) and acts through the tools it is given. Web search and page reading run on the AI service's side.
import {chatSystemPrompt,type ChatContext,type ChatTurn} from '@/lib/bear/services/chat-prompt';
export type {ChatContext,ChatTurn};

export interface ChatResult{text:string;toolCalls:{name:string;input:unknown;id:string}[];usage:{inputTokens:number;outputTokens:number};model:string}
export type ToolRunner=(name:string,input:unknown)=>Promise<string>;
export function chatFromEnv(tools:Anthropic.Beta.BetaToolUnion[]):((history:ChatTurn[],ctx:ChatContext,run:ToolRunner)=>Promise<ChatResult>)|null{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)return null;
 const model=process.env.BEAR_MODEL||'claude-opus-5-5';const web=process.env.BEAR_WEB_LOOKUP!=='off';
 const all:Anthropic.Beta.BetaToolUnion[]=[...tools,...(web?[{type:'web_search_20260209',name:'web_search',max_uses:3,user_location:{type:'approximate',country:'AU'}},{type:'web_fetch_20260209',name:'web_fetch',max_uses:2,max_content_tokens:40000}] as Anthropic.Beta.BetaToolUnion[]:[])];
 return async(history,ctx,run)=>{
  const client=new Anthropic({apiKey:key,maxRetries:1,timeout:110_000});
  const messages:Anthropic.Beta.BetaMessageParam[]=history.map(h=>({role:h.role,content:h.content}));
  let text='';let input=0,output=0;let served=model;const calls:ChatResult['toolCalls']=[];
  for(let round=0;round<6;round++){
   const r=await client.beta.messages.create({model,max_tokens:4000,betas:['server-side-fallback-2026-07-01'],fallbacks:'default',system:chatSystemPrompt(ctx),output_config:{effort:'low'},tools:all,tool_choice:{type:'auto'},messages});
   served=r.model;input+=r.usage.input_tokens;output+=r.usage.output_tokens;
   const said=r.content.filter((b):b is Anthropic.Beta.BetaTextBlock=>b.type==='text').map(b=>b.text).join('').trim();
   if(r.stop_reason==='refusal'){text=text||'Sorry, I can’t help with that one.';break;}
   if(r.stop_reason==='pause_turn'){messages.push({role:'assistant',content:r.content});continue;}
   if(r.stop_reason==='tool_use'){
    messages.push({role:'assistant',content:r.content});const results:Anthropic.Beta.BetaToolResultBlockParam[]=[];
    for(const b of r.content)if(b.type==='tool_use'){calls.push({name:b.name,input:b.input,id:b.id});let out:string;try{out=await run(b.name,b.input);}catch{out='That did not work.';}results.push({type:'tool_result',tool_use_id:b.id,content:out});}
    messages.push({role:'user',content:results});if(said)text=said;continue;
   }
   text=said||text;break;
  }
  return {text:text||'Done.',toolCalls:calls,usage:{inputTokens:input,outputTokens:output},model:served};
 };
}
