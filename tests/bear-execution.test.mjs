// Execution layer: approvals bound to the exact action, idempotency, the log as a hard dependency, recovery,
// and "accepted is not confirmed". The adapter is a TEST double that behaves like a fallible service;
// no production code fakes an integration (all outward actions are NOT_SUPPORTED in production).
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {executeAction,requestApproval,decideApproval,confirmExecution,idempotencyKey,detailsHash,APPROVAL_TTL_MS,MAX_ATTEMPTS} from '../lib/bear/engine/execution.ts';
import {executionStatus,approvalStatus,summariseExecution,STUCK_MS} from '../lib/bear/engine/execution-summary.ts';
import {checkTransition,stateOf,stateWords,canTransition} from '../lib/bear/engine/state.ts';
import {responsibilityStates} from '../lib/bear/engine/types.ts';

const USER='15151515-1515-4151-8151-151515151515',RID='aaaaaaaa-1515-4151-8151-aaaaaaaaaaaa';
const NOW=new Date('2026-11-10T09:00:00Z');
const REQ={responsibilityId:RID,actionType:'send_message',details:{to:'office@school.example',subject:'Camp permission',body:'Consent given',attachment:'form.pdf'}};
const AVAILABLE=(t)=>({actionType:t,category:'B',available:true,state:'AVAILABLE',integrationRequired:true,requiresUserApproval:true,riskLevel:'medium',supportsVerification:true,needs:'contact_external'});
const store=()=>new MemoryBackend().for(USER);
const history=(s)=>s.list('responsibility_events',{where:[{column:'responsibility_id',value:RID}],orderBy:{column:'created_at',ascending:true}});
// A service that can accept, fail (before or after sending), time out, and confirm.
function adapter(o={}){const calls=[];const a={calls,
 async perform(t,input){calls.push({t,input});if(o.throw)throw new Error(o.throw);if(o.hang)await new Promise(()=>{});return o.result||{ok:true,reference:'ref-'+calls.length};},
 ...(o.verify===undefined?{}:{async verify(){return {confirmed:o.verify};}}),...(o.check?{async check(){return o.check;}}:{})};return a;}
async function approved(s,req=REQ){await requestApproval(s,req,NOW);assert.deepEqual(await decideApproval(s,req,'grant',NOW),{ok:true});}

