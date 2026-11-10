import {createHash} from 'node:crypto';
import {stamp,type BearStore} from '../store/store.ts';
import {capability,performAction,type ActionCapability,type ActionOutcome,type ActionType,type IntegrationAdapter,type IntegrationGrants,type IntegrationResult} from './actions.ts';
import {approvalStatus,executionStatus} from './execution-summary.ts';
import type {ResponsibilityEvent} from './types.ts';

// The execution layer. AI proposes; this layer decides whether an action may run. Rules:
//  1. Anything outside Bear (money, messages, forms, bookings) needs the person's approval of THE EXACT action.
//     The approval is bound to a hash of the details (recipient, amount, document, destination). Change any
//     detail and the key changes, so the old approval no longer applies and a fresh one is needed.
//  2. The log is a hard dependency here (unlike the app's general history): if the approval or the attempt
//     can't be recorded, nothing is executed.
//  3. An action never runs twice for the same key. If a previous attempt may have succeeded (timeout, crash),
//     Bear checks first; if it can't tell, it stops and asks the person.
//  4. "Accepted" is not "confirmed". Only evidence confirms.
export interface ActionRequest{responsibilityId:string;actionType:ActionType;details:Record<string,unknown>}
export interface ExecAdapter extends IntegrationAdapter{
 idempotent?:boolean;   // the provider dedupes by the key we send (e.g. Graph transactionId): a retry after a lost reply cannot do it twice
 perform(t:ActionType,input:Record<string,unknown>):Promise<IntegrationResult>;                       // gets idempotencyKey in input
 verify?(reference:string,t:ActionType):Promise<{confirmed:boolean}>;                                // does the provider confirm it?
 check?(key:string,t:ActionType,details:Record<string,unknown>):Promise<{happened:boolean|'unknown';reference?:string|null}>; // did an earlier attempt land?
}
export const APPROVAL_TTL_MS=7*24*3600*1000;
export const MAX_ATTEMPTS=3;
const canon=(v:unknown):string=>v===null||typeof v!=='object'?JSON.stringify(v)??'null':Array.isArray(v)?`[${v.map(canon).join(',')}]`:`{${Object.keys(v as object).sort().map(k=>JSON.stringify(k)+':'+canon((v as Record<string,unknown>)[k])).join(',')}}`;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
export const detailsHash=(d:Record<string,unknown>)=>sha(canon(d));
export const idempotencyKey=(r:ActionRequest)=>sha(`${r.responsibilityId}|${r.actionType}|${detailsHash(r.details)}`);

async function log(store:BearStore,id:string):Promise<ResponsibilityEvent[]>{
 return store.list('responsibility_events',{where:[{column:'responsibility_id',value:id}],orderBy:{column:'created_at',ascending:true}});   // throws if it can't read: on purpose
}
async function record(store:BearStore,id:string,eventType:ResponsibilityEvent['eventType'],actor:ResponsibilityEvent['actor'],metadata:Record<string,string|number|boolean|null>,now:Date){
 return store.insert('responsibility_events',stamp<ResponsibilityEvent>(store.userId,{responsibilityId:id,eventType,actor,at:now.toISOString(),metadata}));   // throws on failure: on purpose
}

// ---- approval ----
export async function requestApproval(store:BearStore,r:ActionRequest,now=new Date()){
 const key=idempotencyKey(r);const expiresAt=new Date(now.getTime()+APPROVAL_TTL_MS).toISOString();
 await record(store,r.responsibilityId,'approval_requested','system',{key,actionType:r.actionType,detailsHash:detailsHash(r.details),expiresAt},now);
 return {key,expiresAt,actionType:r.actionType,details:r.details};   // the details are shown to the person, never stored in the log
}
export async function decideApproval(store:BearStore,r:ActionRequest,decision:'grant'|'decline'|'revoke',now=new Date()):Promise<{ok:true}|{ok:false;reason:'not_requested'|'expired'|'already_decided'}>{
 const key=idempotencyKey(r);const st=approvalStatus(await log(store,r.responsibilityId),key,now);
 // If any detail changed, the key is different and there is no request for it: a fresh approval is needed.
 if(st==='none')return {ok:false,reason:'not_requested'};
 if(decision==='revoke'){if(st!=='granted')return {ok:false,reason:'already_decided'};await record(store,r.responsibilityId,'approval_revoked','user',{key},now);return {ok:true};}
 if(st==='expired')return {ok:false,reason:'expired'};
 if(st!=='requested')return {ok:false,reason:'already_decided'};
 await record(store,r.responsibilityId,decision==='grant'?'approval_granted':'approval_declined','user',{key,detailsHash:detailsHash(r.details)},now);
 return {ok:true};
}

// ---- execution ----
export type ExecOutcome=ActionOutcome
 |{status:'accepted';userMessage:string;reference:string|null}                      // the provider took it; not yet confirmed
 |{status:'already_done';userMessage:string;reference:string|null}                   // this exact action was already done: not repeated
 |{status:'unknown_outcome';userMessage:string}                                      // may have happened: not repeated, ask the person
 |{status:'retry_not_safe';userMessage:string}
 |{status:'cannot_record';userMessage:string};
// capabilityOf is a seam for tests only: production never passes it and always uses the capability truth table.
export interface ExecOptions{capabilityOf?:(t:ActionType)=>ActionCapability;adapter?:ExecAdapter|null;env?:Record<string,string|undefined>;grants?:IntegrationGrants;now?:Date;timeoutMs?:number}
const withTimeout=<T>(p:Promise<T>,ms:number)=>Promise.race([p,new Promise<never>((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms))]);

