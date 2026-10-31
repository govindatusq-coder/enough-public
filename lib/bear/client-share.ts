// What the iPhone app hands to the web app after something was shared to Load Bear from another app.
// The native side sends { text, files:[{name,mime,b64}] }; this turns it into text and real File objects,
// accepting only the kinds of file Bear can read, and never more than a handful.
export interface NativeSharePayload{text?:string|null;files?:{name?:string;mime?:string;b64?:string}[]}
export interface BearInbox{text:string|null;files:File[]}
const ALLOWED=new Set(['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','application/pdf']);
const MAX_FILES=5;const MAX_BYTES=10*1024*1024;
export function payloadToInbox(p:NativeSharePayload|null|undefined):BearInbox{
 const text=(p?.text||'').trim().slice(0,20000)||null;const files:File[]=[];
 for(const f of p?.files||[]){
  if(files.length>=MAX_FILES)break;
  const mime=(f.mime||'').toLowerCase();if(!ALLOWED.has(mime)||!f.b64)continue;
  try{
   const bin=atob(f.b64);if(bin.length===0||bin.length>MAX_BYTES)continue;
   const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
   const name=(f.name||'shared').replace(/[^\w.\- ]+/g,'').slice(0,80)||'shared';
   files.push(new File([bytes],name,{type:mime}));
  }catch{/* not valid base64: skip it */}
 }
 return {text,files};
}
