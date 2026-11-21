import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {uuidFor} from '@/lib/bear/push-keys';
import type {Delegation} from '@/lib/bear/sharebear/core';
import {memoryDelegations,type DelegationRows} from '@/lib/bear/sharebear/rows';
import {robot} from './outbox-robot';

// Delegations in production: rows of the delivery account in bear_push_subscriptions (endpoint "sb:<id>"), protected by
// row-level security so only that account can read them. No database change is needed. Locally (no database): memory.
const TABLE='bear_push_subscriptions';const ep=(id:string)=>'sb:'+id;
function rows(db:SupabaseClient,owner:string,secret:string):DelegationRows{
 const fail=(e:{message:string}|null)=>{if(e)throw new Error('share_bear_store_unavailable');};
 const sel=()=>db.from(TABLE).select('body').eq('user_id',owner).like('endpoint','sb:%');
 const list=(data:{body:unknown}[]|null)=>(data||[]).map(r=>r.body as Delegation).filter(d=>d&&typeof d.id==='string');
 return {
  async get(id){const {data,error}=await db.from(TABLE).select('body').eq('user_id',owner).eq('endpoint',ep(id)).maybeSingle();fail(error);return (data?.body as Delegation)||null;},
  async byTokenHash(h){const {data,error}=await sel().contains('body',{tokenHashes:[h]}).limit(1);fail(error);return list(data)[0]||null;},
  async byOwner(o){const {data,error}=await sel().eq('body->>ownerId',o).limit(200);fail(error);return list(data);},
  async byProviderMessage(p){const {data,error}=await sel().contains('body',{messages:[{providerId:p}]}).limit(1);fail(error);return list(data)[0]||null;},
  async active(){const {data,error}=await sel().in('body->>status',['SENT','ACCEPTED']).limit(2000);fail(error);return list(data);},
  async insert(d){const now=new Date().toISOString();const {error}=await db.from(TABLE).insert({id:uuidFor(secret,ep(d.id)),user_id:owner,endpoint:ep(d.id),body:d,created_at:now,updated_at:now});fail(error);},
  async write(d){const {data,error}=await db.from(TABLE).update({body:{...d,rev:d.rev+1},updated_at:new Date().toISOString()}).eq('user_id',owner).eq('endpoint',ep(d.id)).eq('body->>rev',String(d.rev)).select('id');fail(error);return (data||[]).length>0;},
  async remove(id){const {error}=await db.from(TABLE).delete().eq('user_id',owner).eq('endpoint',ep(id));fail(error);},
 };
}
export async function delegationRows():Promise<DelegationRows|null>{
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL)return memoryDelegations();
 const r=await robot();return r?rows(r.db,r.userId,r.secret):null;
}
