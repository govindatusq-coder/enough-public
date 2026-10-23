import 'server-only';
import {ZodError} from 'zod';
import {bearSession} from '@/lib/bear/server/session';
import {trustedWrite} from '@/lib/public-auth';
import {providerFromEnv,type StructuredModelProvider} from '@/lib/bear/ai/provider';
import {StoreError,type BearStore} from '@/lib/bear/store/store';
import {CaptureError} from '@/lib/bear/services/capture';
import {ConfirmError} from '@/lib/bear/services/task-inference';

export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export interface BearContext{store:BearStore;provider:StructuredModelProvider|null;user:{id:string;email:string|null;name:string};aiAvailable:boolean}
export class HttpError extends Error{readonly status:number;constructor(message:string,status:number){super(message);this.status=status;}}

// Every /api/bear route: verify the user, build a request-scoped store (RLS applies),
// run the handler and translate errors into honest, non-technical messages.
export async function withBear(req:Request,handler:(ctx:BearContext)=>Promise<Response>,options:{write?:boolean}={}){
 const write=options.write??req.method!=='GET';
 if(write&&!trustedWrite(req))return json({error:'Request origin is not allowed.'},403);
 try{
  const session=await bearSession(req);
  if(!session)return json({error:'Sign in to give things to Bear.',signIn:'/bear/signin'},401);
  const provider=providerFromEnv();
  return await handler({store:session.store,provider,user:session.user,aiAvailable:!!provider});
 }catch(error){return errorResponse(error);}
}
export function errorResponse(error:unknown){
 if(error instanceof HttpError)return json({error:error.message},error.status);
 if(error instanceof ZodError)return json({error:'Check the details and try again.',issues:error.issues.slice(0,5).map(i=>i.path.join('.'))},400);
 if(error instanceof CaptureError)return json({error:error.message,capture:error.capture},error.status);
 if(error instanceof ConfirmError)return json({error:error.message,code:error.code},error.status);
 if(error instanceof StoreError){if(error.code==='not_found')return json({error:"Bear couldn't find that."},404);if(error.code==='conflict')return json({error:'That already exists.'},409);return json({error:error.message,code:'store_unavailable'},503);}
 if(error instanceof Error&&error.message==='not_found')return json({error:"Bear couldn't find that."},404);
 if(error instanceof Error&&error.message==='already_done')return json({error:"That's already sorted."},409);
 if(error instanceof Error&&error.message==='invalid_time')return json({error:'Pick a time that is still ahead of you.'},400);
 console.error('[bear]',error);
 return json({error:"Bear hit a snag. Nothing was lost. Please try again."},503);
}
export async function readJson(req:Request,maxBytes=256*1024){const raw=await req.text();if(new TextEncoder().encode(raw).length>maxBytes)throw new HttpError('That is too much to send at once.',413);try{return JSON.parse(raw);}catch{throw new HttpError('Check the details and try again.',400);}}
