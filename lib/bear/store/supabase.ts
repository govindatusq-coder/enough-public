import type {SupabaseClient} from '@supabase/supabase-js';
import {indexes,StoreError,type BearStore,type Query,type StoredFile,type TableName,type Tables} from './store.ts';

export const BUCKET='bear-documents';
const tableName=(t:TableName)=>'bear_'+t;

// Request-scoped Supabase store. The client carries the signed-in user's session so
// row-level security enforces owner isolation server-side; user_id is also set
// explicitly on every write so a policy mismatch fails closed rather than open.
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
