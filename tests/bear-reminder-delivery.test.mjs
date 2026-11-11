// Push delivery that is safe to run twice, recovers from failure, skips finished work, and opens the right task.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {dueReminders} from '../lib/bear/services/reminders.ts';
import {completeTask,dropTask} from '../lib/bear/services/completion.ts';
import {deliverForUser,reminderUrl} from '../lib/bear/services/delivery.ts';
import {usageOf} from '../lib/bear/services/bill-extraction.ts';

const SUB={endpoint:'https://push.example/1',keys:{p256dh:'p',auth:'a'}},SUB2={endpoint:'https://push.example/2',keys:{p256dh:'p',auth:'a'}};
const WHEN=new Date('2026-11-11T19:00:00+11:00');
async function world(text='Return the excursion permission note by 12 November.'){
 const s=new MemoryBackend().for('31313131-3131-4313-8313-313131313131');await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true});
 const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});const task=(await maybeAutoSetup(s,extraction,new Date('2026-11-09T09:00:00+11:00'))).task;return {s,task};
}
const sender=(plan={})=>{const calls=[];const f=async(sub,payload)=>{calls.push({sub:sub.endpoint,payload});const r=plan[sub.endpoint];if(r==='throw')throw new Error('network');return r||'sent';};f.calls=calls;return f;};

test('a due reminder is sent once; running the job again never re-sends the same one',async()=>{
 const {s}=await world();assert.ok((await dueReminders(s,WHEN)).length>=1,'there is something to remind about');
 const send=sender();const a=await deliverForUser(s,[SUB],send,WHEN);assert.ok(a.delivered>=1);
 await deliverForUser(s,[SUB],send,WHEN);await deliverForUser(s,[SUB],send,WHEN);
 const tags=send.calls.map(c=>c.payload.tag);assert.equal(new Set(tags).size,tags.length,'no reminder was sent twice');
});
test('a failed send is not marked delivered, so the next run tries again',async()=>{
 const {s}=await world();const bad=sender({[SUB.endpoint]:'failed'});
 const a=await deliverForUser(s,[SUB],bad,WHEN);assert.deepEqual([a.delivered,a.failed>=1],[0,true]);
 const again=await deliverForUser(s,[SUB],sender(),WHEN);assert.ok(again.delivered>=1,'delivered on the retry');
});
test('one bad subscription or a throwing sender never stops the rest',async()=>{
 const {s}=await world();const r=await deliverForUser(s,[SUB,SUB2],sender({[SUB.endpoint]:'throw'}),WHEN);assert.ok(r.delivered>=1,'the working subscription still delivered');
 const g=await world();const gone=await deliverForUser(g.s,[SUB,SUB2],sender({[SUB.endpoint]:'gone'}),WHEN);assert.deepEqual(gone.gone,[SUB.endpoint],'a dead subscription is reported so it can be removed');assert.ok(gone.delivered>=1);
});
test('finished, dropped or completed work never produces a reminder',async()=>{
 const a=await world();await completeTask(a.s,{taskId:a.task.id,method:null,expectNext:false},WHEN);assert.deepEqual(await dueReminders(a.s,WHEN),[]);
 const b=await world();await dropTask(b.s,b.task.id);assert.deepEqual(await dueReminders(b.s,WHEN),[]);
 // Even if a reminder row was left behind pointing at a finished task:
 const c=await world();const rows=await c.s.list('reminders');assert.ok(rows.length>0);await c.s.update('tasks',c.task.id,{status:'done'});assert.deepEqual(await dueReminders(c.s,WHEN),[],'a stale reminder row is ignored');
 const send=sender();assert.equal((await deliverForUser(c.s,[SUB],send,WHEN)).delivered,0);assert.equal(send.calls.length,0);
});
test('the notification opens the task it is about (a bill opens its bill; nothing opens just "home")',async()=>{
 const {s,task}=await world();const send=sender();await deliverForUser(s,[SUB],send,WHEN);
 const urls=send.calls.map(c=>c.payload.url);assert.ok(urls.length>0);for(const u of urls)assert.match(u,new RegExp(`^/bear/tasks/${task.id}\\?reminder=`));
 assert.match(reminderUrl({billId:'b1',reminder:{id:'r1',taskId:'t1'}}),/^\/bear\/bills\/b1\?reminder=r1$/);assert.equal(reminderUrl({billId:null,reminder:{id:'r2',taskId:'t2'}}),'/bear/tasks/t2?reminder=r2');
});
test('with nobody subscribed nothing fails; the in-app list still has the reminder',async()=>{
 const {s}=await world();const r=await deliverForUser(s,[],sender(),WHEN);assert.deepEqual([r.delivered,r.failed],[0,0]);assert.ok((await dueReminders(s,WHEN)).length>=1,'still due in the app, where it is shown on the main screen');
});
test('model token use is recorded only when the provider reports it',()=>{
 assert.deepEqual(usageOf({id:'x',usage:{input_tokens:1200,output_tokens:340}}),{inputTokens:1200,outputTokens:340});
 assert.equal(usageOf({id:'x'}),null);assert.equal(usageOf(null),null);assert.equal(usageOf({usage:{input_tokens:'many'}}),null);
});
