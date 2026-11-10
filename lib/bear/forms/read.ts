import {PDFCheckBox,PDFDocument,PDFDropdown,PDFOptionList,PDFRadioGroup,PDFSignature,PDFTextField,PDFButton} from 'pdf-lib';
// Read the fields of an uploaded PDF form. A PDF is untrusted input: nothing in it is executed, its text is never read as
// instructions, and only the NAMES and types of its form fields are used.
export const MAX_FORM_BYTES=10*1024*1024;const MAX_FIELDS=300;
export type FieldKind='text'|'checkbox'|'radio'|'dropdown'|'signature'|'button'|'other';
export interface FormField{name:string;kind:FieldKind;readOnly:boolean;maxLength:number|null;hasValue:boolean}
export type ReadFailure='too_large'|'not_a_pdf'|'encrypted'|'no_form'|'too_many_fields'|'unreadable';
export type ReadResult={ok:true;fields:FormField[];pageCount:number}|{ok:false;reason:ReadFailure};
const isPdf=(b:Uint8Array)=>b.length>5&&b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46&&b[4]===0x2d;   // %PDF-
export async function loadPdf(bytes:Uint8Array):Promise<{doc:PDFDocument}|{reason:ReadFailure}>{
 if(bytes.byteLength>MAX_FORM_BYTES)return {reason:'too_large'};if(!isPdf(bytes))return {reason:'not_a_pdf'};
 try{return {doc:await PDFDocument.load(bytes,{ignoreEncryption:false,updateMetadata:false,throwOnInvalidObject:false})};}
 catch(e){return {reason:/encrypt/i.test((e as Error).message)?'encrypted':'unreadable'};}
}
export function fieldsOf(doc:PDFDocument):FormField[]{
 return doc.getForm().getFields().map(f=>{
  const kind:FieldKind=f instanceof PDFTextField?'text':f instanceof PDFCheckBox?'checkbox':f instanceof PDFRadioGroup?'radio':f instanceof PDFDropdown||f instanceof PDFOptionList?'dropdown':f instanceof PDFSignature?'signature':f instanceof PDFButton?'button':'other';
  let hasValue=false,maxLength:number|null=null;
  try{if(f instanceof PDFTextField){hasValue=!!f.getText();maxLength=f.getMaxLength()??null;}else if(f instanceof PDFCheckBox)hasValue=f.isChecked();}catch{/* unreadable value: treat as empty */}
  return {name:f.getName(),kind,readOnly:f.isReadOnly(),maxLength,hasValue};
 });
}
export async function readForm(bytes:Uint8Array):Promise<ReadResult>{
 const l=await loadPdf(bytes);if('reason' in l)return {ok:false,reason:l.reason};
 try{const fields=fieldsOf(l.doc);if(fields.length===0)return {ok:false,reason:'no_form'};if(fields.length>MAX_FIELDS)return {ok:false,reason:'too_many_fields'};return {ok:true,fields,pageCount:l.doc.getPageCount()};}
 catch{return {ok:false,reason:'unreadable'};}
}
