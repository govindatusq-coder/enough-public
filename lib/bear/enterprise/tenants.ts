import {createHash,randomBytes,randomUUID} from 'node:crypto';

// Tenants (an employer or benefits platform), their API keys and their members. A member is an employee
// identified by the TENANT'S OWN external id; the tenant never sees Load Bear's internal user id, and one
// tenant's external ids mean nothing to another. Keys are shown once and stored only as SHA-256 hashes.
export interface Tenant{id:string;name:string;brand:Partial<import('./branding.ts').BrandConfig>;features:string[];status:'active'|'suspended'}
export interface Member{tenantId:string;externalId:string;userId:string;status:'active'|'deprovisioned';createdAt:string}
export const hashKey=(raw:string)=>createHash('sha256').update(raw).digest('hex');
export const newApiKey=()=>`lbk_${randomBytes(24).toString('base64url')}`;
export interface TenantRegistry{
 tenantForKey(rawKey:string):Promise<Tenant|null>;
 member(tenantId:string,externalId:string):Promise<Member|null>;
 provision(tenantId:string,externalId:string):Promise<Member>;
 deprovision(tenantId:string,externalId:string):Promise<boolean>;
 members(tenantId:string):Promise<Member[]>;
 // Idempotency: the stored response for a key, or null (then the caller does the work and saves it).
 idempotent(tenantId:string,key:string):Promise<{status:number;body:unknown}|null>;
 saveIdempotent(tenantId:string,key:string,res:{status:number;body:unknown}):Promise<void>;
}
export class MemoryTenantRegistry implements TenantRegistry{
 tenants=new Map<string,Tenant>();keys=new Map<string,{tenantId:string;revoked:boolean}>();list:Member[]=[];idem=new Map<string,{status:number;body:unknown}>();
 createTenant(name:string,extra:Partial<Tenant>={}){const t:Tenant={id:randomUUID(),name,brand:{},features:[],status:'active',...extra};this.tenants.set(t.id,t);const key=newApiKey();this.keys.set(hashKey(key),{tenantId:t.id,revoked:false});return {tenant:t,key};}
 revokeKey(raw:string){const k=this.keys.get(hashKey(raw));if(k)k.revoked=true;}
 async tenantForKey(raw:string){const k=this.keys.get(hashKey(raw));if(!k||k.revoked)return null;const t=this.tenants.get(k.tenantId);return t&&t.status==='active'?t:null;}
 async member(tenantId:string,externalId:string){return this.list.find(m=>m.tenantId===tenantId&&m.externalId===externalId&&m.status==='active')||null;}
 async provision(tenantId:string,externalId:string){const cur=this.list.find(m=>m.tenantId===tenantId&&m.externalId===externalId);if(cur){cur.status='active';return cur;}const m:Member={tenantId,externalId,userId:randomUUID(),status:'active',createdAt:new Date().toISOString()};this.list.push(m);return m;}
 async deprovision(tenantId:string,externalId:string){const m=this.list.find(x=>x.tenantId===tenantId&&x.externalId===externalId&&x.status==='active');if(!m)return false;m.status='deprovisioned';return true;}
 async members(tenantId:string){return this.list.filter(m=>m.tenantId===tenantId);}
 async idempotent(tenantId:string,key:string){return this.idem.get(`${tenantId}:${key}`)||null;}
 async saveIdempotent(tenantId:string,key:string,res:{status:number;body:unknown}){this.idem.set(`${tenantId}:${key}`,res);}
}
