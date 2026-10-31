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
export async function shrinkImage(file:File):Promise<File>{
 if(!file.type.startsWith('image/'))return file;
 if(file.size<SKIP_UNDER&&file.type!=='image/heic'&&file.type!=='image/heif')return file;
 try{
  const src=await decode(file);
  const w='naturalWidth' in src?src.naturalWidth:src.width;const h='naturalHeight' in src?src.naturalHeight:src.height;
  if(!w||!h)return file;
  const scale=Math.min(1,MAX_SIDE/Math.max(w,h));
  const canvas=document.createElement('canvas');canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
  const ctx=canvas.getContext('2d');if(!ctx)return file;
  ctx.drawImage(src as CanvasImageSource,0,0,canvas.width,canvas.height);
  let quality=0.86;let blob=await toBlob(canvas,quality);
  while(blob&&blob.size>TARGET_BYTES&&quality>0.4){quality-=0.12;blob=await toBlob(canvas,quality);}
  if(!blob)return file;
  const name=file.name.replace(/\.[^.]+$/,'')+'.jpg';
  return new File([blob],name||'photo.jpg',{type:'image/jpeg',lastModified:file.lastModified});
 }catch{return file;}
}
