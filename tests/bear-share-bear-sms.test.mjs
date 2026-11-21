// Share Bear by text: numbers, the state machine, links and what they reveal, the full ask/answer/finish journey with the
// mock text provider, her side kept in step, follow-up timing, delivery reports, the Twilio adapter and its signatures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {addOne} from '../lib/bear/board/service.ts';
import {normalisePhone,canMove,move,followUpFor,expiryFor,publicView,noticeText,hashToken,TOKEN_RE,newToken} from '../lib/bear/sharebear/core.ts';
import {memoryDelegations} from '../lib/bear/sharebear/rows.ts';
import {mockSms,mockOutbox,twilioSms,twilioSignatureOk,noSms} from '../lib/bear/sharebear/sms.ts';
import {createRequest,recipientAction,recipientView,ownerAction,syncOwner,runFollowUps,deliveryReport,noticesFor} from '../lib/bear/sharebear/service.ts';

const backend=new MemoryBackend();let n=0;
async function lucia(){const s=backend.for(`e0e0e0e0-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Lucia Rossi',areas:['family'],onboardingComplete:true});return s;}
async function cakeTask(s,due='2026-11-20'){const t=await addOne(s,{title:'Pick up Ella’s birthday cake',listId:null});return s.update('tasks',t.id,{dueAt:due,dueTime:'3:00 pm',notes:'PRIVATE: surprise party, code 4471'});}
const tokenFrom=body=>body.match(/\/bear\/r\/([A-Za-z0-9_-]{43})/)[1];
const deps=(extra={})=>({rows:memoryDelegations(),sms:mockSms(),baseUrl:'https://bear.example',notify:async()=>{},...extra});
const THU=new Date('2026-11-19T10:00:00+11:00');

test('phone numbers: Australian mobiles normalise to E.164; anything else is refused before a text could go',()=>{
 for(const raw of ['0412 345 678','0412345678','+61 412 345 678','61412345678','(04) 1234 5678','0061412345678'])assert.deepEqual(normalisePhone(raw),{ok:true,e164:'+61412345678',display:'0412 345 678'},raw);
 for(const raw of ['','02 9876 5432','0412 345','hello','0412-345-6789','+61 2 9876 5432'])assert.equal(normalisePhone(raw).ok,false,raw);
 assert.deepEqual(normalisePhone('+64 21 123 4567'),{ok:true,e164:'+64211234567',display:'+64211234567'},'international, given in full');
});
test('the state machine: only the allowed moves; the same move twice changes nothing; every move is recorded',()=>{
 assert.ok(canMove('SENT','ACCEPTED')&&canMove('ACCEPTED','COMPLETED')&&canMove('PENDING_SEND','SEND_FAILED'));
 for(const [a,b] of [['SENT','COMPLETED'],['DECLINED','ACCEPTED'],['COMPLETED','ACCEPTED'],['ACCEPTED','DECLINED'],['EXPIRED','ACCEPTED'],['CANCELLED','SENT']])assert.ok(!canMove(a,b),`${a}->${b}`);
 const d={id:'x'.repeat(36),status:'SENT',events:[],notices:[],snapshot:{title:'T',due:null,dueTime:null,message:null},recipient:{name:'Daniel',phone:'+61412345678'}};
 const a=move(d,'ACCEPTED','recipient',THU);assert.ok(a.changed);assert.equal(a.d.events.length,1);assert.equal(a.d.notices[0].type,'REQUEST_ACCEPTED');
 assert.equal(move(a.d,'ACCEPTED','recipient',THU).changed,false);
 assert.throws(()=>move(a.d,'DECLINED','recipient',THU),/can’t happen now/);
 assert.equal(noticeText(a.d,'REQUEST_ACCEPTED').title,'Daniel’s got this!');
});
test('the whole journey: ask, text sent (mock), page opened (nothing changes), accept, she hears, done (confirmed), task completed',async()=>{
 const s=await lucia();const t=await cakeTask(s);const D=deps();const before=mockOutbox().length;const told=[];D.notify=async(d,ty)=>told.push(ty);
 const r=await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412 345 678',message:null,idempotencyKey:'key-0000001'},THU);
 assert.equal(r.result,'mock');assert.equal(r.delegation.status,'SENT');assert.equal(mockOutbox().length,before+1);
 const sms=mockOutbox().at(-1);assert.equal(sms.to,'+61412345678');
 assert.match(sms.body,/^🐻 Lucia wants your help with this:\nPick up Ella’s birthday cake by Friday 20 November, 3:00 pm\.\nCan you take care of it\?\nAccept or decline:\nhttps:\/\/bear\.example\/bear\/r\/[A-Za-z0-9_-]{43}$/);
 assert.ok(!/4471|surprise|PRIVATE|e0e0e0e0|[0-9a-f]{8}-[0-9a-f]{4}/.test(sms.body),'no notes, no ids');
 const token=tokenFrom(sms.body);
 const view=await recipientView(D.rows,token,THU);assert.equal(view.status,'SENT','opening the page changes nothing');
 assert.deepEqual(Object.keys(view).sort(),['changedSince','due','dueTime','message','ownerName','recipientName','remindersOff','state','status','title'].sort());
 assert.ok(!JSON.stringify(view).includes('4471'));
 // Her task waits on Daniel now (and the same request again sends nothing new).
 assert.equal((await s.get('tasks',t.id)).readiness,'waiting');
 const again=await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412 345 678',message:null,idempotencyKey:'key-0000001'},THU);assert.equal(again.delegation.id,r.delegation.id);assert.equal(mockOutbox().length,before+1);
 await assert.rejects(()=>createRequest(s,D,{taskId:t.id,name:'Mum',phone:'0433 111 222',message:null,idempotencyKey:'key-0000002'},THU),/already asked Daniel/);
 assert.equal((await recipientAction(D,token,{action:'accept'},THU)).status,'ACCEPTED');
 assert.equal((await recipientAction(D,token,{action:'accept'},THU)).status,'ACCEPTED','accepting twice is fine');
 await assert.rejects(()=>recipientAction(D,token,{action:'decline'},THU),/already said yes/);
 await assert.rejects(()=>recipientAction(D,token,{action:'done'},THU),/confirm/,'done needs a confirmation');
 let list=await syncOwner(s,D.rows,async()=>{},THU);assert.equal(noticesFor(list)[0].title,'Daniel’s got this!');
 assert.equal((await s.get('tasks',t.id)).delegation.status,'ACCEPTED');assert.equal((await s.get('tasks',t.id)).status,'open','delegation is not completion');
 assert.equal((await recipientAction(D,token,{action:'done',confirm:true},THU)).status,'COMPLETED');
 const completed=[];list=await syncOwner(s,D.rows,async(id,who)=>completed.push([id,who]),THU);
 assert.deepEqual(completed,[[t.id,'Daniel']]);assert.deepEqual(told,['REQUEST_ACCEPTED','REQUEST_COMPLETED']);
 assert.ok(noticesFor(list).some(x=>x.title==='All taken care of!'));
 await ownerAction(s,D,r.delegation.id,{action:'seen'},THU);assert.equal(noticesFor(await syncOwner(s,D.rows,async()=>{},THU)).length,0);
});
test('declining: back in her queue with its date as it was; "Ask someone else" is hers to choose, nothing is sent automatically',async()=>{
 const s=await lucia();const t=await cakeTask(s);const D=deps();
 await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412345678',message:'Could you grab it on the way home?',idempotencyKey:'key-dec00001'},THU);
 const token=tokenFrom(mockOutbox().at(-1).body);assert.match(mockOutbox().at(-1).body,/“Could you grab it on the way home\?”/);
 const sends=mockOutbox().length;
 assert.equal((await recipientAction(D,token,{action:'decline'},THU)).status,'DECLINED');
 await syncOwner(s,D.rows,async()=>{},THU);const task=await s.get('tasks',t.id);
 assert.equal(task.readiness,null);assert.equal(task.dueAt,'2026-11-20');assert.equal(task.delegation.status,'DECLINED');assert.equal(mockOutbox().length,sends,'nothing sent to anyone else');
 await assert.rejects(()=>recipientAction(D,token,{action:'accept'},THU),/already been answered/);
});
test('links: a bad or unknown token shows nothing; cancelled or expired requests show nothing; another person can’t act on hers',async()=>{
 const s=await lucia();const other=await lucia();const t=await cakeTask(s);const D=deps();
 const r=await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-lnk00001'},THU);const token=tokenFrom(mockOutbox().at(-1).body);
 assert.deepEqual(await recipientView(D.rows,'short',THU),{state:'gone'});assert.deepEqual(await recipientView(D.rows,newToken(),THU),{state:'gone'});
 assert.ok(TOKEN_RE.test(token));assert.notEqual((await D.rows.get(r.delegation.id)).tokenHashes[0],token,'only the hash is stored');
 await assert.rejects(()=>ownerAction(other,D,r.delegation.id,{action:'cancel'},THU),/couldn’t find/);
 assert.deepEqual(await recipientView(D.rows,token,new Date('2026-12-31T00:00:00Z')),{state:'gone'},'expired');
 await ownerAction(s,D,r.delegation.id,{action:'cancel'},THU);
 assert.deepEqual(await recipientView(D.rows,token,THU),{state:'gone'});await assert.rejects(()=>recipientAction(D,token,{action:'accept'},THU),/no longer active/);
 assert.equal((await s.get('tasks',t.id)).readiness,null);
});
test('her changes: deleting the task cancels the request; changing it after a yes is flagged so she can ask again',async()=>{
 const s=await lucia();const D=deps();
 const t1=await cakeTask(s);await createRequest(s,D,{taskId:t1.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-chg00001'},THU);const tok1=tokenFrom(mockOutbox().at(-1).body);
 await s.update('tasks',t1.id,{status:'dropped'});await syncOwner(s,D.rows,async()=>{},THU);assert.deepEqual(await recipientView(D.rows,tok1,THU),{state:'gone'});
 const t2=await cakeTask(s);await createRequest(s,D,{taskId:t2.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-chg00002'},THU);const tok2=tokenFrom(mockOutbox().at(-1).body);
 await recipientAction(D,tok2,{action:'accept'},THU);await s.update('tasks',t2.id,{dueAt:'2026-11-19'});
 const list=await syncOwner(s,D.rows,async()=>{},THU);assert.equal(list.find(d=>d.taskId===t2.id).changedSince,true);
 assert.equal((await recipientView(D.rows,tok2,THU)).title,'Pick up Ella’s birthday cake','Daniel still sees what he agreed to');
});
test('sending fails: shown as not sent, she can try again (a new link, the same text), and nothing pretends to be sent',async()=>{
 const s=await lucia();const t=await cakeTask(s);let fail=true;const D=deps({sms:mockSms(()=>fail)});
 const r=await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-fail0001'},THU);
 assert.equal(r.result,'failed');assert.equal(r.delegation.status,'SEND_FAILED');assert.equal((await s.get('tasks',t.id)).readiness,null);
 fail=false;const again=await ownerAction(s,D,r.delegation.id,{action:'retry'},THU);assert.equal(again.status,'SENT');
 // No provider at all (production without credentials): nothing is sent; she sends it from her phone and says so.
 const s2=await lucia();const t2=await cakeTask(s2);const N=deps({sms:noSms()});
 const own=await createRequest(s2,N,{taskId:t2.id,name:'Mum',phone:'0433 111 222',message:null,idempotencyKey:'key-own00001'},THU);
 assert.equal(own.result,'own_phone');assert.equal(own.delegation.status,'PENDING_SEND');assert.match(own.smsHref,/^sms:\+61433111222\?&body=/);
 assert.equal((await ownerAction(s2,N,own.delegation.id,{action:'sent_myself'},THU)).sentBy,'own_phone');
});
test('follow-up timing: one nudge after a day without an answer, one reminder on the day, one "still waiting" for her, expiry; never at night',()=>{
 const base={status:'SENT',sentAt:'2026-11-18T09:00:00+11:00',acceptedAt:null,expiresAt:'2026-11-21T23:59:00+10:00',remindersOff:false,messages:[],notices:[],snapshot:{title:'T',due:'2026-11-20',dueTime:null,message:null}};
 const at=iso=>new Date(iso);
 assert.deepEqual(followUpFor(base,at('2026-11-19T09:30:00+11:00')),{kind:'reminder_pending'});
 assert.equal(followUpFor(base,at('2026-11-19T23:30:00+11:00')),null,'not at night');
 assert.equal(followUpFor({...base,messages:[{kind:'reminder_pending',status:'accepted'}]},at('2026-11-19T09:30:00+11:00')),null,'only once');
 assert.equal(followUpFor({...base,remindersOff:true},at('2026-11-19T09:30:00+11:00')),null,'they opted out');
 const acc={...base,status:'ACCEPTED',acceptedAt:'2026-11-19T10:00:00+11:00'};
 assert.deepEqual(followUpFor(acc,at('2026-11-20T08:15:00+11:00')),{kind:'reminder_due'});
 assert.equal(followUpFor({...acc,acceptedAt:'2026-11-20T07:00:00+11:00'},at('2026-11-20T08:15:00+11:00')),null,'no reminder the morning they said yes');
 assert.deepEqual(followUpFor({...acc,messages:[{kind:'reminder_due',status:'accepted'}]},at('2026-11-20T17:30:00+11:00')),{kind:'at_risk'});
 assert.equal(followUpFor({...acc,messages:[{kind:'reminder_due',status:'accepted'}],notices:[{type:'DEADLINE_AT_RISK'}]},at('2026-11-20T18:30:00+11:00')),null,'she is told once');
 assert.deepEqual(followUpFor({...base,expiresAt:'2026-11-19T00:00:00Z'},at('2026-11-19T23:30:00+11:00')),{kind:'expire'},'expiry happens even at night');
 const e=expiryFor({status:'SENT',snapshot:{due:'2026-11-20'},createdAt:'2026-11-18T00:00:00Z'},THU);assert.ok(Date.parse(e)>Date.parse('2026-11-20T12:00:00Z')&&Date.parse(e)<Date.parse('2026-11-23T00:00:00Z'),e);
});
test('runFollowUps sends the due-day reminder once (keyed), and both the old and the new link keep working',async()=>{
 globalThis.__bearDelegations?.clear();   // only this test's request in the store
 const s=await lucia();const t=await cakeTask(s);const D=deps();
 await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-rem00001'},THU);const first=tokenFrom(mockOutbox().at(-1).body);
 await recipientAction(D,first,{action:'accept'},THU);
 const FRI=new Date('2026-11-20T08:20:00+11:00');const n0=mockOutbox().length;
 assert.equal((await runFollowUps(D,FRI)).reminders,1);assert.equal((await runFollowUps(D,FRI)).reminders,0,'never twice');
 const rem=mockOutbox().at(-1);assert.equal(mockOutbox().length,n0+1);assert.match(rem.body,/^🐻 A reminder from Bear:\nYou’ve agreed to pick up Ella’s birthday cake by Friday 20 November, 3:00 pm\.\nUpdate your progress:/);
 assert.equal((await recipientView(D.rows,first,FRI)).status,'ACCEPTED');assert.equal((await recipientView(D.rows,tokenFrom(rem.body),FRI)).status,'ACCEPTED');
 assert.equal((await recipientAction(D,first,{action:'on_track'},FRI)).status,'ACCEPTED');
 const told=[];D.notify=async(d,ty)=>told.push(ty);assert.equal((await runFollowUps(D,new Date('2026-11-20T17:40:00+11:00'))).atRisk,1);assert.deepEqual(told,['DEADLINE_AT_RISK']);
});
test('delivery reports: out-of-order reports never go backwards; an undelivered first text tells her',async()=>{
 const s=await lucia();const t=await cakeTask(s);const D=deps();
 const r=await createRequest(s,D,{taskId:t.id,name:'Daniel',phone:'0412345678',message:null,idempotencyKey:'key-dlv00001'},THU);
 const id=(await D.rows.get(r.delegation.id)).messages[0].providerId;
 await deliveryReport(D,id,'delivered',null,THU);await deliveryReport(D,id,'sent',null,THU);
 assert.equal((await D.rows.get(r.delegation.id)).messages[0].status,'delivered');
 const t2=await cakeTask(s);const r2=await createRequest(s,D,{taskId:t2.id,name:'Mum',phone:'0433111222',message:null,idempotencyKey:'key-dlv00002'},THU);
 const id2=(await D.rows.get(r2.delegation.id)).messages[0].providerId;await deliveryReport(D,id2,'undelivered','30005',THU);
 const d2=await D.rows.get(r2.delegation.id);assert.equal(d2.status,'CANCELLED');assert.ok(d2.notices.some(n=>n.type==='REQUEST_SEND_FAILED'));
});
test('Twilio adapter: a text counts as sent only with Twilio’s id; bad numbers aren’t retried; busy errors are; signatures checked',async()=>{
 const calls=[];const fake=(status,body)=>async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify(body),{status});};
 const ok=await twilioSms({sid:'AC1',token:'tok',from:'+61400000000'},fake(201,{sid:'SM123',status:'queued'})).send('+61412345678','Hi',{idempotencyKey:'k1'});
 assert.deepEqual(ok,{ok:true,providerId:'SM123',status:'queued',provider:'twilio'});assert.match(calls[0].url,/Accounts\/AC1\/Messages\.json$/);assert.match(String(calls[0].init.body),/To=%2B61412345678/);
 assert.match(calls[0].init.headers.Authorization,/^Basic /);
 const bad=await twilioSms({sid:'AC1',token:'tok',from:'MG1'},fake(400,{code:21211,message:'Invalid To'})).send('+61412345678','Hi',{idempotencyKey:'k2'});assert.equal(bad.ok,false);assert.equal(bad.retryable,false);
 const busy=await twilioSms({sid:'AC1',token:'tok',from:'MG1'},fake(429,{})).send('+61412345678','Hi',{idempotencyKey:'k3'});assert.equal(busy.retryable,true);
 const net=await twilioSms({sid:'AC1',token:'tok',from:'MG1'},async()=>{throw new Error('down');}).send('+61412345678','Hi',{idempotencyKey:'k4'});assert.deepEqual(net,{ok:false,error:'network',retryable:true,provider:'twilio'});
 // Twilio's documented example signature.
 const url='https://mycompany.com/myapp.php?foo=1&bar=2';const params={CallSid:'CA1234567890ABCDE',Caller:'+12349013030',Digits:'1234',From:'+12349013030',To:'+18005551212'};
 assert.ok(await twilioSignatureOk('12345',url,params,'0/KCTR6DLpKmkAf8muzZqo1nDgQ='));assert.ok(!(await twilioSignatureOk('12345',url,params,'nope')));assert.ok(!(await twilioSignatureOk('12345',url,params,null)));
});
test('what a recipient sees is only this request',async()=>{
 const v=publicView({status:'SENT',tokenRevokedAt:null,expiresAt:'2099-01-01T00:00:00Z',ownerName:'Lucia',ownerId:'secret-owner',taskId:'secret-task',recipient:{name:'Daniel',phone:'+61412345678'},snapshot:{title:'Cake',due:null,dueTime:null,message:null},remindersOff:false,changedSince:false,events:[],messages:[],notices:[],tokenHashes:['h']},THU);
 assert.ok(!/secret|\+614/.test(JSON.stringify(v)));
 assert.equal(await hashToken('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
