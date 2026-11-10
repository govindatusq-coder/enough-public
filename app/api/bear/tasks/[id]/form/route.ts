import {HttpError,json,readJson,withBear} from '@/lib/bear/server/context';
import {MAX_FORM_BYTES} from '@/lib/bear/forms/read';
import {attachForm,forgetFormFacts,preparedFormFile,updateForm,type FormFailure,type FormOutcome} from '@/lib/bear/forms/service';
export const dynamic='force-dynamic';
export const maxDuration=60;
const WORDS:Record<FormFailure,[string,number]>={
 not_a_pdf:['That isn’t a PDF. Add the form as a PDF.',400],too_large:['That file is bigger than 10 MB.',413],encrypted:['That PDF is locked, so I can’t fill it in. Unlock it, or print it and fill it in by hand.',422],
 no_form:['That PDF has no fillable boxes, so I can’t fill it in. Print it and fill it in by hand.',422],too_many_fields:['That form is too big for me to fill in.',422],unreadable:['I couldn’t read that form.',422],
 no_task:['Bear couldn’t find that.',404],no_form_step:['This one doesn’t have a form to fill in.',400],no_original:['Add the form first.',400]};
const reply=(o:FormOutcome)=>{if(!o.ok){const [m,s]=WORDS[o.reason];throw new HttpError(m,s);}return json({ok:true,filled:o.filled,needsDecision:o.needsDecision,needsDetail:o.needsDetail,preparedForm:o.task.preparedForm});};
// The prepared copy, for the person to check, finish, sign and send themselves. Only the signed-in owner's own.
export const GET=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const f=await preparedFormFile(store,id);if(!f)throw new HttpError('Bear couldn’t find a prepared form.',404);
 return new Response(f.bytes as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="${f.filename}"`,'Cache-Control':'private, no-store'}});
});
// Add the form (multipart: file, optional facts + remember), or add details and prepare it again (JSON: {facts, remember}).
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;
 if((req.headers.get('content-type')||'').includes('multipart/form-data')){
  const form=await req.formData();const file=form.get('file');if(!(file instanceof File))throw new HttpError('Choose the form first.',400);
  if(file.size>MAX_FORM_BYTES)throw new HttpError(WORDS.too_large[0],413);
  let facts:unknown=undefined;try{const raw=form.get('facts');if(typeof raw==='string'&&raw)facts=JSON.parse(raw);}catch{facts=undefined;}
  return reply(await attachForm(store,id,new Uint8Array(await file.arrayBuffer()),{facts,remember:form.get('remember')==='true'}));
 }
 const body=await readJson(req,8*1024) as {facts?:unknown;remember?:boolean};
 return reply(await updateForm(store,id,{facts:body.facts,remember:!!body.remember}));
},{write:true});
// Forget the contact details Bear was told to reuse on forms.
export const DELETE=(req:Request)=>withBear(req,async({store})=>{await forgetFormFacts(store);return json({ok:true});},{write:true});
