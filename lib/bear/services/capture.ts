import {z} from 'zod';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {captureMethods,type Capture,type SourceDocument} from '../domain/types.ts';
import {newId,stamp,type BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {ExtractionError,extractBill} from './bill-extraction.ts';

// CaptureService. Accepts messy input (text, typed bill, photo, screenshot, upload),
// stores the original privately, and hands it to extraction. Voice and PDF are
// architected here but voice transcription is not implemented (marked unavailable in UI).
export const MAX_FILE_BYTES=10*1024*1024;
export const supportedImageMimes=['image/jpeg','image/png','image/webp'] as const;
export const supportedDocumentMimes=['application/pdf'] as const;
export const captureTextSchema=z.object({method:z.enum(captureMethods),text:z.string().trim().min(1).max(20000),isDemo:z.boolean().optional()}).strict();
export class CaptureError extends Error{readonly status:number;readonly capture:Capture|null;constructor(message:string,status=400,capture:Capture|null=null){super(message);this.name='CaptureError';this.status=status;this.capture=capture;}}

export interface FileInput{bytes:Uint8Array;mime:string;name:string}
export interface CreateCaptureInput{method:Capture['method'];text?:string|null;file?:FileInput|null;isDemo?:boolean;referenceYear?:number}

export async function createCapture(store:BearStore,provider:StructuredModelProvider|null,input:CreateCaptureInput){
 const file=input.file||null;
 if(file){
  if(file.bytes.byteLength===0)throw new CaptureError("That file is empty. Try another picture.");
  if(file.bytes.byteLength>MAX_FILE_BYTES)throw new CaptureError('That file is bigger than 10 MB. Try a screenshot or a smaller photo.');
  if(!isImage(file.mime)&&!isDocument(file.mime))throw new CaptureError("Bear can read JPEG, PNG and WebP pictures and PDF files. That file is something else.");
  if(!looksLikeFile(file))throw new CaptureError("That file doesn't look like a valid picture or PDF.");
  if(!provider)throw new CaptureError("Bear can't read pictures or PDFs until the AI service is connected. Paste the bill text or type it in instead.",503);
 }
 if(!file&&!(input.text&&input.text.trim()))throw new CaptureError('Tell Bear something about the bill first.');
 const capture=await store.insert('captures',stamp<Capture>(store.userId,{method:input.method,status:'received',text:input.text?.trim()||null,documentId:null,extractionId:null,error:null,isDemo:!!input.isDemo}));
 await recordBehaviour(store,'capture_created',{method:input.method,captureId:capture.id});
 let document:SourceDocument|null=null;
 if(file){
  const id=newId();const objectKey=`${store.userId}/${id}${extensionFor(file.mime)}`;
  await store.putFile(objectKey,file.bytes,file.mime);
  document=await store.insert('source_documents',stamp<SourceDocument>(store.userId,{id,captureId:capture.id,objectKey,mime:file.mime,bytes:file.bytes.byteLength,originalName:file.name.slice(0,120),isDemo:!!input.isDemo}));
  await store.update('captures',capture.id,{documentId:document.id});
 }
 await store.update('captures',capture.id,{status:'extracting'});
 try{
  const extraction=await extractBill(store,provider,{captureId:capture.id,text:capture.text,images:file&&isImage(file.mime)?[{mime:file.mime,bytes:file.bytes}]:[],documents:file&&isDocument(file.mime)?[{mime:file.mime,bytes:file.bytes}]:[],referenceYear:input.referenceYear});
  const updated=await store.update('captures',capture.id,{status:'needs_verification',extractionId:extraction.id});
  return {capture:updated,extraction,document};
 }catch(error){
  const message=error instanceof ExtractionError?error.message:'Bear could not read that. Nothing has been saved as a bill.';
  const updated=await store.update('captures',capture.id,{status:'failed',error:message});
  throw new CaptureError(message,error instanceof ExtractionError&&error.kind==='unavailable'?503:422,updated);
 }
}
export async function rejectCapture(store:BearStore,captureId:string){
 const capture=await store.get('captures',captureId);if(!capture)throw new CaptureError('Not found',404);
 if(capture.extractionId)await store.update('extractions',capture.extractionId,{status:'rejected'});
 await recordBehaviour(store,'capture_rejected',{captureId});
 return store.update('captures',captureId,{status:'rejected'});
}
const isImage=(m:string)=>(supportedImageMimes as readonly string[]).includes(m);
const isDocument=(m:string)=>(supportedDocumentMimes as readonly string[]).includes(m);
const extensionFor=(m:string)=>m==='image/jpeg'?'.jpg':m==='image/png'?'.png':m==='image/webp'?'.webp':'.pdf';
// Magic-number check so a renamed text file is rejected before it is stored or sent anywhere.
export function looksLikeFile(file:FileInput){const b=file.bytes;if(b.length<8)return false;
 if(file.mime==='image/jpeg')return b[0]===0xff&&b[1]===0xd8;
 if(file.mime==='image/png')return b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47;
 if(file.mime==='image/webp')return b[0]===0x52&&b[1]===0x49&&b[2]===0x46&&b[3]===0x46&&b[8]===0x57&&b[9]===0x45;
 if(file.mime==='application/pdf')return b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46;
 return false;}
