import type {SupabaseClient} from '@supabase/supabase-js';
import {newToken} from './address.ts';

// Routing and idempotency. Kept outside the per-user store on purpose: the webhook arrives with no user
// session, so it can only learn the account from an unguessable token, and nothing else.
export interface InboundRoute{token:string;userId:string;createdAt:string;revokedAt:string|null}
export interface InboundRegistry{
 routeFor(userId:string):Promise<InboundRoute|null>;
 create(userId:string):Promise<InboundRoute>;           // replaces any existing route (old address stops working)
 revoke(userId:string):Promise<void>;
 userForToken(token:string):Promise<string|null>;
 // Idempotency: true only the first time this message is claimed for this user.
 claim(userId:string,messageKey:string):Promise<boolean>;
 finish(userId:string,messageKey:string,status:'done'|'ignored'):Promise<void>;
 release(userId:string,messageKey:string):Promise<void>;  // processing failed: let the provider's retry through
 forget(userId:string):Promise<void>;                     // account deletion / turning forwarding off
}
export class MemoryInboundRegistry implements InboundRegistry{
 routes=new Map<string,InboundRoute>();messages=new Map<string,string>();
 async routeFor(userId:string){return [...this.routes.values()].find(r=>r.userId===userId&&!r.revokedAt)||null;}
 async create(userId:string){await this.revoke(userId);const r={token:newToken(),userId,createdAt:new Date().toISOString(),revokedAt:null};this.routes.set(r.token,r);return r;}
 async revoke(userId:string){for(const r of this.routes.values())if(r.userId===userId&&!r.revokedAt)r.revokedAt=new Date().toISOString();}
 async userForToken(token:string){const r=this.routes.get(token);return r&&!r.revokedAt?r.userId:null;}
 async claim(userId:string,key:string){const k=`${userId}:${key}`;if(this.messages.has(k))return false;this.messages.set(k,'processing');return true;}
 async finish(userId:string,key:string,status:'done'|'ignored'){this.messages.set(`${userId}:${key}`,status);}
 async release(userId:string,key:string){this.messages.delete(`${userId}:${key}`);}
 async forget(userId:string){for(const [t,r] of this.routes)if(r.userId===userId)this.routes.delete(t);for(const k of this.messages.keys())if(k.startsWith(userId+':'))this.messages.delete(k);}
}
// Supabase: two small tables (see supabase/migrations/20261108120000_bear_inbound_email.sql), used only
// by the server with the service-role key. Message keys are stored hashed; no subject, sender or body.
export class SupabaseInboundRegistry implements InboundRegistry{
 private admin:SupabaseClient;private hash:(s:string)=>string;
 constructor(admin:SupabaseClient,hash:(s:string)=>string){this.admin=admin;this.hash=hash;}
 async routeFor(userId:string){const {data}=await this.admin.from('bear_inbound_routes').select('token,user_id,created_at,revoked_at').eq('user_id',userId).is('revoked_at',null).maybeSingle();return data?{token:data.token,userId:data.user_id,createdAt:data.created_at,revokedAt:data.revoked_at}:null;}
 async create(userId:string){await this.revoke(userId);const token=newToken();const {error}=await this.admin.from('bear_inbound_routes').insert({token,user_id:userId});if(error)throw new Error('route_unavailable');return {token,userId,createdAt:new Date().toISOString(),revokedAt:null};}
 async revoke(userId:string){await this.admin.from('bear_inbound_routes').update({revoked_at:new Date().toISOString()}).eq('user_id',userId).is('revoked_at',null);}
 async userForToken(token:string){const {data}=await this.admin.from('bear_inbound_routes').select('user_id').eq('token',token).is('revoked_at',null).maybeSingle();return data?.user_id||null;}
 async claim(userId:string,key:string){const {error}=await this.admin.from('bear_inbound_messages').insert({user_id:userId,message_key:this.hash(key),status:'processing'});return !error;}
 async finish(userId:string,key:string,status:'done'|'ignored'){await this.admin.from('bear_inbound_messages').update({status}).eq('user_id',userId).eq('message_key',this.hash(key));}
 async release(userId:string,key:string){await this.admin.from('bear_inbound_messages').delete().eq('user_id',userId).eq('message_key',this.hash(key));}
 async forget(userId:string){await this.admin.from('bear_inbound_messages').delete().eq('user_id',userId);await this.admin.from('bear_inbound_routes').delete().eq('user_id',userId);}
}
