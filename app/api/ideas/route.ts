import {signedIn} from '@/lib/supabase/server';
import {validateState} from '@/lib/account-validation';
import {completeProfile} from '@/lib/journey';
import {aiContext,aiOutputSchema,generatorPrompt,validateCandidates} from '@/lib/ai-ideas';
import {generateIdeaImage,prepareIdeaImageBatch} from '@/lib/idea-image-service';
import {ideaImageStorage} from '@/lib/idea-image-storage';
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
  const body=await req.json() as {timezone?:string};let now=new Date();
  if(body.timezone){
   const parts=new Intl.DateTimeFormat('en-CA',{timeZone:body.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
   const part=(k:string)=>parts.find(p=>p.type===k)?.value;
   now=new Date(`${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:00`);
  }
  const {data:slot,error:quotaError}=await db.rpc('enough_take_ai_slot');if(quotaError)throw quotaError;
  if(!slot)return json({error:'Fresh AI batches are paused for today. You can keep browsing your library and earlier ideas.'},429);
  const response=await fetch('https://api.openai.com/v1/responses',{
   method:'POST',signal:AbortSignal.timeout(60000),headers:{Authorization:'Bearer '+config().OPENAI_API_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({model:config().OPENAI_MODEL||'gpt-5-mini',store:false,reasoning:{effort:'low'},max_output_tokens:10000,input:[{role:'system',content:generatorPrompt},{role:'user',content:JSON.stringify(aiContext(state,now))}],text:{format:{type:'json_schema',name:'enough_candidates',strict:true,schema:aiOutputSchema}}})
  });
  if(!response.ok)throw Error('Model request failed: '+response.status);
  const result=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};
  if(result.status!=='completed')throw Error('Incomplete model response');
  const raw=(result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join('');
  const ideas=validateCandidates(JSON.parse(raw),state,now).slice(0,10);
  // Prepare at most ten pictures inside this already-reserved AI batch. Card
  // reads cannot incur image charges; explicit retries use the same quota RPC.
  const pictures=await prepareIdeaImageBatch(ideas,user.id,ideaImageStorage(db),idea=>generateIdeaImage(idea,config().OPENAI_API_KEY||'',config().OPENAI_IMAGE_MODEL||'gpt-image-2.5-sunburst'));
  if(pictures.errors.length)console.warn('Some idea pictures could not be prepared',{failed:pictures.errors.length,prepared:pictures.ready});
  return json({ideas,baseRevision:record.revision,...(pictures.errors.length?{imageWarning:pictures.errors[0].message}:{})});
 }catch(e){console.error('Idea generation failed',e);return json({error:'New ideas could not be prepared. Your library remains available. Try again later.'},503);}
}
