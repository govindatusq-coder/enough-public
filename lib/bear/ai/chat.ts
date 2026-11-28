import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
// Mama Bear's chat: the AI reads each message in the light of the conversation and decides what it is (a chat, a question, a
// link, or things to do) and acts through the tools it is given. Web search and page reading run on the AI service's side.
import {chatSystemPrompt,type ChatContext,type ChatTurn} from '@/lib/bear/services/chat-prompt';
export type {ChatContext,ChatTurn};

export interface ChatResult{text:string;toolCalls:{name:string;input:unknown;id:string}[];usage:{inputTokens:number;outputTokens:number};model:string;notes:string[]}
// Why a chat call failed, in words that never include what the person said: the service's status, error type and message.
export class ChatError extends Error{readonly status:number|undefined;constructor(message:string,status?:number){super(message);this.status=status;}}
export function describeError(e:unknown):string{
 if(e instanceof Anthropic.APIError){const body=(e.error as {error?:{type?:string;message?:string}}|undefined)?.error;return `${e.status??'?'} ${body?.type||e.name}: ${(body?.message||e.message||'').slice(0,240)}`;}
 if(e instanceof Error)return `${e.name}: ${e.message.slice(0,200)}`;return 'unknown error';
}
export type ToolRunner=(name:string,input:unknown)=>Promise<string>;
// `system` replaces the Drop Bear chat instructions (Lighten Load brings its own); `web` false leaves out web search.
export function chatFromEnv(tools:Anthropic.Beta.BetaToolUnion[],opts:{system?:string;web?:boolean}={}):((history:ChatTurn[],ctx:ChatContext,run:ToolRunner)=>Promise<ChatResult>)|null{
 const key=process.env.ANTHROPIC_API_KEY;if(!key)return null;
 const model=process.env.BEAR_MODEL||'claude-opus-5-5';const web=process.env.BEAR_WEB_LOOKUP!=='off'&&opts.web!==false;
 const all:Anthropic.Beta.BetaToolUnion[]=[...tools,...(web?[{type:'web_search_20260209',name:'web_search',max_uses:3,user_location:{type:'approximate',country:'AU'}},{type:'web_fetch_20260209',name:'web_fetch',max_uses:2,max_content_tokens:40000}] as Anthropic.Beta.BetaToolUnion[]:[])];
 return async(history,ctx,run)=>{
  const client=new Anthropic({apiKey:key,maxRetries:1,timeout:110_000});
  // If the service rejects the request as written, try again more plainly rather than give up: first without the backup-model
  // option, then without web tools and strict schemas. What was rejected is kept (no message content) so it can be fixed.
  let level=0;const notes:string[]=[];
  const plain=(tl:Anthropic.Beta.BetaToolUnion[])=>tl.filter(x=>!('type' in x)||!String((x as {type?:string}).type).startsWith('web_')).map(x=>{const y={...(x as unknown as Record<string,unknown>)};delete y.strict;return y as unknown as Anthropic.Beta.BetaToolUnion;});
  const ask=async(msgs:Anthropic.Beta.BetaMessageParam[]):Promise<Anthropic.Beta.BetaMessage>=>{
   for(;;){
    try{
     const base={model,max_tokens:4000,system:opts.system??chatSystemPrompt(ctx),output_config:{effort:'low' as const},tool_choice:{type:'auto' as const},messages:msgs};
     if(level===0)return await client.beta.messages.create({...base,betas:['server-side-fallback-2026-07-01'],fallbacks:'default',tools:all});
     if(level===1)return await client.beta.messages.create({...base,tools:all});
     return await client.beta.messages.create({...base,tools:plain(all)});
    }catch(e){
     const status=e instanceof Anthropic.APIError?e.status:undefined;notes.push(describeError(e));
     if(status===400&&level<2){level++;continue;}
     throw new ChatError(notes.join(' | '),status);
    }
   }
  };
  const messages:Anthropic.Beta.BetaMessageParam[]=history.map(h=>({role:h.role,content:h.content}));
  let text='';let input=0,output=0;let served=model;const calls:ChatResult['toolCalls']=[];
  for(let round=0;round<6;round++){
   const r=await ask(messages);
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
  return {text:text||'Done.',toolCalls:calls,usage:{inputTokens:input,outputTokens:output},model:served,notes};
 };
}
