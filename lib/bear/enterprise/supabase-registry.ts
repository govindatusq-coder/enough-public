import type {SupabaseClient} from '@supabase/supabase-js';
import {randomUUID} from 'node:crypto';
import {hashKey,type Member,type Tenant,type TenantRegistry} from './tenants.ts';

// Supabase-backed tenant registry (tables from migration 20261109130000_bear_enterprise.sql), used only by
// the server with the service-role key. Members get a real auth user with no password and no email: they
// can only be reached through their tenant until a sign-in method is linked.
export class SupabaseTenantRegistry implements TenantRegistry{
 private db:SupabaseClient;constructor(db:SupabaseClient){this.db=db;}
 async tenantForKey(raw:string){const {data:k}=await this.db.from('bear_tenant_keys').select('tenant_id').eq('key_hash',hashKey(raw)).is('revoked_at',null).maybeSingle();if(!k)return null;
  const {data:t}=await this.db.from('bear_tenants').select('id,name,brand,features,status').eq('id',k.tenant_id).maybeSingle();return t&&t.status==='active'?t as Tenant:null;}
 private row(r:{tenant_id:string;external_id:string;user_id:string;status:string;created_at:string}):Member{return {tenantId:r.tenant_id,externalId:r.external_id,userId:r.user_id,status:r.status as Member['status'],createdAt:r.created_at};}
 async member(tenantId:string,externalId:string){const {data}=await this.db.from('bear_tenant_members').select('*').eq('tenant_id',tenantId).eq('external_id',externalId).eq('status','active').maybeSingle();return data?this.row(data):null;}
 async provision(tenantId:string,externalId:string){
  const {data:cur}=await this.db.from('bear_tenant_members').select('*').eq('tenant_id',tenantId).eq('external_id',externalId).maybeSingle();
  if(cur){if(cur.status!=='active')await this.db.from('bear_tenant_members').update({status:'active'}).eq('tenant_id',tenantId).eq('external_id',externalId);return this.row({...cur,status:'active'});}
  const {data:u,error}=await this.db.auth.admin.createUser({email:`${randomUUID()}@members.invalid`,email_confirm:false,user_metadata:{tenant:tenantId}});if(error||!u.user)throw new Error('provision_failed');
  const {data,error:e2}=await this.db.from('bear_tenant_members').insert({tenant_id:tenantId,external_id:externalId,user_id:u.user.id,status:'active'}).select('*').single();if(e2)throw new Error('provision_failed');return this.row(data);}
 async deprovision(tenantId:string,externalId:string){const {data}=await this.db.from('bear_tenant_members').update({status:'deprovisioned'}).eq('tenant_id',tenantId).eq('external_id',externalId).eq('status','active').select('user_id');return !!data?.length;}
 async members(tenantId:string){const {data}=await this.db.from('bear_tenant_members').select('*').eq('tenant_id',tenantId);return (data||[]).map(r=>this.row(r));}
 async idempotent(tenantId:string,key:string){const {data}=await this.db.from('bear_api_idempotency').select('status,body').eq('tenant_id',tenantId).eq('key_hash',hashKey(key)).maybeSingle();return data?{status:data.status,body:data.body}:null;}
 async saveIdempotent(tenantId:string,key:string,res:{status:number;body:unknown}){await this.db.from('bear_api_idempotency').upsert({tenant_id:tenantId,key_hash:hashKey(key),status:res.status,body:res.body});}
}
