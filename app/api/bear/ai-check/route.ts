import {withBear,json} from '@/lib/bear/server/context';
import {generalOutputJsonSchema,generalSystemPrompt} from '@/lib/bear/ai/general-schema';
import {ProviderError} from '@/lib/bear/ai/provider';
export const dynamic='force-dynamic';
export const maxDuration=60;
// Sends one tiny generated picture through the configured AI provider and reports the exact
// outcome, so a user can tell whether photo reading works without guessing. Costs a fraction
// of a cent; the picture is generated here, never stored.
async function testPicture(){
 const sharp=(await import('sharp')).default;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="200"><rect width="100%" height="100%" fill="#fff"/><text x="24" y="90" font-family="sans-serif" font-size="40" fill="#102A43">Dentist for Max</text><text x="24" y="150" font-family="sans-serif" font-size="32" fill="#102A43">Tuesday 3 Nov 2026 at 3pm</text></svg>`;
 return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer());
}
export const POST=(req:Request)=>withBear(req,async({provider})=>{
 if(!provider)return json({ok:false,stage:'config',message:'No AI key is set on the server (ANTHROPIC_API_KEY).'});
 const started=Date.now();
 try{
  const result=await provider.extract({schema:generalOutputJsonSchema,system:generalSystemPrompt,text:null,images:[{mime:'image/png',bytes:await testPicture()}],documents:[],maxOutputTokens:2000});
  const out=result.output as {kind?:string;title?:{value?:string|null}|null;summary?:string}|null;
  return json({ok:true,model:result.model,latencyMs:Date.now()-started,read:{kind:out?.kind??null,title:out?.title?.value??null,summary:out?.summary??null}});
 }catch(error){
  if(error instanceof ProviderError)return json({ok:false,stage:'provider',kind:error.kind,message:error.message,model:provider.model});
  return json({ok:false,stage:'unknown',message:error instanceof Error?error.message:String(error),model:provider.model});
 }
});
