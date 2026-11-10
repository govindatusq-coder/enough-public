import {PDFTextField,StandardFonts} from 'pdf-lib';
import {classifyField,POLICY,REMEMBERABLE,type FieldRole} from './classify.ts';
import {fieldsOf,loadPdf,type FormField,type ReadFailure} from './read.ts';

// Fill what Bear can VERIFY and nothing else. Verified = stated in the notice the person gave Bear (child, event, date, year)
// or a plain contact detail the person themselves told Bear to reuse. A decision or attestation by the parent (consent,
// signature, medical, allergy, emergency contact, photo permission, payment, date signed) is never filled. Fields stay
// editable: Bear hands back a usable form, it does not flatten or submit anything.
export interface Known{studentName?:string|null;eventName?:string|null;eventDate?:string|null;yearLabel?:string|null;school?:string|null}
export interface FormFacts{parentName?:string;phone?:string;email?:string;address?:string}
export interface FieldReport{field:string;role:FieldRole;action:'filled'|'needs_decision'|'needs_detail'|'left';value?:string;source?:'notice'|'you_told_me';reason?:string}
export interface FormReport{total:number;filled:FieldReport[];needsDecision:FieldReport[];needsDetail:FieldReport[];left:FieldReport[]}
const clean=(s:unknown,max=200)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max):'';
const auDate=(iso?:string|null)=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');return m?`${m[3]}/${m[2]}/${m[1]}`:null;};
export const factsFrom=(o:unknown):FormFacts=>{const r=(o&&typeof o==='object'?o:{}) as Record<string,unknown>;const out:FormFacts={};
 for(const k of ['parentName','phone','email','address'] as const){const v=clean(r[k],k==='address'?200:80);if(v)out[k]=v;}return out;};

function valueFor(role:FieldRole,k:Known,f:FormFacts):{value:string|null;source?:'notice'|'you_told_me'}{
 switch(role){
  case 'student_name':return {value:clean(k.studentName)||null,source:'notice'};
  case 'student_first':return {value:clean(k.studentName).split(' ')[0]||null,source:'notice'};
  case 'student_last':{const t=clean(k.studentName).split(' ');return {value:t.length>1?t.slice(1).join(' '):null,source:'notice'};}
  case 'class_year':return {value:clean(k.yearLabel)||null,source:'notice'};
  case 'event_name':return {value:clean(k.eventName)||null,source:'notice'};
  case 'event_date':return {value:auDate(k.eventDate),source:'notice'};
  case 'school':return {value:clean(k.school)||null,source:'notice'};
  case 'parent_name':return {value:f.parentName||null,source:'you_told_me'};
  case 'phone':return {value:f.phone||null,source:'you_told_me'};
  case 'email':return {value:f.email||null,source:'you_told_me'};
  case 'address':return {value:f.address||null,source:'you_told_me'};
  default:return {value:null};
 }
}
export type PrepareResult={ok:true;pdf:Uint8Array;report:FormReport}|{ok:false;reason:ReadFailure};
export async function prepareForm(bytes:Uint8Array,known:Known,facts:FormFacts):Promise<PrepareResult>{
 const l=await loadPdf(bytes);if('reason' in l)return {ok:false,reason:l.reason};
 const doc=l.doc;let fields:FormField[];try{fields=fieldsOf(doc);}catch{return {ok:false,reason:'unreadable'};}
 if(fields.length===0)return {ok:false,reason:'no_form'};
 const form=doc.getForm();
 // The form's default font can only draw some characters. A value it can't draw goes back to the parent; it is never garbled in.
 const shown=new Set((await doc.embedFont(StandardFonts.Helvetica)).getCharacterSet());
 const canShow=(v:string)=>[...v].every(c=>shown.has(c.codePointAt(0)!));
 const report:FormReport={total:fields.length,filled:[],needsDecision:[],needsDetail:[],left:[]};
 for(const f of fields){
  const role=classifyField(f.name,f.kind);const policy=POLICY[role];
  // Ticks, radios and signatures are always the parent's decision: Bear never ticks, selects or signs anything.
  if(policy==='parent_decision'||f.kind==='checkbox'||f.kind==='radio'||f.kind==='signature'){report.needsDecision.push({field:f.name,role,action:'needs_decision'});continue;}
  if(policy==='leave'||f.kind!=='text'){report.left.push({field:f.name,role,action:'left',reason:'Bear couldn’t tell what this is for'});continue;}
  if(f.readOnly){report.left.push({field:f.name,role,action:'left',reason:'read-only'});continue;}
  if(f.hasValue){report.left.push({field:f.name,role,action:'left',reason:'already filled in'});continue;}
  const {value,source}=valueFor(role,known,facts);
  if(!value){report.needsDetail.push({field:f.name,role,action:'needs_detail'});continue;}
  if(f.maxLength!==null&&value.length>f.maxLength){report.needsDetail.push({field:f.name,role,action:'needs_detail',reason:'too long for the box'});continue;}
  if(!canShow(value)){report.needsDetail.push({field:f.name,role,action:'needs_detail',reason:'has characters the form can’t show'});continue;}
  try{(form.getField(f.name) as PDFTextField).setText(value);report.filled.push({field:f.name,role,action:'filled',value,source});}
  catch{report.needsDetail.push({field:f.name,role,action:'needs_detail',reason:'has characters the form can’t show'});}
 }
 try{return {ok:true,pdf:await doc.save(),report};}
 catch{return {ok:false,reason:'unreadable'};}
}
export {REMEMBERABLE};
