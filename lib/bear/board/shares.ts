// Share Bear: handing a responsibility to someone else in the household. Three ways:
//  info     - they get to see it; nothing changes hands.
//  action   - they are asked to do one thing; she keeps the bigger responsibility.
//  transfer - they are asked to take it over; it only changes hands once they say yes.
// Shares cross between two people's private spaces, so they live in their own table (bear_shares), not in either person's store.
// A share is reached by a one-off link she sends herself. Whoever opens it first (signed in) becomes the recipient; nobody
// else can then see it. Tasks stay private unless shared like this.
import {z} from 'zod';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {Task} from '../domain/types.ts';
import {newId,type BearStore} from '../store/store.ts';

export type ShareMode='info'|'action'|'transfer';
export type ShareStatus='invited'|'accepted'|'discussing'|'declined'|'done'|'revoked';
export interface Share{id:string;senderId:string;recipientId:string|null;mode:ShareMode;status:ShareStatus;title:string;notes:string|null;dueAt:string|null;
 senderName:string;toName:string;senderTaskId:string;recipientTaskId:string|null;messages:{from:'sender'|'recipient';text:string;at:string}[];senderSeen:boolean;createdAt:string;updatedAt:string}

export class ShareError extends Error{readonly status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export interface ShareBackend{
 create(share:Share,tokenHash:string):Promise<Share>;
 claim(tokenHash:string):Promise<Share|null>;
 mine():Promise<{sent:Share[];received:Share[]}>;
 get(id:string):Promise<Share|null>;
 save(share:Share):Promise<Share>;
 eraseMine():Promise<void>;
}

export async function hashToken(token:string){const d=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
const newToken=()=>{const b=new Uint8Array(24);globalThis.crypto.getRandomValues(b);return Buffer.from(b).toString('base64url');};

// ---------- In-memory (tests and local harness) ----------
const g=globalThis as unknown as {__bearShares?:Map<string,{share:Share;hash:string}>};
export class MemoryShares implements ShareBackend{
 private userId:string;
 constructor(userId:string){this.userId=userId;g.__bearShares??=new Map();}
 private get rows(){return g.__bearShares!;}
 private sees(s:Share){return s.senderId===this.userId||s.recipientId===this.userId;}
 async create(share:Share,hash:string){if(share.senderId!==this.userId)throw new ShareError('Not yours',403);this.rows.set(share.id,{share:structuredClone(share),hash});return structuredClone(share);}
 async claim(hash:string){
  const row=[...this.rows.values()].find(r=>r.hash===hash);if(!row)return null;
  const s=row.share;if(s.senderId===this.userId)return structuredClone(s);
  if(s.recipientId&&s.recipientId!==this.userId)return null;
  if(!s.recipientId){if(s.status!=='invited')return null;s.recipientId=this.userId;}
  return structuredClone(s);
 }
 async mine(){const all=[...this.rows.values()].map(r=>r.share);return {sent:structuredClone(all.filter(s=>s.senderId===this.userId)),received:structuredClone(all.filter(s=>s.recipientId===this.userId))};}
 async get(id:string){const r=this.rows.get(id);return r&&this.sees(r.share)?structuredClone(r.share):null;}
 async save(share:Share){
  const r=this.rows.get(share.id);if(!r||!this.sees(r.share))throw new ShareError('Not found',404);
  // Who it is between, and how it was shared, never change after it is made.
  if(share.senderId!==r.share.senderId||share.recipientId!==r.share.recipientId||share.mode!==r.share.mode)throw new ShareError('Not allowed',403);
  r.share=structuredClone({...share,updatedAt:new Date().toISOString()});return structuredClone(r.share);
 }
 async eraseMine(){for(const [id,r] of [...this.rows])if(r.share.senderId===this.userId)this.rows.delete(id);else if(r.share.recipientId===this.userId)r.share.recipientId=null,r.share.status='declined';}
}

// ---------- Supabase (production) ----------
// Row-level security lets each person see only shares they sent or received. Claiming a link goes through a database
// function, because before claiming, the recipient cannot see the row at all (migration 20261116120000_bear_shares).
export class SupabaseShares implements ShareBackend{
 private db:SupabaseClient;private userId:string;
 constructor(db:SupabaseClient,userId:string){this.db=db;this.userId=userId;}
 private fail(error:{code?:string;message:string}|null){if(!error)return;if(error.code==='42P01'||error.code==='PGRST205'||error.code==='PGRST202')throw new ShareError('Sharing needs a database update first (migration 20261116120000_bear_shares).',503);throw new ShareError(error.message,500);}
 private row(s:Share){return {id:s.id,sender_id:s.senderId,recipient_id:s.recipientId,mode:s.mode,status:s.status,body:s,updated_at:new Date().toISOString()};}
 private from(r:{body:Share;recipient_id:string|null;status:ShareStatus;mode:ShareMode;sender_id:string}):Share{return {...r.body,senderId:r.sender_id,recipientId:r.recipient_id,status:r.status,mode:r.mode};}
 async create(share:Share,hash:string){const {error}=await this.db.from('bear_shares').insert({...this.row(share),token_hash:hash,created_at:share.createdAt});this.fail(error);return share;}
 async claim(hash:string){const {data,error}=await this.db.rpc('bear_claim_share',{p_token_hash:hash});this.fail(error);if(!data)return null;return this.get(String(data));}
 async mine(){
  const {data,error}=await this.db.from('bear_shares').select('body,recipient_id,status,mode,sender_id').or(`sender_id.eq.${this.userId},recipient_id.eq.${this.userId}`).order('created_at',{ascending:false}).limit(200);this.fail(error);
  const all=(data||[]).map(r=>this.from(r as never));return {sent:all.filter(s=>s.senderId===this.userId),received:all.filter(s=>s.recipientId===this.userId)};
 }
 async get(id:string){const {data,error}=await this.db.from('bear_shares').select('body,recipient_id,status,mode,sender_id').eq('id',id).maybeSingle();this.fail(error);return data?this.from(data as never):null;}
 async save(share:Share){const {error}=await this.db.from('bear_shares').update({status:share.status,body:share,updated_at:new Date().toISOString()}).eq('id',share.id);this.fail(error);return share;}
 async eraseMine(){const a=await this.db.from('bear_shares').delete().eq('sender_id',this.userId);this.fail(a.error);const b=await this.db.from('bear_shares').update({recipient_id:null,status:'declined'}).eq('recipient_id',this.userId);this.fail(b.error);}
}
export function sharesFor(store:BearStore):ShareBackend{
 const db=(store as unknown as {db?:SupabaseClient}).db;
 return db?new SupabaseShares(db,store.userId):new MemoryShares(store.userId);
}

// ---------- The flow ----------
export const shareSchema=z.object({mode:z.enum(['info','action','transfer']),toName:z.string().trim().min(1).max(60),note:z.string().trim().max(500).nullable().default(null)}).strict();
export async function shareTask(store:BearStore,backend:ShareBackend,senderName:string,taskId:string,input:z.infer<typeof shareSchema>){
 const task=await store.get('tasks',taskId);if(!task||task.status!=='open')throw new ShareError('Bear couldn’t find that.',404);
 if(task.sharedIn)throw new ShareError('This came from someone else, so it can’t be passed on from here.',400);
 const at=new Date().toISOString();const token=newToken();
 const share:Share={id:newId(),senderId:store.userId,recipientId:null,mode:input.mode,status:'invited',title:task.title,notes:[input.note,task.notes].filter(Boolean).join('\n\n').slice(0,1500)||null,dueAt:task.dueAt,
  senderName:senderName||'Someone',toName:input.toName,senderTaskId:task.id,recipientTaskId:null,messages:[],senderSeen:true,createdAt:at,updatedAt:at};
 await backend.create(share,await hashToken(token));
 await store.update('tasks',task.id,{sharedOut:{shareId:share.id,mode:input.mode,to:input.toName}});
 return {share,link:`/bear/shared/join/${token}`};
}
export async function openInvite(backend:ShareBackend,token:string){
 if(!/^[A-Za-z0-9_-]{20,64}$/.test(token))throw new ShareError('That link isn’t right.',404);
 const s=await backend.claim(await hashToken(token));if(!s)throw new ShareError('That link has already been used by someone else, or was taken back.',404);
 return s;
}
export const respondSchema=z.object({answer:z.enum(['accept','decline','discuss']),message:z.string().trim().max(500).nullable().default(null)}).strict();
// The recipient answers. Accepting an action or a responsibility puts it on their own lists; accepting information just files it.
export async function respond(store:BearStore,backend:ShareBackend,shareId:string,input:z.infer<typeof respondSchema>,addTask:(title:string)=>Promise<Task>){
 const s=await backend.get(shareId);if(!s||s.recipientId!==store.userId)throw new ShareError('Bear couldn’t find that.',404);
 if(s.status==='revoked')throw new ShareError(`${s.senderName} took this back.`,409);
 const at=new Date().toISOString();const messages=input.message?[...s.messages,{from:'recipient' as const,text:input.message,at}]:s.messages;
 if(input.answer==='accept'){
  let recipientTaskId=s.recipientTaskId;
  if(s.mode!=='info'&&!recipientTaskId){
   const t=await addTask(s.title);
   await store.update('tasks',t.id,{sharedIn:{shareId:s.id,mode:s.mode,from:s.senderName},dueAt:s.dueAt,notes:s.notes});recipientTaskId=t.id;
  }
  return backend.save({...s,status:'accepted',recipientTaskId,messages,senderSeen:false});
 }
 return backend.save({...s,status:input.answer==='decline'?'declined':'discussing',messages,senderSeen:false});
}
export async function senderReply(backend:ShareBackend,store:BearStore,shareId:string,message:string){
 const s=await backend.get(shareId);if(!s||s.senderId!==store.userId)throw new ShareError('Bear couldn’t find that.',404);
 return backend.save({...s,status:s.status==='discussing'?'invited':s.status,messages:[...s.messages,{from:'sender',text:message.slice(0,500),at:new Date().toISOString()}]});
}
export async function revoke(store:BearStore,backend:ShareBackend,shareId:string){
 const s=await backend.get(shareId);if(!s||s.senderId!==store.userId)throw new ShareError('Bear couldn’t find that.',404);
 const saved=await backend.save({...s,status:'revoked',senderSeen:true});
 const task=await store.get('tasks',s.senderTaskId);if(task)await store.update('tasks',task.id,{sharedOut:null,readiness:null});
 return saved;
}
// Bring her side up to date with what the other person did. Called whenever her board or Shared screen loads.
// Accepted: she is now waiting on them (a transfer leaves her lists). Done: a transfer is finished for her too.
// Declined: it is hers again, unchanged.
export async function syncMine(store:BearStore,backend:ShareBackend,complete:(taskId:string)=>Promise<unknown>){
 const {sent,received}=await backend.mine();
 for(const s of sent){
  const task=await store.get('tasks',s.senderTaskId);if(!task||task.sharedOut?.shareId!==s.id)continue;
  if(s.status==='accepted'&&s.mode!=='info'&&task.readiness!=='waiting'&&task.status==='open'){
   await store.update('tasks',task.id,{readiness:'waiting'});
   if(s.mode==='transfer')for(const r of await store.list('reminders',{where:[{column:'task_id',value:task.id},{column:'status',op:'in',value:['scheduled','snoozed']}]}))await store.update('reminders',r.id,{status:'cancelled'});
  }
  if(s.status==='done'&&task.status==='open'){if(s.mode==='transfer')await complete(task.id);else await store.update('tasks',task.id,{readiness:null});}
  if(s.status==='declined'&&task.readiness==='waiting')await store.update('tasks',task.id,{readiness:null});
 }
 for(const s of received){
  if(!s.recipientTaskId)continue;const t=await store.get('tasks',s.recipientTaskId);if(!t)continue;
  if(t.status==='done'&&s.status==='accepted')await backend.save({...s,status:'done',senderSeen:false});
  if(s.status==='revoked'&&t.status==='open')await store.update('tasks',t.id,{status:'dropped'});
 }
 return {sent,received};
}
export function noticeFor(s:Share):string|null{
 const who=s.toName;const what=s.title;
 if(s.status==='accepted')return s.mode==='transfer'?`${who} accepted responsibility for “${what}”.`:s.mode==='action'?`${who} said yes to “${what}”.`:`${who} has seen “${what}”.`;
 if(s.status==='done')return `${who} finished “${what}”.`;
 if(s.status==='declined')return `${who} can’t take “${what}”. It’s back with you.`;
 if(s.status==='discussing')return `${who} wants to talk about “${what}”.`;
 return null;
}
