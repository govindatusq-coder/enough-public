import {json,readJson,withBear} from '@/lib/bear/server/context';
import {shareBearDeps} from '@/lib/bear/server/sharebear';
import {DelegationError} from '@/lib/bear/sharebear/core';
import {createRequest,noticesFor,ownerView,syncOwner} from '@/lib/bear/sharebear/service';
import {ensureProfile} from '@/lib/bear/services/profile';
import {completeTask} from '@/lib/bear/services/completion';
export const dynamic='force-dynamic';export const maxDuration=30;
// Share Bear by text, for the person asking: her requests (kept in step with her tasks), her recent helpers, whether texts
// really go out here, and sending a new request (after she has seen exactly what will be shared and tapped Send).
export const GET=(req:Request)=>withBear(req,async({store})=>{
 const deps=await shareBearDeps(req);if(!deps)return json({error:'Share Bear isn’t available just now.'},503);
 const list=await syncOwner(store,deps.rows,(taskId)=>completeTask(store,{taskId,method:'shared',evidence:'user'} as never));
 const p=await ensureProfile(store);
 const contacts=(p.household||[]).filter(h=>h.phone).sort((a,b)=>(b.lastUsedAt||'').localeCompare(a.lastUsedAt||'')).slice(0,6).map(h=>({name:h.name,phone:h.phone}));
 return json({requests:list.map(ownerView),notices:noticesFor(list),contacts,sms:deps.sms.mode,ownerName:(p.name||'').trim().split(/\s+/)[0]||'Someone'});
});
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const deps=await shareBearDeps(req);if(!deps)return json({error:'Share Bear isn’t available just now.'},503);
 try{return json(await createRequest(store,deps,await readJson(req,8*1024)),201);}
 catch(e){if(e instanceof DelegationError)return json({error:e.message},e.status);throw e;}
},{write:true});
