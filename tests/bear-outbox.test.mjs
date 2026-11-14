// Push without the database's master key: keys derived from a server secret, and a delivery outbox the job can read.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {stamp} from '../lib/bear/store/store.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {buildOutbox,deliverOutbox} from '../lib/bear/services/outbox.ts';
import {derivedVapid,outboxIdentity,serverSecret,uuidFor} from '../lib/bear/push-keys.ts';

const SECRET='sk-test-0123456789abcdefghijklmnop';
const SUB={endpoint:'https://push.example/1',keys:{p256dh:'pppppppppppp',auth:'aaaaaa'}};
const WHEN=new Date('2026-11-11T19:00:00+11:00');
async function world(){
 const s=new MemoryBackend().for('41414141-4141-4414-8414-414141414141');await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true});
 await s.insert('push_subscriptions',stamp(s.userId,{endpoint:SUB.endpoint,keys:SUB.keys,userAgent:null}));
 const {extraction}=await createCapture(s,null,{method:'text',text:'Return the excursion permission note by 12 November.',referenceYear:2026});
 const task=(await maybeAutoSetup(s,extraction,new Date('2026-11-09T09:00:00+11:00'))).task;return {s,task};
}
const sender=(result='sent')=>{const calls=[];const f=async(sub,payload)=>{calls.push({sub:sub.endpoint,payload});return result;};f.calls=calls;return f;};

test('push keys derive the same way every time, are valid, and differ per secret',()=>{
 const a=derivedVapid(SECRET),b=derivedVapid(SECRET),c=derivedVapid(SECRET+'x');
 assert.deepEqual(a,b);assert.notEqual(a.publicKey,c.publicKey);
 assert.equal(Buffer.from(a.publicKey,'base64url').length,65);assert.equal(Buffer.from(a.privateKey,'base64url').length,32);
 assert.ok(!a.privateKey.includes(SECRET)&&!JSON.stringify(outboxIdentity(SECRET,'h.example')).includes(SECRET),'the secret itself never appears');
 assert.match(uuidFor(SECRET,'x'),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.equal(serverSecret({}),null);assert.equal(serverSecret({ANTHROPIC_API_KEY:'short'}),null);assert.equal(serverSecret({ANTHROPIC_API_KEY:SECRET}),SECRET);
});
test('the outbox holds only what delivery needs: no source text, notes or documents',async()=>{
 const {s}=await world();const box=await buildOutbox(s,null,WHEN);assert.ok(box&&box.items.length>=1);
 const text=JSON.stringify(box);assert.ok(!/sourceText|rawText|notes|objectKey|"body"/.test(text),'no captured content');
 assert.deepEqual(Object.keys(box.items[0].task).sort(),['dueAt','estimatedMinutes','id','status','timing','title']);
});
test('nobody subscribed: no outbox at all',async()=>{
 const s=new MemoryBackend().for('42424242-4242-4424-8424-424242424242');await ensureProfile(s);assert.equal(await buildOutbox(s,null,WHEN),null);
});
test('the job sends a due reminder once, to the right task, and never again on later runs',async()=>{
 const {s,task}=await world();let box=await buildOutbox(s,null,WHEN);const send=sender();
 const a=await deliverOutbox(box,send,WHEN);assert.ok(a.delivered>=1&&a.changed);
 for(const c of send.calls)assert.match(c.payload.url,new RegExp(`^/bear/tasks/${task.id}\\?reminder=`));
 const n=send.calls.length;const b=await deliverOutbox(a.box,send,new Date(WHEN.getTime()+15*60000));assert.equal(b.delivered,0);assert.equal(send.calls.length,n);
 // The person opens Bear: the rebuilt outbox remembers the send, and their own reminder row now says it was pushed.
 box=await buildOutbox(s,a.box,new Date(WHEN.getTime()+3600000));const c=await deliverOutbox(box,send,new Date(WHEN.getTime()+3600000));assert.equal(c.delivered,0,'not sent again after a rebuild');
 const pushed=(await s.list('reminders')).filter(r=>r.deliveredVia.includes('push'));assert.ok(pushed.length>=1,'written back to the person’s own data');
});
test('a failed send is retried next run; a dead push address is dropped',async()=>{
 const {s}=await world();const box=await buildOutbox(s,null,WHEN);
 const f=await deliverOutbox(box,sender('failed'),WHEN);assert.deepEqual([f.delivered,f.failed>=1],[0,true]);
 const again=await deliverOutbox(f.box,sender(),WHEN);assert.ok(again.delivered>=1);
 const g=await deliverOutbox(box,sender('gone'),WHEN);assert.equal(g.box.subs.length,0);assert.ok(g.changed);
});
test('finished work is not in the outbox, and quiet hours are respected by the job',async()=>{
 const {s,task}=await world();await completeTask(s,{taskId:task.id,method:null,expectNext:false},WHEN);
 const box=await buildOutbox(s,null,WHEN);assert.equal(box.items.filter(i=>i.task.id===task.id).length,0);
 const w=await world();const b2=await buildOutbox(w.s,null,WHEN);const send=sender();
 const night=await deliverOutbox(b2,send,new Date('2026-11-10T02:30:00+11:00'));assert.equal(night.delivered,0,'nothing at 2:30am');assert.equal(send.calls.length,0);
});
