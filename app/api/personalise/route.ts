import {signedIn} from '@/lib/supabase/server';
import {createPersonalisePost} from '@/lib/personalise-http';
import {personaliseOutputSchema,personalisePrompt} from '@/lib/opportunity-copy';
export const dynamic='force-dynamic';
export const maxDuration=30;
const config=()=>process.env;
export async function GET(){return Response.json({available:!!config().OPENAI_API_KEY},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 const {db,user}=await signedIn(req);
 return createPersonalisePost({
  authenticated:!!user,available:!!config().OPENAI_API_KEY,
  readAccount:async()=>{const {data,error}=await db.from('enough_accounts').select('state_json').eq('user_id',user!.id).maybeSingle();if(error)throw error;return data;},
  allow:async()=>{const {data,error}=await db.rpc('enough_take_wording_slot');if(error)throw error;return data===true;},
  generate:async context=>{
   const response=await fetch('https://api.openai.com/v1/responses',{
    method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+config().OPENAI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({model:config().OPENAI_MODEL||'gpt-5-mini',store:false,reasoning:{effort:'low'},max_output_tokens:1200,input:[{role:'system',content:personalisePrompt},{role:'user',content:JSON.stringify(context)}],text:{format:{type:'json_schema',name:'enough_wording',strict:true,schema:personaliseOutputSchema}}})
   });
   if(!response.ok)throw Error('Model request failed: '+response.status);
   const result=await response.json() as {status?:string;output?:{content?:{type:string;text?:string}[]}[]};
   if(result.status!=='completed')throw Error('Incomplete model response');
   return JSON.parse((result.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text||'').join(''));
  }
 })(req);
}
