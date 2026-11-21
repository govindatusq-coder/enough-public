// Share Bear by text: asking, answering, keeping her task in step, and the follow-up. The responsibility stays hers; the
// delegation only records who is helping and how it is going.
import {z} from 'zod';
import type {BearStore} from '../store/store.ts';
import type {Task} from '../domain/types.ts';
import {newId} from '../store/store.ts';
import {ensureProfile} from '../services/profile.ts';
import {ACTION_TO,DelegationError,TOKEN_RE,expiryFor,followUpFor,hashToken,label,linkLive,maskPhone,move,newToken,normalisePhone,noticeText,publicView,reminderText,requestText,type DMessage,type Delegation,type NoticeType,type RecipientAction} from './core.ts';
import type {DelegationRows} from './rows.ts';
import type {SmsProvider} from './sms.ts';

export interface Deps{rows:DelegationRows;sms:SmsProvider;baseUrl:string;statusCallback?:string|null;notify?:(d:Delegation,t:NoticeType)=>Promise<unknown>}
export const DEFAULT_MESSAGE='Could you please take care of this?';
export const createSchema=z.object({taskId:z.string().uuid(),name:z.string().trim().min(1).max(40),phone:z.string().trim().min(6).max(24),message:z.string().trim().max(240).nullable().default(null),idempotencyKey:z.string().regex(/^[A-Za-z0-9_-]{8,64}$/)}).strict();
const link=(deps:Deps,token:string)=>`${deps.baseUrl.replace(/\/$/,'')}/bear/r/${token}`;

// What she sees of one delegation.
export function ownerView(d:Delegation){
 return {id:d.id,taskId:d.taskId,status:d.status,label:label(d.status),to:d.recipient.name,phone:maskPhone(d.recipient.phone),title:d.snapshot.title,due:d.snapshot.due,dueTime:d.snapshot.dueTime,message:d.snapshot.message,
  createdAt:d.createdAt,lastUpdate:d.lastRecipientUpdate||d.sentAt||d.createdAt,sentBy:d.messages.find(m=>m.kind==='request'&&m.status!=='failed')?.provider||null,changedSince:d.changedSince,
  lastError:d.messages.filter(m=>m.status==='failed').at(-1)?.error||null,history:d.events.slice(-8).map(e=>({at:e.at,text:historyText(d,e.type,e.to)}))};
}
const historyText=(d:Delegation,type:string,to:string|null)=>type==='status'?({SENT:`Asked ${d.recipient.name}`,ACCEPTED:`${d.recipient.name} said yes`,DECLINED:`${d.recipient.name} said no`,COMPLETED:`${d.recipient.name} said it’s done`,UNABLE_TO_COMPLETE:`${d.recipient.name} can’t do it any more`,EXPIRED:'No answer in time',CANCELLED:'Request cancelled',SEND_FAILED:'The text didn’t send',PENDING_SEND:'Sending'} as Record<string,string>)[to||'']||label(to as never):type==='on_track'?`${d.recipient.name} says it’s on track`:type==='reminder'?`Bear reminded ${d.recipient.name}`:type==='at_risk'?'Not marked done yet':type;

async function save(rows:DelegationRows,d:Delegation):Promise<Delegation>{if(!(await rows.write(d)))throw new DelegationError('Something changed at the same moment. Please try again.',409);return {...d,rev:d.rev+1};}
async function deliver(deps:Deps,d:Delegation,kind:DMessage['kind'],body:string,key:string,now:Date):Promise<{d:Delegation;ok:boolean;error:string|null}>{
 const r=await deps.sms.send(d.recipient.phone,body,{idempotencyKey:key,statusCallback:deps.statusCallback});
 const m:DMessage={id:newId(),kind,providerId:r.ok?r.providerId:null,provider:r.provider,status:r.ok?r.status:'failed',at:now.toISOString(),deliveredAt:null,error:r.ok?null:r.error,key};
 return {d:{...d,messages:[...d.messages,m]},ok:r.ok,error:r.ok?null:r.error};
}

