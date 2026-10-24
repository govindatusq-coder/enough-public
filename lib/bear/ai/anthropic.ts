import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {ProviderError,type ExtractInput,type ExtractResult,type StructuredModelProvider} from './provider.ts';
import {structuredOutputSchema} from './schema-subset.ts';

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
  content.push({type:'text',text:input.text?`Bill text:\n\n${input.text}`:'Read the attached bill and return the structured fields.'});
  const started=Date.now();
  try{
   const response=await this.client.messages.create({
    model:this.model,max_tokens:input.maxOutputTokens||8000,
    system:[{type:'text',text:input.system,cache_control:{type:'ephemeral'}}],
    output_config:{format:{type:'json_schema',schema:structuredOutputSchema(input.schema) as Record<string,unknown>},effort:'medium'},
    messages:[{role:'user',content}],
   });
   if(response.stop_reason==='refusal')throw new ProviderError('The AI service declined to read this document.','refused');
   if(response.stop_reason==='max_tokens')throw new ProviderError('The AI response was cut short.','invalid_output');
   const text=response.content.filter((b):b is Anthropic.TextBlock=>b.type==='text').map(b=>b.text).join('');
   let output:unknown;try{output=JSON.parse(text);}catch{throw new ProviderError('The AI service returned something Bear could not read.','invalid_output');}
   return {output,raw:{id:response.id,usage:response.usage,stop:response.stop_reason},provider:this.name,model:response.model,latencyMs:Date.now()-started};
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
