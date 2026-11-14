'use client';
// Phone photos are often 8–12 MB. The server behind /api/bear accepts at most ~4.5 MB per
// request, so shrink pictures on the device first. Anything that cannot be decoded here
// (some HEIC files on non-Apple browsers) is sent as it is and the server has its own go.
const MAX_SIDE=2000;const TARGET_BYTES=3.5*1024*1024;const SKIP_UNDER=1.5*1024*1024;
function decode(file:File):Promise<HTMLImageElement|ImageBitmap>{
 if(typeof createImageBitmap==='function')return createImageBitmap(file).catch(()=>decodeViaImg(file));
 return decodeViaImg(file);
}
function decodeViaImg(file:File):Promise<HTMLImageElement>{return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();img.onload=()=>{URL.revokeObjectURL(url);res(img);};img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('decode'));};img.src=url;});}
function toBlob(canvas:HTMLCanvasElement,quality:number):Promise<Blob|null>{return new Promise(res=>canvas.toBlob(res,'image/jpeg',quality));}
// One picture, made to fit `targetBytes`: first by JPEG quality, then by size, never below what text needs to stay readable.
export async function shrinkImage(file:File,opts:{targetBytes?:number;maxSide?:number}={}):Promise<File>{
 const target=opts.targetBytes??TARGET_BYTES;const maxSide=opts.maxSide??MAX_SIDE;
 if(!file.type.startsWith('image/'))return file;
 if(file.size<Math.min(SKIP_UNDER,target)&&file.type!=='image/heic'&&file.type!=='image/heif')return file;
 try{
  const src=await decode(file);
  const w='naturalWidth' in src?src.naturalWidth:src.width;const h='naturalHeight' in src?src.naturalHeight:src.height;
  if(!w||!h)return file;
  let scale=Math.min(1,maxSide/Math.max(w,h));let blob:Blob|null=null;
  // Shrink until it fits. A long side under ~1000 px makes small print unreadable, so stop there.
  for(let round=0;round<6;round++){
   const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
   const ctx=canvas.getContext('2d');if(!ctx)return file;
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);   // screenshots with see-through parts turn black as JPEG otherwise
   ctx.drawImage(src as CanvasImageSource,0,0,canvas.width,canvas.height);
   let quality=0.85;blob=await toBlob(canvas,quality);
   while(blob&&blob.size>target&&quality>0.5){quality-=0.1;blob=await toBlob(canvas,quality);}
   if(!blob||blob.size<=target||Math.max(canvas.width,canvas.height)<=1000)break;
   scale*=Math.max(0.6,Math.sqrt(target/blob.size)*0.95);
  }
  if(!blob)return file;
  const name=file.name.replace(/\.[^.]+$/,'')+'.jpg';
  return new File([blob],name||'photo.jpg',{type:'image/jpeg',lastModified:file.lastModified});
 }catch{return file;}
}
// The server takes about 4.5 MB per upload in total, so several pictures share one budget instead of each taking it all.
export const UPLOAD_BUDGET=3.8*1024*1024;
export async function shrinkAll(files:File[]):Promise<File[]>{
 const each=Math.floor(UPLOAD_BUDGET/Math.max(1,files.length));
 const out:File[]=[];for(const f of files)out.push(f.type.startsWith('image/')?await shrinkImage(f,{targetBytes:Math.min(TARGET_BYTES,each),maxSide:files.length>1?2400:MAX_SIDE}):f);
 return out;
}