// ---------- asking ----------
export async function createRequest(store:BearStore,deps:Deps,raw:unknown,now=new Date()){
 const input=createSchema.parse(raw);
 const task=await store.get('tasks',input.taskId);if(!task||task.status!=='open')throw new DelegationError('Bear couldn’t find that task.',404);
 const phone=normalisePhone(input.phone);if(!phone.ok)throw new DelegationError(phone.reason,400);
 const mine=await deps.rows.byOwner(store.userId);
 // The same request sent twice (a double tap, a retry after a dropped connection) is the same request: no second text.
 const same=mine.find(d=>d.idempotencyKey===input.idempotencyKey);if(same)return {delegation:ownerView(same),result:resultOf(same,deps)};
 const busy=mine.find(d=>d.taskId===task.id&&['PENDING_SEND','SENT','ACCEPTED'].includes(d.status));
 if(busy)throw new DelegationError(`You’ve already asked ${busy.recipient.name} about this. Cancel that request first.`,409);
 const profile=await ensureProfile(store);const ownerName=(profile.name||'').trim().split(/\s+/)[0]||'Someone';
 const token=newToken();const at=now.toISOString();
 const message=input.message&&input.message!==DEFAULT_MESSAGE?input.message:null;
 let d:Delegation={id:newId(),rev:0,ownerId:store.userId,ownerName,taskId:task.id,recipient:{name:input.name,phone:phone.e164},
  snapshot:{title:task.title,due:task.dueAt||null,dueTime:task.dueTime||null,message},status:'DRAFT',createdAt:at,sentAt:null,acceptedAt:null,declinedAt:null,completedAt:null,cancelledAt:null,
  expiresAt:at,tokenHashes:[await hashToken(token)],tokenRevokedAt:null,lastRecipientUpdate:null,lastReminderAt:null,nextFollowUpAt:null,remindersOff:false,idempotencyKey:input.idempotencyKey,
  events:[{at,type:'created',from:null,to:'DRAFT',by:'owner'}],messages:[],notices:[],changedSince:false};
 d.expiresAt=expiryFor(d,now);
 d=move(d,'PENDING_SEND','owner',now).d;
 await deps.rows.insert(d);
 await rememberRecipient(store,input.name,phone.e164,now);
 const url=link(deps,token);const text=requestText(d,url);
 if(deps.sms.mode==='none'){await linkTask(store,d);return {delegation:ownerView(d),result:'own_phone' as const,text,smsHref:`sms:${phone.e164}?&body=${encodeURIComponent(text)}`};}
 const sent=await deliver(deps,d,'request',text,`${d.id}:request:1`,now);
 d=move(sent.d,sent.ok?'SENT':'SEND_FAILED',sent.ok?'provider':'system',now,sent.ok?undefined:{error:sent.error}).d;
 d=await save(deps.rows,d);await linkTask(store,d);
 // In test mode only (nothing is texted), the recipient's link comes back so the flow can be tried end to end.
 return {delegation:ownerView(d),result:resultOf(d,deps),...(deps.sms.mode==='mock'?{testLink:url}:{}),...(sent.ok?{}:{error:'Bear couldn’t send that request.'})};
}
const resultOf=(d:Delegation,deps:Deps)=>d.status==='SEND_FAILED'?'failed' as const:d.status==='PENDING_SEND'?'own_phone' as const:deps.sms.mode==='mock'?'mock' as const:'sent' as const;
async function rememberRecipient(store:BearStore,name:string,phone:string,now:Date){
 const p=await ensureProfile(store);const hh=p.household||[];const i=hh.findIndex(h=>h.phone===phone||(!h.phone&&h.name.toLowerCase()===name.toLowerCase()));
 const entry={...(i>=0?hh[i]:{id:newId(),email:null,joined:false}),name,phone,lastUsedAt:now.toISOString()};
 await store.update('profiles',p.id,{household:[entry,...hh.filter((_,j)=>j!==i)].slice(0,30)});
}
// Her task shows who is helping. While someone has it (asked or accepted), it waits on them instead of asking her.
async function linkTask(store:BearStore,d:Delegation){
 const t=await store.get('tasks',d.taskId);if(!t)return;
 const waiting=['PENDING_SEND','SENT','ACCEPTED'].includes(d.status);
 await store.update('tasks',t.id,{delegation:{id:d.id,to:d.recipient.name,status:d.status,at:new Date().toISOString()},readiness:waiting?'waiting':t.readiness==='waiting'?null:t.readiness??null});
}

