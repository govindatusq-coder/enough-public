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
import {ensureProfile} from '../services/profile.ts';

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

// ---------- The rules every backend follows ----------
// Who a share is between and how it was shared never change. Only the sender can take it back; only the recipient can
// accept, decline, ask to talk or finish it; the sender can answer "let's talk" (it goes back to waiting).
export function checkChange(before:Share,after:Share,userId:string){
 if(after.senderId!==before.senderId||after.recipientId!==before.recipientId||after.mode!==before.mode||after.id!==before.id)throw new ShareError('Not allowed',403);
 if(after.status===before.status)return;
 if(before.status==='revoked')throw new ShareError('That share was taken back.',409);
 const bySender=userId===before.senderId,byRecipient=!!before.recipientId&&userId===before.recipientId;
 if(after.status==='revoked'&&!bySender)throw new ShareError('Only the person who shared it can take it back.',403);
 if(['accepted','declined','discussing','done'].includes(after.status)&&!byRecipient)throw new ShareError('Only the person it was shared with can answer.',403);
 if(after.status==='invited'&&!(bySender&&before.status==='discussing'))throw new ShareError('Not allowed',403);
}

// ---------- Share storage: rows the server keeps for both people ----------
// One row per share. Only the server can read these rows; it shows a share only to its sender or its claimed recipient.
export interface ShareRow{share:Share;tokenHash:string}
export interface ShareRows{
 one(id:string):Promise<ShareRow|null>;
 byToken(hash:string):Promise<ShareRow|null>;
 forUser(userId:string):Promise<ShareRow[]>;
 insert(row:ShareRow):Promise<void>;
 // Writes the row. With onlyIfUnclaimed, it is written only if nobody has claimed it yet; returns whether it was written.
 write(row:ShareRow,onlyIfUnclaimed?:boolean):Promise<boolean>;
 remove(id:string):Promise<void>;
}
export class KvShares implements ShareBackend{
 private userId:string;private rows:ShareRows;
 constructor(userId:string,rows:ShareRows){this.userId=userId;this.rows=rows;}
 private sees(s:Share){return s.senderId===this.userId||s.recipientId===this.userId;}
 async create(share:Share,hash:string){
  if(share.senderId!==this.userId||share.recipientId!==null||share.status!=='invited')throw new ShareError('Not allowed',403);
  await this.rows.insert({share,tokenHash:hash});return share;
 }
 // The first signed-in person (other than the sender) to open the link becomes its recipient. Nobody else can use it after.
 async claim(hash:string){
  for(let attempt=0;attempt<2;attempt++){
   const row=await this.rows.byToken(hash);if(!row)return null;const s=row.share;
   if(s.senderId===this.userId||s.recipientId===this.userId)return s;
   if(s.recipientId||s.status!=='invited')return null;
   const claimed={...s,recipientId:this.userId,updatedAt:new Date().toISOString()};
   if(await this.rows.write({...row,share:claimed},true))return claimed;
  }
  return null;
 }
 async mine(){const all=(await this.rows.forUser(this.userId)).map(r=>r.share).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return {sent:all.filter(s=>s.senderId===this.userId),received:all.filter(s=>s.recipientId===this.userId)};}
 async get(id:string){const r=await this.rows.one(id);return r&&this.sees(r.share)?r.share:null;}
 async save(share:Share){
  const r=await this.rows.one(share.id);if(!r||!this.sees(r.share))throw new ShareError('Not found',404);
  checkChange(r.share,share,this.userId);
  const next={...share,updatedAt:new Date().toISOString()};await this.rows.write({...r,share:next});return next;
 }
 // Delete my data: shares she sent go; shares sent to her are let go (the sender sees them as declined).
 async eraseMine(){for(const r of await this.rows.forUser(this.userId)){if(r.share.senderId===this.userId)await this.rows.remove(r.share.id);else await this.rows.write({...r,share:{...r.share,recipientId:null,status:'declined',updatedAt:new Date().toISOString()}});}}
}

// ---------- In-memory rows (tests and the local harness) ----------
const g=globalThis as unknown as {__bearShareRows?:Map<string,ShareRow>};
export function memoryShareRows():ShareRows{
 const m=(g.__bearShareRows??=new Map());const copy=<T,>(v:T)=>structuredClone(v);
 return {
  async one(id){const r=m.get(id);return r?copy(r):null;},
  async byToken(hash){const r=[...m.values()].find(x=>x.tokenHash===hash);return r?copy(r):null;},
  async forUser(u){return [...m.values()].filter(r=>r.share.senderId===u||r.share.recipientId===u).map(copy);},
  async insert(row){if(m.has(row.share.id)||[...m.values()].some(r=>r.tokenHash===row.tokenHash))throw new ShareError('Duplicate',409);m.set(row.share.id,copy(row));},
  async write(row,onlyIfUnclaimed){const cur=m.get(row.share.id);if(!cur)return false;if(onlyIfUnclaimed&&cur.share.recipientId)return false;m.set(row.share.id,copy(row));return true;},
  async remove(id){m.delete(id);},
 };
}
export class MemoryShares extends KvShares{constructor(userId:string){super(userId,memoryShareRows());}}

// ---------- Supabase table (only if the bear_shares migration is ever applied) ----------
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
 // The person is remembered in her household list, so next time it is one tap. She can edit or remove them in Settings.
 const profile=await ensureProfile(store);const hh=profile.household||[];
 if(!hh.some(h=>h.name.toLowerCase()===input.toName.toLowerCase()))await store.update('profiles',profile.id,{household:[...hh,{id:newId(),name:input.toName,email:null,phone:null}].slice(0,30)});
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
export async function syncMine(store:BearStore,backend:ShareBackend,complete:(taskId:string)=>Promise<unknown>,onFinished:(s:Share)=>Promise<unknown>=async()=>{}){
 const {sent,received}=await backend.mine();
 // Someone who has accepted a share has Load Bear: her household list shows it.
 const joined=new Set(sent.filter(s=>['accepted','done'].includes(s.status)).map(s=>s.toName.trim().toLowerCase()));
 if(joined.size){const profile=await ensureProfile(store);const hh=profile.household||[];if(hh.some(h=>joined.has(h.name.toLowerCase())&&!h.joined))await store.update('profiles',profile.id,{household:hh.map(h=>joined.has(h.name.toLowerCase())?{...h,joined:true}:h)});}
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
  if(t.status==='done'&&s.status==='accepted'){const saved=await backend.save({...s,status:'done',senderSeen:false});await onFinished(saved).catch(()=>null);}
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
