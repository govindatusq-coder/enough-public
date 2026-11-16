import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {uuidFor} from '@/lib/bear/push-keys';
import {KvShares,MemoryShares,ShareError,SupabaseShares,type ShareBackend,type ShareRow,type ShareRows} from '@/lib/bear/board/shares';
import type {BearStore} from '@/lib/bear/store/store';
import {robot} from './outbox-robot';

// Share Bear storage in production, with no database change needed. Shares are kept as rows of the server's own delivery
// account (the one reminders already use), in the existing bear_push_subscriptions table under endpoints "share:<id>".
// Row-level security means only that account can read these rows; the server then shows a share only to its sender or
// its claimed recipient (KvShares enforces who may see and change what). The reminder job ignores these rows: they have
// no push endpoint.
const TABLE='bear_push_subscriptions';
const ep=(id:string)=>'share:'+id;
function rowsFor(db:SupabaseClient,owner:string,secret:string):ShareRows{
 const fail=(e:{message:string}|null)=>{if(e)throw new ShareError('Sharing isn’t available just now. Nothing was lost; please try again.',503);};
 const sel=()=>db.from(TABLE).select('body').eq('user_id',owner).like('endpoint','share:%');
 const rows=(data:{body:unknown}[]|null)=>(data||[]).map(d=>d.body as ShareRow).filter(r=>r&&r.share&&typeof r.tokenHash==='string');
 return {
  async one(id){const {data,error}=await db.from(TABLE).select('body').eq('user_id',owner).eq('endpoint',ep(id)).maybeSingle();fail(error);return (data?.body as ShareRow)||null;},
  async byToken(hash){const {data,error}=await sel().eq('body->>tokenHash',hash).limit(1);fail(error);return rows(data)[0]||null;},
  async forUser(u){
   const [a,b]=await Promise.all([sel().eq('body->share->>senderId',u).limit(300),sel().eq('body->share->>recipientId',u).limit(300)]);fail(a.error);fail(b.error);
   const seen=new Set<string>();return [...rows(a.data),...rows(b.data)].filter(r=>!seen.has(r.share.id)&&(seen.add(r.share.id),true));
  },
  async insert(row){const now=new Date().toISOString();const {error}=await db.from(TABLE).insert({id:uuidFor(secret,ep(row.share.id)),user_id:owner,endpoint:ep(row.share.id),body:row,created_at:now,updated_at:now});fail(error);},
  async write(row,onlyIfUnclaimed){
   let q=db.from(TABLE).update({body:row,updated_at:new Date().toISOString()}).eq('user_id',owner).eq('endpoint',ep(row.share.id));
   if(onlyIfUnclaimed)q=q.is('body->share->>recipientId',null);
   const {data,error}=await q.select('id');fail(error);return (data||[]).length>0;
  },
  async remove(id){const {error}=await db.from(TABLE).delete().eq('user_id',owner).eq('endpoint',ep(id));fail(error);},
 };
}
// Which storage to use for this person's request: the delivery account in production; the in-memory one locally.
export async function sharesForRequest(store:BearStore):Promise<ShareBackend>{
 const db=(store as unknown as {db?:SupabaseClient}).db;
 if(!db)return new MemoryShares(store.userId);
 const r=await robot();
 if(r)return new KvShares(store.userId,rowsFor(r.db,r.userId,r.secret));
 // No delivery account (no server secret): fall back to the bear_shares table, which says plainly if it isn't there.
 return new SupabaseShares(db,store.userId);
}