// ---------- her actions ----------
export const ownerActionSchema=z.object({action:z.enum(['cancel','take_back','retry','sent_myself','seen'])}).strict();
export async function ownerAction(store:BearStore,deps:Deps,id:string,raw:unknown,now=new Date()){
 const {action}=ownerActionSchema.parse(raw);let d=await deps.rows.get(id);if(!d||d.ownerId!==store.userId)throw new DelegationError('Bear couldn’t find that.',404);
 if(action==='seen'){d={...d,notices:d.notices.map(n=>({...n,seen:true}))};d=await save(deps.rows,d);return ownerView(d);}
 if(action==='sent_myself'){
  if(d.status!=='PENDING_SEND'||deps.sms.mode!=='none')throw new DelegationError('That can’t happen now.',409);
  d={...d,messages:[...d.messages,{id:newId(),kind:'request',providerId:null,provider:'own_phone',status:'handed_over',at:now.toISOString(),deliveredAt:null,error:null,key:`${d.id}:own`}]};
  d=move(d,'SENT','owner',now,{via:'own_phone'}).d;d=await save(deps.rows,d);await linkTask(store,d);return ownerView(d);
 }
 if(action==='retry'){
  if(d.status!=='SEND_FAILED')throw new DelegationError('That request isn’t waiting to be resent.',409);
  // A new token for the new text; the old link stops working.
  const token=newToken();d={...move(d,'PENDING_SEND','owner',now).d,tokenHashes:[...d.tokenHashes,await hashToken(token)].slice(-6)};
  const n=d.messages.filter(m=>m.kind==='request').length+1;const sent=await deliver(deps,d,'request',requestText(d,link(deps,token)),`${d.id}:request:${n}`,now);
  d=move(sent.d,sent.ok?'SENT':'SEND_FAILED',sent.ok?'provider':'system',now).d;d=await save(deps.rows,d);await linkTask(store,d);
  if(!sent.ok)throw new DelegationError('Bear couldn’t send that request. Check the number and try again.',502);
  return ownerView(d);
 }
 // Cancel (still asking, or they'd said yes) or take it back (after a no, an "I can't", no answer, or a failed send).
 if(['PENDING_SEND','SENT','ACCEPTED','SEND_FAILED'].includes(d.status))d=move(d,'CANCELLED','owner',now).d;
 d={...d,tokenRevokedAt:d.tokenRevokedAt||now.toISOString()};d=await save(deps.rows,d);
 const t=await store.get('tasks',d.taskId);
 if(t)await store.update('tasks',t.id,{delegation:action==='take_back'?null:{id:d.id,to:d.recipient.name,status:d.status,at:now.toISOString()},readiness:t.readiness==='waiting'?null:t.readiness??null});
 return ownerView(d);
}

