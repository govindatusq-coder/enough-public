'use client';
// Client-side preparation for triage. Nothing here reads text out of a picture: pictures and PDFs go to the vision model as
// they are (only resized), so tables, margins and handwriting are read in place.
import {cleanEmailInput,type FamilyMember} from './services/triage-core';
export {cleanEmailInput};

// The server accepts about 4.5 MB per request; base64 adds a third. Everything in one request shares this budget.
export const TRIAGE_BUDGET=3.2*1024*1024;
const MAX_WIDTH=1600;
function loadImage(file:File):Promise<HTMLImageElement>{return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('That picture could not be opened.'));};img.src=url;});}
// Resize to at most 1600 px wide as a JPEG at 0.85, returned as a data URL. A tall phone screenshot keeps its full height in
// proportion, so its text stays readable. If `maxBytes` is given, quality (then size) steps down until it fits.
export async function prepareImageForVision(file:File,maxBytes=TRIAGE_BUDGET):Promise<string>{
 const img=await loadImage(file);const w=img.naturalWidth,h=img.naturalHeight;if(!w||!h)throw new Error('That picture could not be opened.');
 let scale=Math.min(1,MAX_WIDTH/w);let quality=0.85;let url='';
 for(let round=0;round<8;round++){
  const c=document.createElement('canvas');c.width=Math.round(w*scale);c.height=Math.round(h*scale);
  const ctx=c.getContext('2d');if(!ctx)throw new Error('This browser cannot prepare pictures.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
  url=c.toDataURL('image/jpeg',quality);
  if(base64Bytes(url)<=maxBytes)break;
  if(quality>0.6)quality-=0.1;else scale*=0.8;
 }
 return url;
}
// A PDF goes as it is, as a data URL.
export function preparePdfForVision(file:File):Promise<string>{
 return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const s=String(r.result||'');res(s.startsWith('data:application/pdf')?s:s.replace(/^data:[^;]*;/,'data:application/pdf;'));};r.onerror=()=>rej(new Error('That PDF could not be opened.'));r.readAsDataURL(file);});
}
export const base64Bytes=(dataUrl:string)=>Math.floor((dataUrl.length-dataUrl.indexOf(',')-1)*3/4);

export type TriageItem={kind:'image'|'pdf'|'text';mime:string;data:string;name?:string};
export interface TriageRequest{inputs:TriageItem[];currentDateTime:string;timeZone:string;familyProfile:FamilyMember[]}
// Bundle what the person gave with their local date, time zone and family. (The server uses its own copy of the date and
// family as the anchors; these travel along so a request is complete on its own.)
export async function buildTriageRequest(input:{files?:File[];text?:string|null},familyProfile:FamilyMember[]=[],now=new Date()):Promise<TriageRequest>{
 const files=(input.files||[]).slice(0,6);const inputs:TriageItem[]=[];   // one request carries at most 6 (callers send 5 at a time)
 const pdfs=files.filter(f=>f.type==='application/pdf');const pics=files.filter(f=>f.type.startsWith('image/'));
 for(const f of pdfs)inputs.push({kind:'pdf',mime:'application/pdf',data:await preparePdfForVision(f),name:f.name});
 const left=Math.max(200*1024,TRIAGE_BUDGET-inputs.reduce((n,i)=>n+base64Bytes(i.data),0));
 for(const f of pics)inputs.push({kind:'image',mime:'image/jpeg',data:await prepareImageForVision(f,Math.floor(left/Math.max(1,pics.length))),name:f.name});
 const text=input.text?cleanEmailInput(input.text):'';if(text)inputs.push({kind:'text',mime:'text/plain',data:text});
 const timeZone=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'Australia/Sydney';}catch{return 'Australia/Sydney';}})();
 const currentDateTime=now.toLocaleString('en-AU',{timeZone,weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit'});
 return {inputs,currentDateTime,timeZone,familyProfile};
}
export const requestBytes=(r:TriageRequest)=>r.inputs.reduce((n,i)=>n+(i.kind==='text'?i.data.length:base64Bytes(i.data)),0);
