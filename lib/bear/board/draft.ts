// Bear writes a draft from scratch (or improves hers) with AI. She reads it, changes anything, and sends it from her own
// app; Bear never sends. Facts come only from what she gave: unknown details become [placeholders], and an address or
// number is only kept if it appears in her own words.
import {z} from 'zod';
import type {AIInference,Task} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';

export const DAILY_DRAFTS=40;
export class DraftError extends Error{readonly status:number;constructor(message:string,status:number){super(message);this.status=status;}}
export const draftRequestSchema=z.object({ask:z.string().trim().max(500).nullable().default(null),current:z.object({to:z.string().max(200),subject:z.string().max(200),body:z.string().max(6000)}).strict().nullable().default(null),kind:z.enum(['email','message','followup']).default('email')}).strict();
export const draftJsonSchema={type:'object',additionalProperties:false,required:['to','subject','body'],properties:{to:{type:'string'},subject:{type:'string'},body:{type:'string'}}};
export function draftSystemPrompt(kind:'email'|'message'|'followup',name:string){
 return `You write a short message for a busy Australian parent${name?` called ${name}`:''} to check and send herself.
Write in Australian English, warm and plain, like a capable friend would. Keep it brief: ${kind==='message'?'a text message of one to three sentences, no subject (return an empty subject)':'a short email of two to five sentences with a clear subject line'}.
${kind==='followup'?'It is a polite follow-up: say what she is following up on and ask for an update or a date.':''}
Use only facts given to you. Never invent names, dates, amounts, reference numbers, email addresses or phone numbers. Where a needed detail is missing, write a short placeholder in square brackets, like [date] or [child’s name].
${name?`Sign off with "${name}".`:'Do not add a name at the end.'}
"to" is an email address or phone number only if one appears in what you were given; otherwise an empty string.
If she gave instructions about what to say, follow them. If there is a current draft, improve it rather than starting over unless asked.`;
}
const norm=(s:string)=>s.toLowerCase().replace(/\s+/g,'');
export function checkDraft(raw:unknown,given:string,kind:'email'|'message'|'followup'){
 const r=raw as {to?:unknown;subject?:unknown;body?:unknown}|null;
 if(!r||typeof r.body!=='string'||!r.body.trim()||typeof r.subject!=='string'||typeof r.to!=='string')return null;
 // An address or number Bear didn't see in her words is dropped, never guessed.
 const to=r.to.trim()&&norm(given).includes(norm(r.to))?r.to.trim().slice(0,200):'';
 return {to,subject:kind==='message'?'':r.subject.trim().slice(0,200),body:r.body.trim().slice(0,6000)};
}
export async function writeDraft(store:BearStore,provider:StructuredModelProvider|null,task:Task,name:string,input:z.infer<typeof draftRequestSchema>,now=new Date()){
 if(!provider)throw new DraftError('Bear’s writing help isn’t connected (no AI key is set). The starting draft is still here to edit.',503);
 const since=now.getTime()-24*3600000;
 const used=(await store.list('ai_inferences',{where:[{column:'service',value:'Draft'}]})).filter(i=>Date.parse(i.createdAt)>=since).length;
 if(used>=DAILY_DRAFTS)throw new DraftError('That’s a lot of drafting for one day. Bear will write more tomorrow; the draft here is still yours to edit.',429);
 const given=[`Task: ${task.title}`,task.sorted?.originalInput&&task.sorted.originalInput!==task.title?`Her words when she added it: ${task.sorted.originalInput}`:'',task.notes?`Notes: ${task.notes}`:'',task.dueAt?`Due: ${task.dueAt}`:'',
  task.prepared?.payload.email?`Earlier draft from a document: ${task.prepared.payload.email.subject}\n${task.prepared.payload.email.body}`:'',
  input.current?.body?`Current draft:\nTo: ${input.current.to}\nSubject: ${input.current.subject}\n${input.current.body}`:'',input.ask?`What she wants it to say: ${input.ask}`:''].filter(Boolean).join('\n\n');
 const started=Date.now();
 try{
  const r=await provider.extract({schema:draftJsonSchema,system:draftSystemPrompt(input.kind,name),text:given,images:[],documents:[],maxOutputTokens:1500,effort:'low'});
  const draft=checkDraft(r.output,given,input.kind);
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Draft',provider:r.provider,model:r.model,promptHash:'draft-1',rawOutput:null,latencyMs:r.latencyMs,ok:!!draft,error:draft?null:'invalid_output'}));
  if(!draft)throw new DraftError('Bear’s draft didn’t come out right. Try again, or edit the one here.',502);
  return draft;
 }catch(e){
  if(e instanceof DraftError)throw e;
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Draft',provider:provider.name,model:provider.model,promptHash:'draft-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:String((e as Error)?.message||e).slice(0,300)})).catch(()=>null);
  throw new DraftError('Bear couldn’t write that just now. Your draft is unchanged.',503);
 }
}
