import type {Idea} from './ideas.ts';
import {ideaImageIdentity,type IdeaImageCredit} from './idea-image-spec.ts';

export type ImageSnapshot={status:'idle'|'queued'|'loading'|'ready'|'error';credit:IdeaImageCredit|null;error:string};
export const emptyImageSnapshot:ImageSnapshot={status:'idle',credit:null,error:''};
type Job={idea:Idea;key:string;generate:boolean;snapshot:ImageSnapshot};
type Options={request?:typeof fetch;wait?:(ms:number)=>Promise<void>;concurrency?:number};
export function imageClientKey(idea:Idea,scope:string){return scope+'|'+ideaImageIdentity(idea);}

export function createIdeaImageQueue({request=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),concurrency=2}:Options={}){
 const jobs=new Map<string,Job>(),listeners=new Map<string,Set<()=>void>>(),pending:Job[]=[];
 let active=0;
 function emit(job:Job,snapshot:ImageSnapshot){job.snapshot=snapshot;listeners.get(job.key)?.forEach(listener=>listener());}
 async function run(job:Job){
  emit(job,{status:'loading',credit:null,error:''});
  try{
   const url='/api/idea-image?id='+job.idea.id,generated=job.idea.source==='ai',signal=AbortSignal.timeout(180_000);
   let response=await request(url,{method:generated&&job.generate?'POST':'GET',credentials:'same-origin',cache:'no-store',signal});
   let data=await response.json() as IdeaImageCredit&{status?:string;retryAfter?:number;error?:string};
   // Poll only reads after a duplicate request. GET never starts billable work.
   for(let n=0;response.status===202&&n<60;n++){
    await wait(Math.max(1,Math.min(10,data.retryAfter||3))*1000);
    response=await request(url,{credentials:'same-origin',cache:'no-store',signal});
    data=await response.json() as typeof data;
   }
   if(!response.ok||response.status===202||typeof data.image!=='string'||(generated&&(!data.image.startsWith('/api/idea-image?')||data.kind!=='generated')))throw Error(data.error||'The picture is not ready. Your idea is still available. Try again.');
   emit(job,{status:'ready',credit:data,error:''});
  }catch(error){emit(job,{status:'error',credit:null,error:error instanceof Error&&error.name!=='TimeoutError'?error.message:'The picture took too long. Your idea is still available. Try again.'});}
 }
 function pump(){while(active<concurrency&&pending.length){const job=pending.shift()!;active++;void run(job).finally(()=>{active--;pump();});}}
 return {
  snapshot:(key:string)=>jobs.get(key)?.snapshot||emptyImageSnapshot,
  imageFailed(key:string){const job=jobs.get(key);if(job?.snapshot.status==='ready')emit(job,{status:'error',credit:null,error:'The picture could not be loaded. Your idea is still available. Retry when your connection is ready.'});},
  subscribe(key:string,listener:()=>void){let set=listeners.get(key);if(!set){set=new Set();listeners.set(key,set);}set.add(listener);return()=>{set!.delete(listener);if(!set!.size)listeners.delete(key);};},
  prepare(idea:Idea,scope:string,retry=false){
   if(idea.image)return;
   const key=imageClientKey(idea,scope),existing=jobs.get(key);
   if(existing&&(!retry||existing.snapshot.status!=='error'))return;
   const job:Job={idea,key,generate:retry,snapshot:{status:'queued',credit:null,error:''}};jobs.set(key,job);pending.push(job);listeners.get(key)?.forEach(listener=>listener());pump();
  }
 };
}
