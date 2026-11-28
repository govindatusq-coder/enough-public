// Bear Boost, "No time? Hand something off": which task Bear offers to share, what it never offers, the honest "nothing",
// and the choice she makes being kept (without her words).
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload} from '../lib/bear/board/service.ts';
import {recommendShare,momentFeedback,momentFeedbackSchema,stepAction,giveToBear} from '../lib/bear/rre/service.ts';

const MON=new Date('2026-11-23T10:00:00+11:00');
const backend=new MemoryBackend();let n=0;
async function person(){const s=backend.for(`5a5a5a5a-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home'],onboardingComplete:true});return s;}
const titles=async(s,exclude=[])=>{const out=[];for(let i=0;i<10;i++){const r=await recommendShare(s,{exclude},MON);if(!r.suggestion)break;out.push(r.suggestion);exclude=[...exclude,r.suggestion.taskId];}return out;};

test('offers errands and chores coming up first, says why, and goes through every fair option before saying nothing',async()=>{
 const s=await person();
 await unload(s,null,{text:'Pick up the dry cleaning on Wednesday\nClean out the gutters\nBuy printer ink by 15 December',via:'text'},MON);
 const all=await titles(s);
 assert.ok(all.length>=2,JSON.stringify(all.map(x=>x.title)));
 assert.match(all[0].title,/dry cleaning/i,'the soonest errand first');assert.match(all[0].why,/^Due Wednesday, and /);
 for(const x of all)assert.match(x.why,/\.$/);
 assert.equal((await recommendShare(s,{exclude:all.map(x=>x.taskId)},MON)).suggestion,null,'an honest nothing once she has seen them all');
});
test('never offers her own appointments, presents, or bills and forms that need her logins',async()=>{
 const s=await person();
 await unload(s,null,{text:'Book my dentist appointment\nOrganise Christmas presents\nPay the electricity bill by Friday\nRenew the car registration\nLearn to play the piano one day',via:'text'},MON);
 const all=await titles(s);
 assert.deepEqual(all.map(x=>x.title),[],'nothing here is Bear’s to hand on');
});
test('skips anything already handed off or started by her',async()=>{
 const s=await person();
 const r=await unload(s,null,{text:'Pick up a red scrunchie for Sarah by Friday',via:'text'},MON);const id=r.added[0].id;
 assert.equal((await recommendShare(s,{exclude:[]},MON)).suggestion?.taskId,id);
 await s.update('tasks',id,{delegation:{id:'d1',to:'Daniel',status:'SENT',at:MON.toISOString()}});
 assert.equal((await recommendShare(s,{exclude:[]},MON)).suggestion,null,'already asked someone');
 await s.update('tasks',id,{delegation:{id:'d1',to:'Daniel',status:'DECLINED',at:MON.toISOString()}});
 assert.equal((await recommendShare(s,{exclude:[]},MON)).suggestion?.taskId,id,'a no puts it back');
 await giveToBear(s,null,id,MON);await stepAction(s,id,{action:'done'},MON);
 assert.equal((await recommendShare(s,{exclude:[]},MON)).suggestion,null,'she has started it herself');
});
test('her choice is kept as a plain event: which surface, what she chose, the task; nothing she wrote',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Pick up the dry cleaning on Wednesday',via:'text'},MON);const id=r.added[0].id;
 await momentFeedback(s,momentFeedbackSchema.parse({taskId:id,surface:'share',response:'ask_someone'}),MON);
 await momentFeedback(s,momentFeedbackSchema.parse({taskId:id,surface:'finish',response:'not_now'}),MON);
 const ev=(await s.list('behaviour_events')).filter(e=>String(e.detail?.kind||'').startsWith('moment_'));
 assert.deepEqual(ev.map(e=>[e.type,e.detail.kind,e.detail.response]).sort(),[['suggestion_accepted','moment_share','ask_someone'],['suggestion_rejected','moment_finish','not_now']].sort());
 assert.throws(()=>momentFeedbackSchema.parse({taskId:id,surface:'share',response:'ask_someone',note:'hi'}));
});
