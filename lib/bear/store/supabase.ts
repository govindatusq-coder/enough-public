import type {SupabaseClient} from '@supabase/supabase-js';
import {indexes,StoreError,type BearStore,type Query,type StoredFile,type TableName,type Tables} from './store.ts';

export const BUCKET='bear-documents';
const tableName=(t:TableName)=>'bear_'+t;

// Request-scoped Supabase store. The client carries the signed-in user's session so
// row-level security enforces owner isolation server-side; user_id is also set
// explicitly on every write so a policy mismatch fails closed rather than open.
// Same order as supabase/migrations/20261112120000_bear_delete_my_data.sql (children before parents).
export const ERASE_ORDER=['responsibility_events','connected_accounts','study_responses','push_subscriptions','reminder_interactions','reminders','wins','completions','value_ledger',
 'behaviour_events','suggestions','recurring_expectations','bills','task_dependencies','tasks','projects','user_corrections','ai_inferences','extractions','source_documents','captures','people','areas',
 'inbound_messages','inbound_routes','profiles'];
const NO_FUNCTION=new Set(['PGRST202','42883']),NO_TABLE=new Set(['42P01','PGRST205']);
export class SupabaseStore implements BearStore{
 readonly userId:string;private db:SupabaseClient;
 constructor(userId:string,db:SupabaseClient){this.userId=userId;this.db=db;}
 private toRow<K extends TableName>(table:K,row:Tables[K]){
  const columns:Record<string,unknown>={id:row.id,user_id:this.userId,created_at:row.createdAt,updated_at:row.updatedAt,body:row};
  for(const [column,fn] of Object.entries(indexes[table] as Record<string,(r:Tables[K])=>unknown>))columns[column]=fn(row)??null;
  return columns;
 }
 private fromRow<K extends TableName>(data:{body:Tables[K]}|null):Tables[K]|null{return data?data.body:null;}
 private wrap(error:{code?:string;message:string}|null):never|void{
  if(!error)return;
  if(error.code==='42P01')throw new StoreError("Bear's memory isn't connected yet. The Load Bear migration has not been applied.",'unavailable');
  if(error.code==='23505')throw new StoreError('Duplicate','conflict');
  throw new StoreError(error.message,'unavailable');
 }
 async get<K extends TableName>(table:K,id:string){
  const {data,error}=await this.db.from(tableName(table)).select('body').eq('id',id).eq('user_id',this.userId).maybeSingle();this.wrap(error);return this.fromRow<K>(data as {body:Tables[K]}|null);
 }
 async list<K extends TableName>(table:K,query:Query={}){
  let q=this.db.from(tableName(table)).select('body').eq('user_id',this.userId);
  for(const w of query.where||[]){const op=w.op||'eq';
   if(op==='eq')q=w.value===null?q.is(w.column,null):q.eq(w.column,w.value as string);
   else if(op==='neq')q=w.value===null?q.not(w.column,'is',null):q.neq(w.column,w.value as string);
   else if(op==='in')q=q.in(w.column,w.value as string[]);
   else q=q[op](w.column,w.value as string);}
  q=query.orderBy?q.order(query.orderBy.column,{ascending:query.orderBy.ascending??true,nullsFirst:false}):q.order('created_at',{ascending:true});
  if(query.limit)q=q.limit(query.limit);
  const {data,error}=await q;this.wrap(error);return ((data||[]) as {body:Tables[K]}[]).map(r=>r.body);
 }
 async insert<K extends TableName>(table:K,row:Tables[K]){
  if(row.userId!==this.userId)throw new StoreError('Row belongs to another user','invalid');
  const {error}=await this.db.from(tableName(table)).insert(this.toRow(table,row));this.wrap(error);return row;
 }
 async update<K extends TableName>(table:K,id:string,patch:Partial<Tables[K]>){
  const current=await this.get(table,id);if(!current)throw new StoreError('Not found','not_found');
  const next={...current,...patch,id,userId:this.userId,updatedAt:new Date().toISOString()} as Tables[K];
  const {error}=await this.db.from(tableName(table)).update(this.toRow(table,next)).eq('id',id).eq('user_id',this.userId);this.wrap(error);return next;
 }
 async remove<K extends TableName>(table:K,id:string){const {error}=await this.db.from(tableName(table)).delete().eq('id',id).eq('user_id',this.userId);this.wrap(error);}
 // Everything this person has: stored files first (so a failure leaves the records and can be retried), then every record in one call.
 private async removeTree(prefix:string,depth=0):Promise<void>{
  if(depth>6)return;
  for(let guard=0;guard<200;guard++){
   const {data,error}=await this.db.storage.from(BUCKET).list(prefix,{limit:100});this.wrap(error);if(!data?.length)return;
   const files=data.filter(x=>x.id).map(x=>`${prefix}/${x.name}`);const dirs=data.filter(x=>!x.id).map(x=>`${prefix}/${x.name}`);
   if(files.length){const r=await this.db.storage.from(BUCKET).remove(files);this.wrap(r.error);}
   for(const d of dirs)await this.removeTree(d,depth+1);
   if(!files.length)return;
  }
 }
 async eraseAll(){
  await this.removeTree(this.userId);
  const {error}=await this.db.rpc('bear_delete_my_data');
  if(!error)return {leftover:[] as string[]};
  // The database helper isn't installed (its migration hasn't been applied): remove the rows directly, as this person, table by table.
  if(!NO_FUNCTION.has(error.code||''))this.wrap(error);
  const leftover:string[]=[];
  for(const t of ERASE_ORDER){
   const r=await this.db.from('bear_'+t).delete().eq('user_id',this.userId);
   if(!r.error||NO_TABLE.has(r.error.code||''))continue;
   if(r.error.code==='42501'){ // not allowed to delete (the append-only history): only a problem if this person has rows there
    const c=await this.db.from('bear_'+t).select('id',{count:'exact',head:true}).eq('user_id',this.userId);
    if(c.error||(c.count||0)>0)leftover.push(t);continue;
   }
   this.wrap(r.error);
  }
  return {leftover};
 }
 async putFile(objectKey:string,bytes:Uint8Array,mime:string):Promise<StoredFile>{
  if(!objectKey.startsWith(this.userId+'/'))throw new StoreError('File path must be owned','invalid');
  const {error}=await this.db.storage.from(BUCKET).upload(objectKey,bytes,{contentType:mime,upsert:false});
  if(error)throw new StoreError('The file could not be stored.','unavailable');
  return {objectKey,mime,bytes:bytes.byteLength};
 }
 async getFile(objectKey:string){
  if(!objectKey.startsWith(this.userId+'/'))return null;
  const {data,error}=await this.db.storage.from(BUCKET).download(objectKey);if(error||!data)return null;
  return {bytes:new Uint8Array(await data.arrayBuffer()),mime:data.type||'application/octet-stream'};
 }
 async fileUrl(objectKey:string,expiresSeconds=600){
  if(!objectKey.startsWith(this.userId+'/'))return null;
  const {data,error}=await this.db.storage.from(BUCKET).createSignedUrl(objectKey,expiresSeconds);return error?null:data.signedUrl;
 }
}
