import {HttpError,json,withBear} from '@/lib/bear/server/context';
import {captureTextSchema,createCapture,MAX_FILE_BYTES} from '@/lib/bear/services/capture';
import {maybeAutoSetup} from '@/lib/bear/services/auto-setup';
import type {BearStore} from '@/lib/bear/store/store';
import type {StructuredModelProvider} from '@/lib/bear/ai/provider';
import type {ExtractedEntity} from '@/lib/bear/domain/types';
// Non-bill captures Bear understood are set up straight away; anything else goes to verification.
async function withAuto<T extends {extraction:ExtractedEntity}>(store:BearStore,provider:StructuredModelProvider|null,result:T){const auto=await maybeAutoSetup(store,result.extraction,new Date(),provider).catch(()=>null);return auto?{...result,auto:{taskId:auto.task.id,title:auto.task.title,area:auto.area,planned:auto.planned,dueAt:auto.task.dueAt}}:result;}
export const dynamic='force-dynamic';
export const maxDuration=120;
// Accepts JSON {method,text} or multipart form-data with `file` (+ optional `method`, `text`).
export const POST=(req:Request)=>withBear(req,async({store,provider})=>{
 const type=req.headers.get('content-type')||'';
 if(type.includes('multipart/form-data')){
  const form=await req.formData();const file=form.get('file');const method=String(form.get('method')||'upload');const text=form.get('text');
  if(!(file instanceof File))throw new HttpError('Choose a picture or PDF first.',400);
  if(file.size>MAX_FILE_BYTES)throw new HttpError('That file is bigger than 10 MB. Try a screenshot or a smaller photo.',413);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const result=await createCapture(store,provider,{method:(['photo','screenshot','upload'] as const).includes(method as 'photo')?method as 'photo'|'screenshot'|'upload':'upload',text:typeof text==='string'&&text.trim()?text:null,file:{bytes,mime:file.type||'application/octet-stream',name:file.name||'bill'}});
  return json(await withAuto(store,provider,result),201);
 }
 const raw=await req.text();if(new TextEncoder().encode(raw).length>64*1024)throw new HttpError('That is a lot of text. Paste just the bill.',413);
 let body;try{body=captureTextSchema.parse(JSON.parse(raw));}catch{throw new HttpError('Tell Bear something first.',400);}
 return json(await withAuto(store,provider,await createCapture(store,provider,{method:body.method,text:body.text,isDemo:body.isDemo})),201);
});