// ---------- the recipient ----------
// Every answer comes with the token; it authorises only this request. Opening the page changes nothing.
export async function findByToken(rows:DelegationRows,token:string){if(!TOKEN_RE.test(token))return null;return rows.byTokenHash(await hashToken(token));}
export async function recipientView(rows:DelegationRows,token:string,now=new Date()){return publicView(await findByToken(rows,token),now);}
export const recipientSchema=z.object({action:z.enum(['accept','decline','done','unable','on_track','reminders_off','reminders_on']),confirm:z.boolean().optional()}).strict();
export async function recipientAction(deps:Deps,token:string,raw:unknown,now=new Date()){
 const {action,confirm}=recipientSchema.parse(raw);
 for(let attempt=0;attempt<2;attempt++){
  const found=await findByToken(deps.rows,token);
  if(!found||!linkLive(found,now))throw new DelegationError('This request is no longer active.',410);
  let d=found;
  const to=ACTION_TO[action as RecipientAction];
  if(action==='done'&&!confirm)throw new DelegationError('Please confirm it’s done.',400);
  if(to){
   if(d.status===to)return publicView(d,now);   // the same answer twice changes nothing
   if(action==='decline'&&d.status==='ACCEPTED')throw new DelegationError('You’ve already said yes. If you can’t do it now, choose “I can’t do this anymore”.',409);
   if(action==='accept'&&d.status!=='SENT')throw new DelegationError('This has already been answered.',409);
   d=move(d,to,'recipient',now).d;d={...d,expiresAt:expiryFor(d,now),changedSince:false};
  }else if(action==='on_track'){
   if(d.status!=='ACCEPTED')throw new DelegationError('That can’t happen now.',409);
   d={...d,lastRecipientUpdate:now.toISOString(),events:[...d.events,{at:now.toISOString(),type:'on_track',from:d.status,to:d.status,by:'recipient'}]};
  }else{
   const off=action==='reminders_off';if(d.remindersOff===off)return publicView(d,now);
   d={...d,remindersOff:off,events:[...d.events,{at:now.toISOString(),type:off?'reminders_off':'reminders_on',from:d.status,to:d.status,by:'recipient'}]};
  }
  if(!(await deps.rows.write(d)))continue;   // someone else changed it first: look again and decide again
  d={...d,rev:d.rev+1};
  const t=to?({ACCEPTED:'REQUEST_ACCEPTED',DECLINED:'REQUEST_DECLINED',COMPLETED:'REQUEST_COMPLETED',UNABLE_TO_COMPLETE:'REQUEST_UNABLE_TO_COMPLETE'} as Record<string,NoticeType>)[to]:null;
  if(t&&deps.notify)await deps.notify(d,t).catch(()=>null);
  return publicView(d,now);
 }
 throw new DelegationError('Something changed at the same moment. Please try again.',409);
}

// ---------- keeping her side in step ----------
// Runs when her board or Bear Brain loads. A no, an "I can't" or no answer puts the task back in her own queue with its
// date and importance as they were; a "done" from them completes it (reported by them, not checked by Bear); a task she
// deleted cancels the request; a change she made after they said yes is flagged so she can ask again.
export async function syncOwner(store:BearStore,rows:DelegationRows,complete:(taskId:string,who:string)=>Promise<unknown>,now=new Date()){
 const mine=(await rows.byOwner(store.userId)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));const out:Delegation[]=[];
 for(let d of mine){
  try{
   const t=await store.get('tasks',d.taskId);
   if((!t||t.status==='dropped')&&['PENDING_SEND','SENT','ACCEPTED'].includes(d.status)){d=move(d,'CANCELLED','owner',now,{why:'task_removed'}).d;d={...d,tokenRevokedAt:now.toISOString()};d=await save(rows,d);}
   else if(t){
    if(d.status==='ACCEPTED'&&!d.changedSince&&(t.title!==d.snapshot.title||(t.dueAt||null)!==d.snapshot.due)){d={...d,changedSince:true,events:[...d.events,{at:now.toISOString(),type:'owner_changed_task',from:d.status,to:d.status,by:'owner'}]};d=await save(rows,d);}
    if(t.delegation?.id===d.id&&t.delegation.status!==d.status){
     if(d.status==='COMPLETED'&&t.status==='open'){await complete(t.id,d.recipient.name).catch(()=>null);}
     const waiting=['PENDING_SEND','SENT','ACCEPTED'].includes(d.status);
     await store.update('tasks',t.id,{delegation:{...t.delegation,status:d.status,at:now.toISOString()},readiness:waiting?'waiting':t.readiness==='waiting'?null:t.readiness??null});
    }
   }
  }catch{/* one record never stops the rest */}
  out.push(d);
 }
 return out;
}
export function noticesFor(list:Delegation[]){return list.flatMap(d=>d.notices.filter(n=>!n.seen).map(n=>({id:n.id,delegationId:d.id,taskId:d.taskId,type:n.type,...noticeText(d,n.type)})));}

