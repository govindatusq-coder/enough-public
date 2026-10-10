import {createHash} from 'node:crypto';
import type {Idea} from './ideas.ts';
import {ideaImageIdentity,ideaImagePrompt} from './idea-image-spec.ts';

export const maxIdeaImageBytes=2*1024*1024;
export const imageLockLifetime=240_000;
export type IdeaImageStore={read:(key:string)=>Promise<Uint8Array|null>;create:(key:string,bytes:Uint8Array)=>Promise<boolean>;createdAt:(key:string)=>Promise<number|null>;remove:(key:string)=>Promise<void>};
export class IdeaImageError extends Error{
 status:number;
 constructor(message:string,status=503){super(message);this.name='IdeaImageError';this.status=status;}
}
export function ideaImageKey(owner:string,idea:Idea){
 // Flat owner folder: existing RLS and account-deletion cleanup both apply.
 return owner+'/idea-'+createHash('sha256').update(ideaImageIdentity(idea)).digest('hex')+'.jpg';
}
// A tiny JPEG reservation, not gallery metadata. It needs INSERT, SELECT and
// DELETE only; the existing bucket deliberately has no UPDATE permission.
const reservation=new Uint8Array([255,216,255,254,0,9,69,78,79,85,71,72,0,255,217]);
export async function imageIsPending(store:IdeaImageStore,key:string,now=Date.now()){
 const created=await store.createdAt(key+'.pending.jpg');
 return created!==null&&now-created<imageLockLifetime;
}
export async function ensureIdeaImage(store:IdeaImageStore,key:string,generate:()=>Promise<Uint8Array>,now=Date.now()):Promise<'ready'|'pending'>{
 if(await store.read(key))return 'ready';
 const lock=key+'.pending.jpg';
 if(await imageIsPending(store,key,now))return 'pending';
 if(await store.createdAt(lock)!==null)await store.remove(lock);
 if(!await store.create(lock,reservation))return 'pending';
 try{
  if(await store.read(key))return 'ready';
  const bytes=await generate();
  if(!validIdeaJpeg(bytes))throw new IdeaImageError('The picture could not be prepared. Try again.');
  if(!await store.create(key,bytes)&&!await store.read(key))throw new IdeaImageError('The picture could not be kept. Try again.');
  return 'ready';
 }finally{await store.remove(lock);}
}
export function validIdeaJpeg(bytes:Uint8Array){return bytes.length>16&&bytes.length<=maxIdeaImageBytes&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes[bytes.length-2]===255&&bytes[bytes.length-1]===217;}
export async function prepareIdeaImageBatch(ideas:Idea[],owner:string,store:IdeaImageStore,generate:(idea:Idea)=>Promise<Uint8Array>){
 const pending=ideas.slice(0,10),errors:{id:number;message:string}[]=[];let next=0,ready=0;
 await Promise.all(Array.from({length:Math.min(5,pending.length)},async()=>{
  while(next<pending.length){const idea=pending[next++];try{if(await ensureIdeaImage(store,ideaImageKey(owner,idea),()=>generate(idea))==='ready')ready++;}catch(error){errors.push({id:idea.id,message:error instanceof IdeaImageError?error.message:'The picture could not be kept. Your idea is still available. Try again later.'});}}
 }));
 return {ready,errors};
}
export async function generateIdeaImage(idea:Idea,apiKey:string,model='gpt-image-2.5-sunburst',request:typeof fetch=fetch){
 if(!apiKey)throw new IdeaImageError('AI pictures are not connected. Your idea is still available.');
 const response=await request('https://api.openai.com/v1/images/generations',{
  method:'POST',signal:AbortSignal.timeout(90_000),headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
  body:JSON.stringify({model,prompt:ideaImagePrompt(idea),n:1,size:'1536x1024',quality:'low',output_format:'jpeg',output_compression:80})
 });
 if(!response.ok){
  console.warn('Idea image provider request failed',{status:response.status,model});
  if(response.status===401||response.status===403)throw new IdeaImageError('The existing AI connection cannot generate pictures. Its image-model access needs checking.');
  if(response.status===429)throw new IdeaImageError('AI pictures are busy right now. Please try again later.',429);
  throw new IdeaImageError('The picture could not be prepared. Your idea is still available. Try again later.');
 }
 const result=await response.json() as {data?:{b64_json?:string}[]};
 const encoded=result.data?.[0]?.b64_json;
 if(typeof encoded!=='string'||encoded.length>Math.ceil(maxIdeaImageBytes/3)*4||!encoded.length||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new IdeaImageError('The image provider returned an unusable picture.');
 const bytes=new Uint8Array(Buffer.from(encoded,'base64'));
 if(!validIdeaJpeg(bytes))throw new IdeaImageError('The image provider returned an unusable picture.');
 return bytes;
}
