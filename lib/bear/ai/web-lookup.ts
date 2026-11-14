import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {lookupSystemPrompt,readFinding,type PageReader,type Researcher,type Source} from '@/lib/bear/services/lookup';
import {pageEventsPrompt} from '@/lib/bear/services/page-events';
// Web lookup through the AI service's own search tool (it runs on the service's side: nothing is fetched from this server).
// A paid extra, switched on by the owner; capped per person per day by the caller. At most three searches per question.
export function researcherFromEnv():Researcher|null{
 const key=process.env.ANTHROPIC_API_KEY;if(!key||process.env.BEAR_WEB_LOOKUP==='off')return null;
 const model=process.env.BEAR_MODEL||'claude-opus-5-5';
 return async(question,today)=>{
  const client=new Anthropic({apiKey:key,maxRetries:1,timeout:80_000});
  const tools:Anthropic.ToolUnion[]=[{type:'web_search_20260209',name:'web_search',max_uses:3,user_location:{type:'approximate',country:'AU'}}];
  const messages:Anthropic.MessageParam[]=[{role:'user',content:question}];
  const returned:Source[]=[];let text='';let searches=0;let input=0,output=0;let served=model;
  // The service may pause a long search turn; it is resumed by sending back what it has so far (twice at most).
  for(let turn=0;turn<3;turn++){
   const r=await client.messages.create({model,max_tokens:4000,system:lookupSystemPrompt(today),output_config:{effort:'low'},tools,messages});
   served=r.model;input+=r.usage.input_tokens;output+=r.usage.output_tokens;
   for(const b of r.content){
    if(b.type==='server_tool_use'&&b.name==='web_search')searches++;
    // A successful search is a list of pages; a failed one is a single error object, not an exception.
    else if(b.type==='web_search_tool_result'&&Array.isArray(b.content))for(const p of b.content)returned.push({title:p.title.slice(0,120),url:p.url});
    else if(b.type==='text')text+=b.text;
   }
   if(r.stop_reason==='pause_turn'){messages.push({role:'assistant',content:r.content});text='';continue;}
   if(r.stop_reason==='refusal')return {finding:null,usage:{inputTokens:input,outputTokens:output},searches,model:served};
   break;
  }
  return {finding:readFinding(text,returned,today),usage:{inputTokens:input,outputTokens:output},searches,model:served};
 };
}

// Reading a page from its address, through the AI service's own fetch tool (the page is fetched on the service's side: this
// server never opens the link itself). One fetch per link; long pages are capped so a huge page cannot run up a huge bill.
export function pageReaderFromEnv():PageReader|null{
 const key=process.env.ANTHROPIC_API_KEY;if(!key||process.env.BEAR_WEB_LOOKUP==='off')return null;
 const model=process.env.BEAR_MODEL||'claude-opus-5-5';
 return async(url,today)=>{
  const client=new Anthropic({apiKey:key,maxRetries:1,timeout:100_000});
  const tools:Anthropic.ToolUnion[]=[{type:'web_fetch_20260209',name:'web_fetch',max_uses:1,max_content_tokens:40000}];
  const system=pageEventsPrompt(today)+`\nThe page is at the address the person gives. Fetch it once, then reply with ONLY a JSON object {"events":[...]} using exactly the fields above (title, date, endDate, time, action, actionDue, source), no other text. If the page cannot be opened, reply {"events":[]}.`;
  const messages:Anthropic.MessageParam[]=[{role:'user',content:`Read this page and list everything on it: ${url}`}];
  let text='';let failed=false;let fetched=false;let input=0,output=0;let served=model;
  for(let turn=0;turn<3;turn++){
   const r=await client.messages.create({model,max_tokens:8000,system,output_config:{effort:'low'},tools,messages});
   served=r.model;input+=r.usage.input_tokens;output+=r.usage.output_tokens;
   for(const b of r.content){
    // A fetch that fails comes back as an error object in the result, not as an exception.
    if(b.type==='web_fetch_tool_result'){if(b.content.type==='web_fetch_tool_result_error')failed=true;else fetched=true;}
    else if(b.type==='text')text+=b.text;
   }
   if(r.stop_reason==='pause_turn'){messages.push({role:'assistant',content:r.content});text='';continue;}
   break;
  }
  let events:unknown=null;const m=/\{[\s\S]*\}/.exec(text);if(m){try{events=JSON.parse(m[0]);}catch{events=null;}}
  return {events:fetched?events:null,failed:failed||!fetched,usage:{inputTokens:input,outputTokens:output},model:served};
 };
}
