import {signedIn} from '@/lib/supabase/server';
import {aiOutputSchema,generatorPrompt} from '@/lib/ai-ideas';
import {generateIdeaImage,prepareSuggestionPictures} from '@/lib/idea-image-service';
import {ideaImageStorage} from '@/lib/idea-image-storage';
import {ideaSchema} from '@/lib/idea-validation';
import {withSuggestionRequest} from '@/lib/suggestion-service';
import {createIdeasPost} from '@/lib/ideas-http';
export const dynamic='force-dynamic';
export const maxDuration=300;
const config=()=>process.env;
export async function GET(){return Response.json({available:!!config().OPENAI_API_KEY},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 const {db,user}=await signedIn(req);
 return createIdeasPost({
  authenticated:!!user,available:!!config().OPENAI_API_KEY,
  readAccount:async()=>{const {data,error}=await db.from('enough_accounts').select('state_json,revision').eq('user_id',user!.id).maybeSingle();if(error)throw error;return data;},
  readConsent:async()=>{const {data,error}=await db.from('enough_accounts').select('state_json').eq('user_id',user!.id).maybeSingle();if(error)throw error;return (data?.state_json as {aiConsent?:unknown}|null)?.aiConsent;},
  recentIdeas:async()=>{const {data,error}=await db.from('enough_ideas').select('idea_json').eq('user_id',user!.id).order('sequence',{ascending:false}).limit(200);if(error)throw error;return (data||[]).map(row=>ideaSchema.parse(row.idea_json)).reverse();},
  withRequest:work=>withSuggestionRequest(async id=>{const {data,error}=await db.rpc('enough_begin_ai_request',{p_request_id:id});if(error)throw error;return data===true;},async id=>{const {error}=await db.rpc('enough_end_ai_request',{p_request_id:id});if(error)throw error;},work),
  generate:async context=>{
   const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+config().OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:config().OPENAI_MODEL||'gpt-5-mini',store:false,reasoning:{effort:'low'},max_output_tokens:10000,input:[{role:'system',content:generatorPrompt},{role:'user',content:JSON.stringify(context)}],text:{format:{type:'json_schema',name:'enough_candidates',strict:true,schema:aiOutputSchema}}})
   });
   if(!response.ok)throw Error('Model request failed: '+response.status);
   const result=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};
   if(result.status!=='completed')throw Error('Incomplete model response');
   const raw=(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
   return JSON.parse(raw);
  },
  keep:async candidates=>{const {data,error}=await db.rpc('enough_keep_ideas',{p_ideas:candidates});if(error)throw error;const kept=new Set((data||[]).map((row:{idea_json:unknown})=>ideaSchema.parse(row.idea_json).id));return candidates.filter(i=>kept.has(i.id));},
  // Bespoke AI pictures are off by default: suggestions use the curated illustration library.
  // Set ENOUGH_AI_PICTURES=on to prepare generated pictures for classic AI ideas again.
  pictures:async(ideas,previous,checkConsent)=>config().ENOUGH_AI_PICTURES!=='on'?{ready:0,errors:[]}:prepareSuggestionPictures(ideas,previous,user!.id,ideaImageStorage(db),async idea=>{await checkConsent();return generateIdeaImage(idea,config().OPENAI_API_KEY||'',config().OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst');})
 })(req);
}
