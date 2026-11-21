import {json,readJson,withBear} from '@/lib/bear/server/context';
import {shareBearDeps} from '@/lib/bear/server/sharebear';
import {DelegationError} from '@/lib/bear/sharebear/core';
import {ownerAction} from '@/lib/bear/sharebear/service';
export const dynamic='force-dynamic';export const maxDuration=30;
// Her actions on one request: cancel it, take the task back, resend after a failed text, say she texted it herself, or
// mark its news as seen. Only the person who asked can do any of these.
export const POST=(req:Request,{params}:{params:Promise<{id:string}>})=>withBear(req,async({store})=>{
 const {id}=await params;const deps=await shareBearDeps(req);if(!deps)return json({error:'Share Bear isn’t available just now.'},503);
 try{return json(await ownerAction(store,deps,id,await readJson(req,2048)));}
 catch(e){if(e instanceof DelegationError)return json({error:e.message},e.status);throw e;}
},{write:true});