// ---------- follow-up ----------
// Called on the reminder schedule. Each delegation gets at most what followUpFor allows; texts are keyed so a repeated run
// never sends twice; a failed text is recorded and not retried endlessly.
export async function runFollowUps(deps:Deps,now=new Date()){
 const done={reminders:0,expired:0,atRisk:0,failed:0};
 for(const orig of await deps.rows.active()){
  try{
   let d=orig;const f=followUpFor(d,now);if(!f)continue;
   if(f.kind==='expire'){d=move(d,'EXPIRED','system',now).d;d=await save(deps.rows,d);done.expired++;if(deps.notify)await deps.notify(d,'REQUEST_EXPIRED').catch(()=>null);continue;}
   if(f.kind==='at_risk'){d={...d,notices:[...d.notices,{id:`DEADLINE_AT_RISK-${d.id.slice(0,8)}`,type:'DEADLINE_AT_RISK',at:now.toISOString(),seen:false}],events:[...d.events,{at:now.toISOString(),type:'at_risk',from:d.status,to:d.status,by:'system'}]};d=await save(deps.rows,d);done.atRisk++;if(deps.notify)await deps.notify(d,'DEADLINE_AT_RISK').catch(()=>null);continue;}
   if(deps.sms.mode==='none')continue;
   // A new link for the reminder (only hashes are kept, so the first link can't be resent); the first one still works.
   const token=newToken();const h=await hashToken(token);
   const sent=await deliver(deps,d,f.kind,reminderText(d,link(deps,token),f.kind),`${d.id}:${f.kind}`,now);
   d={...sent.d,lastReminderAt:now.toISOString(),events:[...sent.d.events,{at:now.toISOString(),type:'reminder',from:d.status,to:d.status,by:'system',meta:{kind:f.kind,ok:sent.ok}}]};
   if(sent.ok)d={...d,tokenHashes:[...d.tokenHashes,h].slice(-6)};
   await save(deps.rows,d);if(sent.ok)done.reminders++;else done.failed++;
  }catch{done.failed++;}
 }
 return done;
}
// Delivery reports from the text provider: recorded against the message; a report that arrives late never moves a
// delegation backwards, and a failed first text marks the request as not sent (she is told).
export async function deliveryReport(deps:Deps,providerId:string,status:string,errorCode:string|null,now=new Date()){
 const d0=await deps.rows.byProviderMessage(providerId);if(!d0)return false;
 const order=['accepted','queued','sent','delivered','undelivered','failed'];
 let d={...d0,messages:d0.messages.map(m=>{if(m.providerId!==providerId)return m;const s=status as DMessage['status'];if(!order.includes(s)||order.indexOf(s)<=order.indexOf(m.status))return m;return {...m,status:s,deliveredAt:s==='delivered'?now.toISOString():m.deliveredAt,error:['failed','undelivered'].includes(s)?errorCode||s:m.error};})};
 const req=d.messages.find(m=>m.providerId===providerId);
 if(req?.kind==='request'&&['failed','undelivered'].includes(req.status)&&d.status==='SENT'){d=move(d,'CANCELLED','provider',now,{why:'not_delivered'}).d;d={...d,notices:[...d.notices,{id:`REQUEST_SEND_FAILED-${d.id.slice(0,8)}`,type:'REQUEST_SEND_FAILED',at:now.toISOString(),seen:false}]};if(deps.notify)await deps.notify(d,'REQUEST_SEND_FAILED').catch(()=>null);}
 await save(deps.rows,d);return true;
}
export type {Task};
