import {indexes,StoreError,type BearStore,type Query,type StoredFile,type TableName,type Tables,type Where} from './store.ts';

// In-process store used by the automated tests. Behaves like the Supabase store
// (owner isolation, index columns, ordering) but never serves the application.
export class MemoryStore implements BearStore{
 private tables=new Map<TableName,Map<string,unknown>>();
 private files=new Map<string,{bytes:Uint8Array;mime:string}>();
 readonly userId:string;
 constructor(userId:string,shared?:MemoryBackend){this.userId=userId;if(shared){this.tables=shared.tables;this.files=shared.files;}}
 private table<K extends TableName>(name:K):Map<string,Tables[K]>{if(!this.tables.has(name))this.tables.set(name,new Map());return this.tables.get(name) as Map<string,Tables[K]>;}
 private column<K extends TableName>(name:K,row:Tables[K],column:string):unknown{
  if(column==='id')return row.id;if(column==='created_at')return row.createdAt;if(column==='updated_at')return row.updatedAt;
  const fn=(indexes[name] as Record<string,(r:Tables[K])=>unknown>)[column];if(!fn)throw new StoreError(`Unknown column ${column} on ${name}`,'invalid');return fn(row);
 }
 private matches<K extends TableName>(name:K,row:Tables[K],w:Where){
  const v=this.column(name,row,w.column),op=w.op||'eq';
  if(op==='eq')return v===w.value;if(op==='neq')return v!==w.value;if(op==='in')return (w.value as unknown[]).includes(v);
  if(v===null||v===undefined||w.value===null)return false;
  const a=v as number|string,b=w.value as number|string;
  return op==='lte'?a<=b:op==='gte'?a>=b:op==='lt'?a<b:a>b;
 }
 async get<K extends TableName>(table:K,id:string){const row=this.table(table).get(id);return row&&row.userId===this.userId?structuredClone(row):null;}
 async list<K extends TableName>(table:K,query:Query={}){
  let rows=[...this.table(table).values()].filter(r=>r.userId===this.userId);
  for(const w of query.where||[])rows=rows.filter(r=>this.matches(table,r,w));
  if(query.orderBy){const {column,ascending=true}=query.orderBy;rows.sort((x,y)=>{const a=this.column(table,x,column) as string|number|null,b=this.column(table,y,column) as string|number|null;if(a===b)return 0;if(a===null||a===undefined)return 1;if(b===null||b===undefined)return -1;return (a<b?-1:1)*(ascending?1:-1);});}
  else rows.sort((a,b)=>a.createdAt<b.createdAt?-1:1);
  if(query.limit)rows=rows.slice(0,query.limit);
  return structuredClone(rows);
 }
 async insert<K extends TableName>(table:K,row:Tables[K]){
  if(row.userId!==this.userId)throw new StoreError('Row belongs to another user','invalid');
  if(this.table(table).has(row.id))throw new StoreError('Duplicate id','conflict');
  if(table==='push_subscriptions'){for(const r of this.table('push_subscriptions').values())if(r.endpoint===(row as Tables['push_subscriptions']).endpoint)throw new StoreError('Duplicate endpoint','conflict');}
  this.table(table).set(row.id,structuredClone(row));return structuredClone(row);
 }
 async update<K extends TableName>(table:K,id:string,patch:Partial<Tables[K]>){
  const row=this.table(table).get(id);if(!row||row.userId!==this.userId)throw new StoreError('Not found','not_found');
  const next={...row,...patch,id,userId:this.userId,updatedAt:new Date().toISOString()} as Tables[K];
  this.table(table).set(id,structuredClone(next));return structuredClone(next);
 }
 async remove<K extends TableName>(table:K,id:string){const row=this.table(table).get(id);if(row&&row.userId===this.userId)this.table(table).delete(id);}
 async putFile(objectKey:string,bytes:Uint8Array,mime:string):Promise<StoredFile>{
  if(!objectKey.startsWith(this.userId+'/'))throw new StoreError('File path must be owned','invalid');
  this.files.set(objectKey,{bytes:new Uint8Array(bytes),mime});return {objectKey,mime,bytes:bytes.byteLength};
 }
 async getFile(objectKey:string){if(!objectKey.startsWith(this.userId+'/'))return null;const f=this.files.get(objectKey);return f?{bytes:new Uint8Array(f.bytes),mime:f.mime}:null;}
 async fileUrl(objectKey:string){return this.files.has(objectKey)?'memory://'+objectKey:null;}
}
export class MemoryBackend{tables=new Map<TableName,Map<string,unknown>>();files=new Map<string,{bytes:Uint8Array;mime:string}>();for(userId:string){return new MemoryStore(userId,this);}}
