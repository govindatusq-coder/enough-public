import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {ProviderError,type ExtractInput,type ExtractResult,type StructuredModelProvider} from './provider.ts';
import {restoreNullables,structuredOutputSchema} from './schema-subset.ts';

const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']);
const MAX_IMAGE_BYTES=4.5*1024*1024;
// Phone photos are often 8–12 MB; the API limit is 5 MB per image. Downscale and re-encode.
async function prepareImage(image:{mime:string;bytes:Uint8Array}):Promise<{mime:'image/jpeg'|'image/png'|'image/webp'|'image/gif';bytes:Uint8Array}>{
 const needsConvert=image.mime==='image/heic'||image.mime==='image/heif'||image.bytes.byteLength>MAX_IMAGE_BYTES;
 if(!needsConvert)return image as {mime:'image/jpeg'|'image/png'|'image/webp'|'image/gif';bytes:Uint8Array};
 const sharp=(await import('sharp')).default;
 let quality=85;let out=await sharp(image.bytes).rotate().resize({width:2200,height:2200,fit:'inside',withoutEnlargement:true}).jpeg({quality}).toBuffer();
 while(out.byteLength>MAX_IMAGE_BYTES&&quality>40){quality-=15;out=await sharp(image.bytes).rotate().resize({width:1800,height:1800,fit:'inside',withoutEnlargement:true}).jpeg({quality}).toBuffer();}
 return {mime:'image/jpeg',bytes:new Uint8Array(out)};
}
// Models tried when the main one declines a document. Different models have different safety filters.
const BACKUP_MODEL='claude-sonnet-5-5',OTHER_BACKUP='claude-opus-4-8';
export class AnthropicProvider implements StructuredModelProvider{
 readonly name='anthropic';readonly supportsVision=true;
 private client:Anthropic;
 readonly model:string;
 constructor(apiKey:string,model:string){this.model=model;this.client=new Anthropic({apiKey,maxRetries:2,timeout:90_000});}
 async extract(input:ExtractInput):Promise<ExtractResult>{
  const content:Anthropic.ContentBlockParam[]=[];
  for(const raw of input.images){
   if(!IMAGE_TYPES.has(raw.mime))throw new ProviderError(`Bear can't read ${raw.mime} pictures yet. Try a JPEG, PNG or screenshot.`,'unsupported');
   let image;try{image=await prepareImage(raw);}catch{throw new ProviderError('That picture could not be read. Try a screenshot or a smaller photo.','unsupported');}
   content.push({type:'image',source:{type:'base64',media_type:image.mime,data:Buffer.from(image.bytes).toString('base64')}});
  }
  for(const doc of input.documents){
   if(doc.mime!=='application/pdf')throw new ProviderError('Only PDF documents are supported.','unsupported');
   content.push({type:'document',source:{type:'base64',media_type:'application/pdf',data:Buffer.from(doc.bytes).toString('base64')}});
  }
  // Neutral framing: calling everything a "bill" pushed the model to read ordinary to-dos as bills.
  content.push({type:'text',text:input.text?`What the person gave Bear:\n\n${input.text}`:'Read what is attached and return the structured fields.'});
  const started=Date.now();
  try{
   const base={max_tokens:input.maxOutputTokens||8000,
    system:[{type:'text' as const,text:input.system,cache_control:{type:'ephemeral' as const}}],
    output_config:{format:{type:'json_schema' as const,schema:structuredOutputSchema(input.schema) as Record<string,unknown>},effort:(input.effort||'medium') as 'low'|'medium'|'high'},
    messages:[{role:'user' as const,content}],
    ...(input.thinkingSummary?{thinking:{type:'adaptive' as const,display:'summarized' as const}}:{})};
   // A safety filter can decline an ordinary school note by mistake. The service first re-runs a declined request on its own
   // backup model; if that also declines (or the option is not accepted), Bear tries once more on a second model itself.
   let response:Anthropic.Message|Anthropic.Beta.BetaMessage;const declined:string[]=[];
   try{response=await this.client.beta.messages.create({...base,model:this.model,betas:['server-side-fallback-2026-07-01'],fallbacks:'default'} as Anthropic.Beta.MessageCreateParamsNonStreaming);}
   catch(e){if(!(e instanceof Anthropic.BadRequestError))throw e;response=await this.client.messages.create({...base,model:this.model});}
   if(response.stop_reason==='refusal'){
    declined.push(`${response.model}:${(response as {stop_details?:{category?:string|null}}).stop_details?.category??'?'}`);
    const second=this.model===BACKUP_MODEL?OTHER_BACKUP:BACKUP_MODEL;
    response=await this.client.messages.create({...base,model:second});
    if(response.stop_reason==='refusal')declined.push(`${response.model}:${(response as {stop_details?:{category?:string|null}}).stop_details?.category??'?'}`);
   }
   if(response.stop_reason==='refusal')throw new ProviderError(`The AI service’s safety filter declined to read this (${declined.join(', ')}).`,'refused');
   if(response.stop_reason==='max_tokens')throw new ProviderError('The AI response was cut short.','invalid_output');
   const text=response.content.filter((b):b is Anthropic.TextBlock=>b.type==='text').map(b=>b.text).join('');
   let output:unknown;try{output=restoreNullables(input.schema,JSON.parse(text));}catch{throw new ProviderError('The AI service returned something Bear could not read.','invalid_output');}
   const thinking=input.thinkingSummary?(response.content as {type:string;thinking?:string}[]).filter(b=>b.type==='thinking'&&b.thinking).map(b=>b.thinking).join('\n\n')||null:null;
   return {output,raw:{id:response.id,usage:response.usage,stop:response.stop_reason},provider:this.name,model:response.model,latencyMs:Date.now()-started,thinking};
  }catch(error){
   if(error instanceof ProviderError)throw error;
   if(error instanceof Anthropic.AuthenticationError)throw new ProviderError('The AI service key is not valid.','unavailable');
   if(error instanceof Anthropic.RateLimitError)throw new ProviderError('The AI service is busy. Try again in a moment.','rate_limited');
   if(error instanceof Anthropic.BadRequestError)throw new ProviderError('The AI service rejected this document ('+error.message.slice(0,160)+').','unsupported');
   if(error instanceof Anthropic.APIConnectionError)throw new ProviderError('Bear could not reach the AI service.','network');
   if(error instanceof Anthropic.APIError)throw new ProviderError('The AI service had a problem.','unavailable');
   throw new ProviderError('The AI service had a problem.','unavailable');
  }
 }
}