export async function executeAction(store:BearStore,r:ActionRequest,o:ExecOptions={}):Promise<ExecOutcome>{
 const now=o.now||new Date();const cap=(o.capabilityOf||((t:ActionType)=>capability(t,o.env,o.grants)))(r.actionType);
 // Safe internal actions (draft, plan, reminder) never reach the outside world.
 if(cap.category==='A'){const out=await performAction(r.actionType,r.details,{env:o.env,grants:o.grants});return out;}
 if(!cap.available)return performAction(r.actionType,r.details,{env:o.env,grants:o.grants});   // says exactly what's missing and the manual handoff
 const key=idempotencyKey(r);let events:ResponsibilityEvent[];
 try{events=await log(store,r.responsibilityId);}catch{return {status:'cannot_record',userMessage:'I couldn’t record that safely, so I haven’t done it.'};}
 const approval=approvalStatus(events,key,now);
 if(approval!=='granted')return {status:'needs_approval',userMessage:approval==='expired'?'That approval has run out. Want me to go ahead?':approval==='declined'||approval==='revoked'?'You said not to, so I haven’t.':'Want me to go ahead?'};
 const x=executionStatus(events,key);
 if(x.status==='confirmed'||x.status==='accepted'){return {status:'already_done',userMessage:'That’s already done. I haven’t repeated it.',reference:null};}
 if(!o.adapter)return {status:'failed',userMessage:'That didn’t go through. Nothing was done.',error:'no_adapter'};
 // A previous attempt may have landed (timeout or crash): find out before doing anything.
 if(x.status==='started'||x.status==='unknown'){
  const probe=o.adapter.check?await o.adapter.check(key,r.actionType,r.details).catch(()=>({happened:'unknown' as const})):{happened:'unknown' as const};
  if(probe.happened===true){await record(store,r.responsibilityId,'execution_accepted','integration',{key,recovered:true,referenceKind:probe.reference?'provider':null},now);return {status:'already_done',userMessage:'That had already gone through. I haven’t repeated it.',reference:probe.reference||null};}
  if(probe.happened==='unknown'&&!o.adapter.idempotent){await record(store,r.responsibilityId,'execution_unknown','system',{key},now).catch(()=>null);return {status:'unknown_outcome',userMessage:'I can’t tell whether that went through, so I haven’t tried again. Please check, then tell me.'};}
  // idempotent provider: trying again with the same key cannot create a second one, so it is safe to proceed.
 }
 if(x.status==='failed'&&!x.retrySafe)return {status:'retry_not_safe',userMessage:'That failed in a way where trying again might do it twice, so I’ve stopped. Over to you.'};
 if(x.attempts>=MAX_ATTEMPTS)return {status:'retry_not_safe',userMessage:'I’ve tried a few times. Over to you.'};
 try{await record(store,r.responsibilityId,'execution_started','system',{key,attempt:x.attempts+1,actionType:r.actionType},now);}catch{return {status:'cannot_record',userMessage:'I couldn’t record that safely, so I haven’t done it.'};}
 let res:IntegrationResult;
 try{res=await withTimeout(o.adapter.perform(r.actionType,{...r.details,idempotencyKey:key}),o.timeoutMs??15000);}
 catch(e){await record(store,r.responsibilityId,'execution_unknown','system',{key,reason:(e as Error).message==='timeout'?'timeout':'error'},now).catch(()=>null);
  return {status:'unknown_outcome',userMessage:o.adapter.idempotent?'That didn’t come back, so I’m not sure it went through. It’s safe to try again: it can’t be added twice.':'I can’t tell whether that went through, so I haven’t tried again. Please check, then tell me.'};}
 if(!res.ok){await record(store,r.responsibilityId,'action_failed','integration',{key,retrySafe:res.retrySafe===true,reason:res.error||'integration_error'},now).catch(()=>null);
  return {status:'failed',userMessage:'That didn’t go through. Nothing was done.',error:res.error||'integration_error'};}
 await record(store,r.responsibilityId,'execution_accepted','integration',{key,referenceKind:res.reference?'provider':null},now).catch(()=>null);
 // Accepted is not confirmed. Ask the provider; otherwise wait for evidence.
 if(cap.supportsVerification&&res.reference&&o.adapter.verify){
  const v=await o.adapter.verify(res.reference,r.actionType).catch(()=>({confirmed:false}));
  if(v.confirmed){await record(store,r.responsibilityId,'execution_confirmed','integration',{key,method:'integration'},now).catch(()=>null);return {status:'done',userMessage:'Done. I’ve got a confirmation.',reference:res.reference,verified:true};}
 }
 return {status:'accepted',userMessage:'Sent. I’m waiting for confirmation.',reference:res.reference||null};
}
// Evidence arrived later (a forwarded confirmation, a receipt the person showed Bear, or the person saying so).
export async function confirmExecution(store:BearStore,r:ActionRequest,method:'integration'|'forwarded_email'|'document'|'user_confirmation',now=new Date()){
 const key=idempotencyKey(r);const events=await log(store,r.responsibilityId);
 const x=executionStatus(events,key);if(x.status==='confirmed')return {ok:true as const,already:true};
 if(x.status==='none'||x.status==='failed')return {ok:false as const,reason:'nothing_to_confirm' as const};   // a known failure can't be confirmed
 await record(store,r.responsibilityId,'execution_confirmed',method==='integration'?'integration':'user',{key,method},now);return {ok:true as const,already:false};
}