test('nothing outside Bear runs without approval of that exact action',async()=>{
 const s=store(),a=adapter();
 const out=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});
 assert.equal(out.status,'needs_approval');assert.equal(a.calls.length,0);
 await requestApproval(s,REQ,NOW);
 assert.equal((await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW})).status,'needs_approval','requested is not granted');assert.equal(a.calls.length,0);
});
test('approval is bound to the exact details: change the recipient, the amount or the document and a fresh approval is needed',async()=>{
 const s=store(),a=adapter();await approved(s);
 for(const changed of [{...REQ.details,to:'someone-else@evil.example'},{...REQ.details,attachment:'other.pdf'},{...REQ.details,body:'Different'}]){
  const req={...REQ,details:changed};
  assert.notEqual(idempotencyKey(req),idempotencyKey(REQ));
  assert.deepEqual(await decideApproval(s,req,'grant',NOW),{ok:false,reason:'not_requested'},'can’t grant what was never shown');
  assert.equal((await executeAction(s,req,{adapter:a,capabilityOf:AVAILABLE,now:NOW})).status,'needs_approval');
 }
 assert.equal(a.calls.length,0);
 assert.equal(detailsHash({b:1,a:{d:2,c:3}}),detailsHash({a:{c:3,d:2},b:1}),'key order never changes the hash');
});
test('approved action runs once; accepted is not confirmed; the provider’s confirmation completes it',async()=>{
 const s=store(),a=adapter({verify:false});await approved(s);
 const out=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});
 assert.equal(out.status,'accepted');assert.match(out.userMessage,/waiting for confirmation/);
 assert.equal(a.calls[0].input.idempotencyKey,idempotencyKey(REQ),'the provider gets the key, so it can dedupe too');
 const ev=await history(s);assert.equal(executionStatus(ev,idempotencyKey(REQ)).status,'accepted');
 assert.equal(summariseExecution(ev,NOW),'awaiting_confirmation');
 assert.deepEqual(await confirmExecution(s,REQ,'forwarded_email',NOW),{ok:true,already:false});
 assert.equal(executionStatus(await history(s),idempotencyKey(REQ)).status,'confirmed');assert.equal(summariseExecution(await history(s),NOW),null);
 const s2=store(),b=adapter({verify:true});await approved(s2);const done=await executeAction(s2,REQ,{adapter:b,capabilityOf:AVAILABLE,now:NOW});assert.deepEqual([done.status,done.verified],['done',true]);
});
test('never twice: the same approved action is not repeated',async()=>{
 const s=store(),a=adapter();await approved(s);
 await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});
 const again=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});
 assert.equal(again.status,'already_done');assert.equal(a.calls.length,1);
});
test('a timeout means “don’t know”, never “failed, try again”',async()=>{
 const s=store(),a=adapter({hang:true});await approved(s);
 const out=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW,timeoutMs:20});
 assert.equal(out.status,'unknown_outcome');assert.equal(a.calls.length,1);
 // Bear can't tell: it does NOT retry (a payment must never be sent twice because a request timed out).
 const again=await executeAction(s,REQ,{adapter:adapter(),capabilityOf:AVAILABLE,now:NOW});assert.equal(again.status,'unknown_outcome');
 assert.equal(summariseExecution(await history(s),NOW),'failed','shown as needing the person, never as done');
 // If the provider can say it landed, record that and still don't repeat it.
 const c=adapter({check:{happened:true,reference:'R1'}});const r=await executeAction(s,REQ,{adapter:c,capabilityOf:AVAILABLE,now:NOW});assert.equal(r.status,'already_done');assert.equal(c.calls.length,0);
});
test('if the provider confirms it did NOT happen, the retry is safe',async()=>{
 const s=store(),a=adapter({hang:true});await approved(s);await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW,timeoutMs:20});
 const c=adapter({check:{happened:false}});const r=await executeAction(s,REQ,{adapter:c,capabilityOf:AVAILABLE,now:NOW});
 assert.equal(r.status,'accepted');assert.equal(c.calls.length,1);
});
test('failures: only a failure known to be before sending can be retried',async()=>{
 const s=store();await approved(s);
 const safe=adapter({result:{ok:false,error:'validation',retrySafe:true}});
 assert.equal((await executeAction(s,REQ,{adapter:safe,capabilityOf:AVAILABLE,now:NOW})).status,'failed');
 const ok=adapter();assert.equal((await executeAction(s,REQ,{adapter:ok,capabilityOf:AVAILABLE,now:NOW})).status,'accepted','retry after a safe failure works');
 const s2=store();await approved(s2);const risky=adapter({result:{ok:false,error:'gateway'}});await executeAction(s2,REQ,{adapter:risky,capabilityOf:AVAILABLE,now:NOW});
 const next=adapter();const out=await executeAction(s2,REQ,{adapter:next,capabilityOf:AVAILABLE,now:NOW});assert.equal(out.status,'retry_not_safe');assert.equal(next.calls.length,0);
 // And never more than MAX_ATTEMPTS.
 const s3=store();await approved(s3);const flaky=adapter({result:{ok:false,error:'v',retrySafe:true}});
 for(let i=0;i<MAX_ATTEMPTS+2;i++)await executeAction(s3,REQ,{adapter:flaky,capabilityOf:AVAILABLE,now:NOW});assert.equal(flaky.calls.length,MAX_ATTEMPTS);
});
test('the log is a hard dependency: if the attempt can’t be recorded, nothing is done',async()=>{
 const s=store();await approved(s);const a=adapter();
 const insert=s.insert.bind(s);s.insert=(t,row)=>t==='responsibility_events'&&row.eventType==='execution_started'?Promise.reject(new Error('db down')):insert(t,row);
 const out=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});assert.equal(out.status,'cannot_record');assert.equal(a.calls.length,0);
 const noTable=store();noTable.list=(t,q)=>t==='responsibility_events'?Promise.reject(new Error('relation does not exist')):MemoryBackend.prototype.list.call(noTable,t,q);
 assert.equal((await executeAction(noTable,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW})).status,'cannot_record','migration not applied: refuses rather than acting unrecorded');
});
test('approvals expire, can be declined, and can be revoked',async()=>{
 const s=store(),a=adapter();await approved(s);
 const later=new Date(NOW.getTime()+APPROVAL_TTL_MS+1000);
 assert.equal(approvalStatus(await history(s),idempotencyKey(REQ),later),'expired');
 const out=await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:later});assert.equal(out.status,'needs_approval');assert.match(out.userMessage,/run out/);assert.equal(a.calls.length,0);
 assert.deepEqual(await decideApproval(s,REQ,'revoke',NOW),{ok:true});
 assert.match((await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW})).userMessage,/said not to/);
 const d=store();await requestApproval(d,REQ,NOW);await decideApproval(d,REQ,'decline',NOW);assert.equal((await executeAction(d,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW})).status,'needs_approval');assert.equal(a.calls.length,0);
 assert.deepEqual(await decideApproval(d,REQ,'grant',NOW),{ok:false,reason:'already_decided'});
});
test('in production nothing outward is available: it says what’s missing and the manual handoff, and never pretends',async()=>{
 const s=store();await approved(s);
 const pay=await executeAction(s,{responsibilityId:RID,actionType:'make_payment',details:{amount:18000}},{adapter:adapter(),now:NOW});
 assert.equal(pay.status,'not_available');assert.match(pay.alternative,/pay in a minute/);
 const send=await executeAction(s,REQ,{adapter:adapter(),now:NOW});assert.equal(send.status,'not_available');
 const draft=await executeAction(s,{responsibilityId:RID,actionType:'draft_message',details:{draft:'Hi'}},{now:NOW});assert.equal(draft.status,'prepared','safe internal actions need no approval');
});
test('execution states: reachable, plain words, never straight to done',()=>{
 for(const st of ['awaiting_approval','executing','awaiting_confirmation','failed','blocked']){assert.ok(responsibilityStates.includes(st));assert.doesNotMatch(stateWords[st],/_|state|verified/i);assert.ok(canTransition('ready',st));assert.ok(!canTransition(st,'closed'),st+' can’t close');}
 assert.deepEqual(checkTransition('awaiting_confirmation','verified',null),{ok:false,reason:'verification_needs_evidence'});
 assert.deepEqual(checkTransition('awaiting_confirmation','verified','integration'),{ok:true});
 const task={id:'t',status:'open',title:'x',load:null};
 assert.equal(stateOf(task,null,'2026-11-10','awaiting_approval'),'awaiting_approval');assert.equal(stateOf({...task,status:'done'},null,'2026-11-10','failed'),'completed_unverified','a finished task isn’t pulled back by an old log');
});
test('a start with no outcome for a long time is treated as stuck, not “still going”',async()=>{
 const s=store();await approved(s);const a=adapter({hang:true});
 const insert=s.insert.bind(s);s.insert=(t,row)=>t==='responsibility_events'&&row.eventType==='execution_unknown'?Promise.reject(new Error('crashed')):insert(t,row);
 await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW,timeoutMs:10});
 const ev=await history(s);assert.equal(summariseExecution(ev,NOW),'executing');
 assert.equal(summariseExecution(ev,new Date(NOW.getTime()+STUCK_MS+1000)),'failed');
});
test('the log holds keys and kinds, never the recipient, the amount or the message',async()=>{
 const s=store(),a=adapter({verify:true});await approved(s);await executeAction(s,REQ,{adapter:a,capabilityOf:AVAILABLE,now:NOW});
 const blob=JSON.stringify(await history(s));for(const leak of ['office@school','Camp permission','Consent given','form.pdf','ref-1'])assert.ok(!blob.includes(leak),leak);
});
