import type {Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {appendEvent} from '../engine/events.ts';
import {recordBehaviour} from '../services/behaviour.ts';
import {ensureProfile,saveProfile} from '../services/profile.ts';
import {factsFrom,prepareForm,type FormFacts,type Known} from './prepare.ts';
import type {ReadFailure} from './read.ts';

// A school form for a responsibility: keep the original privately, prepare a copy, remember what Bear did. Bear never
// submits anything and never marks anything done here: the parent signs and sends it, then says so (that is the evidence).
export type FormFailure=ReadFailure|'no_task'|'no_form_step'|'no_original';
export type FormOutcome={ok:true;task:Task;filled:number;needsDecision:number;needsDetail:number}|{ok:false;reason:FormFailure};
const hasFormStep=(t:Task)=>!!t.load?.nodes.some(n=>n.pattern==='FORM_APPLICATION');
export function knownFor(t:Task):Known{
 const p=t.load?.nodes.find(n=>n.id===t.load!.primaryId);const e=p?.entities;
 // The year level, from the title or the notice the person gave Bear, only if exactly one year is mentioned (never a guess between several).
 const years=[...new Set([...`${p?.title||''} ${t.title} ${t.notes||''}`.matchAll(/\bYear\s+(\d{1,2})\b/gi)].map(m=>m[1]))];
 return {studentName:t.forPerson||null,eventName:p?.title||t.title,eventDate:e?.eventDate||null,yearLabel:years.length===1?`Year ${years[0]}`:null,school:typeof e?.provider==='string'?e.provider:null};
}
const keyFor=(store:BearStore,t:Task,kind:string,now:Date)=>`${store.userId}/forms/${t.id}/${now.getTime()}-${kind}.pdf`;
async function factsFor(store:BearStore,supplied:unknown,remember:boolean){
 const profile=await ensureProfile(store);const given=factsFrom(supplied);const merged:FormFacts={...(profile.formFacts||{}),...given};
 if(remember&&Object.keys(given).length)await saveProfile(store,{formFacts:merged});
 return merged;
}
async function finish(store:BearStore,t:Task,originalKey:string,bytes:Uint8Array,facts:FormFacts,now:Date):Promise<FormOutcome>{
 const out=await prepareForm(bytes,knownFor(t),facts);if(!out.ok)return {ok:false,reason:out.reason};
 const pdfKey=keyFor(store,t,'prepared',now);await store.putFile(pdfKey,out.pdf,'application/pdf');
 const r=out.report;
 const task=await store.update('tasks',t.id,{preparedForm:{originalKey,pdfKey,preparedAt:now.toISOString(),total:r.total,filled:r.filled.map(x=>x.field),needsDecision:r.needsDecision.map(x=>x.field),needsDetail:r.needsDetail.map(x=>({field:x.field,role:x.role})),left:r.left.map(x=>x.field)}});
 // Counts only: no names, values or text. This is how "work removed" is measured, honestly.
 await appendEvent(store,{responsibilityId:t.id,eventType:'action_prepared',actor:'system',at:now.toISOString(),metadata:{actionType:'prepare_form',filled:r.filled.length,needsDecision:r.needsDecision.length,needsDetail:r.needsDetail.length,total:r.total,sent:false}});
 await recordBehaviour(store,'research_signal',{signal:'form_prepared',filled:r.filled.length,needsDecision:r.needsDecision.length,needsDetail:r.needsDetail.length,total:r.total},now).catch(()=>null);
 return {ok:true,task,filled:r.filled.length,needsDecision:r.needsDecision.length,needsDetail:r.needsDetail.length};
}
export async function attachForm(store:BearStore,taskId:string,bytes:Uint8Array,o:{facts?:unknown;remember?:boolean;now?:Date}={}):Promise<FormOutcome>{
 const now=o.now||new Date();const t=await store.get('tasks',taskId);if(!t)return {ok:false,reason:'no_task'};if(!hasFormStep(t))return {ok:false,reason:'no_form_step'};
 const facts=await factsFor(store,o.facts,!!o.remember);
 const originalKey=keyFor(store,t,'original',now);const probe=await prepareForm(bytes,knownFor(t),facts);if(!probe.ok)return {ok:false,reason:probe.reason};   // refuse before storing anything
 await store.putFile(originalKey,bytes,'application/pdf');return finish(store,t,originalKey,bytes,facts,now);
}
// The person gave Bear more details: prepare again from the ORIGINAL (never from a copy that already has values in it).
export async function updateForm(store:BearStore,taskId:string,o:{facts?:unknown;remember?:boolean;now?:Date}={}):Promise<FormOutcome>{
 const now=o.now||new Date();const t=await store.get('tasks',taskId);if(!t)return {ok:false,reason:'no_task'};if(!t.preparedForm)return {ok:false,reason:'no_original'};
 const orig=await store.getFile(t.preparedForm.originalKey);if(!orig)return {ok:false,reason:'no_original'};
 return finish(store,t,t.preparedForm.originalKey,orig.bytes,await factsFor(store,o.facts,!!o.remember),now);
}
export async function preparedFormFile(store:BearStore,taskId:string):Promise<{bytes:Uint8Array;filename:string}|null>{
 const t=await store.get('tasks',taskId);if(!t?.preparedForm)return null;const f=await store.getFile(t.preparedForm.pdfKey);if(!f)return null;
 const slug=(t.title||'form').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'form';return {bytes:f.bytes,filename:`${slug}-form-prepared.pdf`};
}
export async function forgetFormFacts(store:BearStore){await saveProfile(store,{formFacts:{}});}
