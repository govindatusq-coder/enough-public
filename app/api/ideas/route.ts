import {signedIn} from '@/lib/supabase/server';
import {validateState} from '@/lib/account-validation';
import {completeProfile} from '@/lib/journey';
import {aiOutputSchema,generatorPrompt} from '@/lib/ai-ideas';
import {generateIdeaImage,prepareSuggestionPictures} from '@/lib/idea-image-service';
import {ideaImageStorage} from '@/lib/idea-image-storage';
import {eligible} from '@/lib/recommendations';
import {ideaSchema} from '@/lib/idea-validation';
import {mergeIdeas} from '@/lib/suggestion-history';
import {generateFreshCandidates,SuggestionBusy,withSuggestionRequest} from '@/lib/suggestion-service';
export const dynamic='force-dynamic';
export const maxDuration=300;
const json=(d:unknown,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store'}});
const config=()=>process.env;
export async function GET(){return json({available:!!config().OPENAI_API_KEY});}
export async function POST(req:Request){
 const {db,user}=await signedIn();if(!user)return json({error:'Sign in to request new ideas.'},401);
 if(req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Request origin is not allowed.'},403);
 if(!config().OPENAI_API_KEY)return json({error:'AI generation is not connected. Your personalised library ideas are still available.'},503);
 try{
  const {data:record,error:readError}=await db.from('enough_accounts').select('state_json,revision').eq('user_id',user.id).maybeSingle();if(readError)throw readError;
  if(!record)return json({error:'Keep your ENOUGH profile first.'},409);
  const state=validateState(record.state_json);if(!completeProfile(state.profile))return json({error:'Complete your PINS and routines first.'},409);
  if(state.profile.needs.some(n=>n.startsWith('Something else: ')))return json({error:'Your written need is saved. Review the listed boundaries in My Pins before requesting suggestions.'},409);
  const body=await req.json() as {timezone?:string};let now=new Date();
  if(body.timezone){
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:body.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
   const part=(k:string)=>parts.find(p=>p.type===k)?.value;
   now=new Date(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00`);
  }
  return await withSuggestionRequest(async id=>{
   const {data,error}=await db.rpc('enough_begin_ai_request',{p_request_id:id});if(error)throw error;return data===true;
  },async id=>{
   const {error}=await db.rpc('enough_end_ai_request',{p_request_id:id});if(error)throw error;
  },async()=>{
  const {data:recent,error:historyError}=await db.from('enough_ideas').select('idea_json').eq('user_id',user.id).order('sequence',{ascending:false}).limit(200);if(historyError)throw historyError;
  state.generated=mergeIdeas((recent||[]).map(row=>ideaSchema.parse(row.idea_json)).reverse(),state.generated||[]);
  const ideas=await generateFreshCandidates(state,now,async context=>{
   const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+config().OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:config().OPENAI_MODEL||'gpt-5-mini',store:false,reasoning:{effort:'low'},max_output_tokens:10000,input:[{role:'system',content:generatorPrompt},{role:'user',content:JSON.stringify(context)}],text:{format:{type:'json_schema',name:'enough_candidates',strict:true,schema:aiOutputSchema}}})
  });
  if(!response.ok)throw Error('Model request failed: '+response.status);
  const result=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};
  if(result.status!=='completed')throw Error('Incomplete model response');
  const raw=(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
   return JSON.parse(raw);
  },async candidates=>{
   const {data,error}=await db.rpc('enough_keep_ideas',{p_ideas:candidates});if(error)throw error;
   const kept=new Set((data||[]).map((row:{idea_json:unknown})=>ideaSchema.parse(row.idea_json).id));
   return candidates.filter(i=>kept.has(i.id));
  });
  // Pictures belong to the user's suggestion request, including missing older
  // pictures when a batch has spare capacity. Card reads never invoke the model.
  const previous=(state.generated||[]).filter(i=>eligible(i,state,now)&&!state.tuning?.hidden.includes(i.id));
  const pictures=await prepareSuggestionPictures(ideas,previous,user.id,ideaImageStorage(db),idea=>generateIdeaImage(idea,config().OPENAI_API_KEY||'',config().OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst'));
  if(pictures.errors.length)console.warn('Some idea pictures could not be prepared',{failed:pictures.errors.length,prepared:pictures.ready});
  return json({ideas,baseRevision:record.revision,picturesPrepared:pictures.ready,...(pictures.errors.length?{imageWarning:true}:{})});
  });
 }catch(e){if(e instanceof SuggestionBusy)return Response.json({error:e.message},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'5'}});console.error('Idea generation failed',e);return json({error:'New ideas could not be prepared. Your library remains available. Try again later.'},503);}
}
