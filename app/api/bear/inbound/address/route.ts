import {json,withBear} from '@/lib/bear/server/context';
import {addressFor} from '@/lib/bear/inbound/address';
import {inboundServices} from '@/lib/bear/server/inbound';
export const dynamic='force-dynamic';
// The person's own forwarding address. Only offered when forwarding is fully set up and switched on.
export const GET=(req:Request)=>withBear(req,async({user})=>{const s=inboundServices();if(!s)return json({enabled:false,address:null});
 const r=await s.registry.routeFor(user.id);return json({enabled:true,address:r?addressFor(r.token,s.config.domain!):null});});
// Create one, or replace it (the old address stops working straight away).
export const POST=(req:Request)=>withBear(req,async({user})=>{const s=inboundServices();if(!s)return json({error:'Forwarding isn’t available yet.'},404);
 const r=await s.registry.create(user.id);return json({enabled:true,address:addressFor(r.token,s.config.domain!)});},{write:true});
// Turn forwarding off: the address and every message record go.
export const DELETE=(req:Request)=>withBear(req,async({user})=>{const s=inboundServices();if(!s)return json({enabled:false,address:null});
 await s.registry.forget(user.id);return json({enabled:true,address:null});},{write:true});
