import {byId,type Idea} from './ideas.ts';
import type {IdeaImageCredit} from './idea-image-spec.ts';
import {ideaImageKey,IdeaImageError,imageIsPending,type IdeaImageStore} from './idea-image-service.ts';

type Account={owner:string;ideas:Idea[];store:IdeaImageStore};
type Dependencies={account:(id:number,req:Request)=>Promise<Account|null>;licensed:(idea:Idea)=>Promise<IdeaImageCredit|null>};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
function ideaId(req:Request){const value=new URL(req.url).searchParams.get('id');return value&&/^\d+$/.test(value)&&Number(value)<=2147483647?Number(value):null;}
function description(idea:Idea,key:string){return {image:'/api/idea-image?id='+idea.id+'&image=1&v='+key.split('/').pop(),alt:'AI-generated illustration of '+idea.title,kind:'generated' as const};}
function failed(error:unknown){return error instanceof IdeaImageError?json({error:error.message},error.status):json({error:'The picture is unavailable. Your idea is still available. Try again later.'},503);}

export function createIdeaImageHandlers(deps:Dependencies){
 async function owned(id:number,req:Request){const account=await deps.account(id,req);if(!account)return {response:json({error:'Sign in to view this idea.'},401)};const idea=account.ideas.find(i=>i.id===id&&i.source==='ai');if(!idea)return {response:json({error:'This suggestion is not in your account.'},404)};return {account,idea};}
 return {
  async GET(req:Request){try{
   const id=ideaId(req);if(id===null)return json({error:'Choose an idea.'},400);
   if(id<1000){const idea=byId(id);if(!idea||idea.image)return json({error:'No image requested.'},404);const photo=await deps.licensed(idea);return photo?json({...photo,kind:'licensed'}):json({error:'No suitable licensed photo yet.'},404);}
   const result=await owned(id,req);if(result.response)return result.response;
   const {account,idea}=result,key=ideaImageKey(account.owner,idea),bytes=await account.store.read(key);
   if(!bytes)return await imageIsPending(account.store,key)?json({status:'pending',retryAfter:3},202):json({error:'No cached picture.'},404);
   if(new URL(req.url).searchParams.get('image')==='1')return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'image/jpeg'}),{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
   return json(description(idea,key));
  }catch(error){return failed(error);}}
 };
}
