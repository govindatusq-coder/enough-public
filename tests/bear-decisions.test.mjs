import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {StoreError} from '../lib/bear/store/store.ts';
import {decide} from '../lib/bear/services/notification-decision.ts';
import {capacityWindows} from '../lib/bear/services/capacity.ts';
import {defaultProfile,rhythmPresets} from '../lib/bear/services/profile.ts';
import {scorePlan,bestPlan} from '../lib/bear/services/coordination.ts';
import {learnedWindow,defensibleSaving} from '../lib/bear/services/completion.ts';
import {banned} from '../lib/bear/domain/copy.ts';

const USER='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
const profile=()=>({...defaultProfile(USER),lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},emptyMoments:['morning_scramble']});
const signals=(over={})=>({hourResponsiveness:new Array(24).fill(0),postponeCountByTask:{},rejectedSuggestionKinds:{},acceptedSuggestionKinds:{},medianMinutesReminderToCompletion:null,preferredCaptureMethods:{},corrections:{},sampleSize:0,...over});
const task=(over={})=>({id:'t1',userId:USER,createdAt:'',updatedAt:'',projectId:'p',kind:'pay_bill',title:'Pay electricity bill',status:'open',dueAt:'2026-11-28',estimatedMinutes:2,cognitiveEffort:'low',forPerson:null,isDemo:false,...over});
const reminder=(over={})=>({id:'r1',userId:USER,createdAt:'',updatedAt:'',taskId:'t1',billId:null,kind:'planned',status:'scheduled',scheduledFor:'2026-11-10T09:00:00.000Z',plan:{scheduledFor:'',label:'',rationale:'',windowId:null,score:0},followUpIfUnpaid:true,attempts:0,deliveredAt:null,deliveredVia:[],message:'Your electricity bill is due soon.',...over});

test('the decision engine never nags, respects quiet hours, day mode and repeated deferral',()=>{
 const base={task:task(),bill:null,profile:profile(),dayMode:null,signals:signals()};
 const at=new Date('2026-11-10T20:05:00+11:00');
 assert.equal(decide({...base,reminder:reminder(),now:at}).deliver,true);
 assert.equal(decide({...base,reminder:reminder({scheduledFor:'2026-11-12T09:00:00.000Z'}),now:at}).deliver,false,'not before its time');
 assert.equal(decide({...base,reminder:reminder(),now:new Date('2026-11-10T23:00:00+11:00')}).reason,'quiet_hours');
 assert.equal(decide({...base,reminder:reminder(),now:at,dayMode:'chaos'}).reason,'day_mode_chaos');
 const urgent=decide({...base,task:task({dueAt:'2026-11-11'}),reminder:reminder(),now:at,dayMode:'chaos'});
 assert.equal(urgent.deliver,true);assert.equal(urgent.essential,true,'things that cannot wait still get through in chaos');
 assert.equal(decide({...base,reminder:reminder({deliveredAt:'2026-11-10T08:00:00+11:00'}),now:at}).reason,'already_nudged');
 const stuck=decide({...base,reminder:reminder(),now:at,signals:signals({postponeCountByTask:{t1:2}})});
 assert.equal(stuck.deliver,true);assert.match(stuck.message,/plan isn't helping/);
 assert.equal(decide({...base,reminder:reminder(),now:at,signals:signals({sampleSize:10,hourResponsiveness:new Array(24).fill(-0.8)})}).reason,'low_capacity_hour');
 const closed=decide({...base,task:task({status:'done'}),reminder:reminder(),now:at});assert.equal(closed.deliver,false);
 for(const d of [decide({...base,reminder:reminder(),now:at}),urgent,stuck])if(d.deliver)assert.ok(!banned.test(d.message));
});
test('capacity windows protect the morning rush, dinner and bedtime and favour admin time',()=>{
 const windows=capacityWindows({profile:profile(),signals:null,dayMode:null,now:new Date('2026-11-10T00:30:00+11:00'),days:2});
 const at=(h,m=0)=>windows.find(w=>w.id===`2026-11-10T${String(h).padStart(2,'0')}${String(m).padStart(2,'0')}`);
 assert.equal(at(7).protected,true);assert.equal(at(18).protected,true);assert.equal(at(19,30).protected,true);assert.equal(at(3).protected,true,'asleep');
 assert.equal(at(20).protected,false);assert.ok(at(20).score>at(12).score,'admin time beats work hours');
 assert.ok(at(7).cognitive<0.2,'morning scramble lowers cognitive capacity');
 const chaos=capacityWindows({profile:profile(),signals:null,dayMode:'chaos',now:new Date('2026-11-10T00:30:00+11:00'),days:1});
 assert.ok(chaos.every(w=>w.protected||w.score<0.2),'chaos day has no good windows');
});
test('the coordination engine prefers higher completion at lower burden',()=>{
 const w=(score)=>({id:'w',start:'',end:'',label:'',time:score,cognitive:score,physical:score,emotionalLoad:0,routineFit:1,history:0,score,protected:false});
 const good={id:'good',window:w(0.9),deadlineRisk:0.05,timeCost:0.1,cognitiveEffort:0.2,financialCost:0,dependencyReadiness:1,interruptionCost:0.1,valueAlignment:0.5,delegationOpportunity:0,completionProbability:0.9};
 const late={...good,id:'late',deadlineRisk:0.9,completionProbability:0.6,interruptionCost:0.7};
 assert.ok(scorePlan(good).score>scorePlan(late).score);assert.equal(bestPlan([late,good]).id,'good');assert.equal(bestPlan([]),null);
});
test('recurrence windows learn from observed due dates and savings are only defensible when stated',()=>{
 assert.deepEqual(learnedWindow(['2026-11-28'],'monthly'),{from:'2026-12-21',to:'2027-01-04',centre:'2026-12-28'});
 assert.deepEqual(learnedWindow(['2026-09-14','2026-10-15','2026-11-14'],'monthly'),{from:'2026-12-11',to:'2026-12-19',centre:'2026-12-15'});
 const bill={biller:'Energy Australia',dueAt:'2026-11-28',fields:{lateFeeCents:{value:1500},earlyDiscountCents:{value:900},discountDeadline:{value:'2026-11-20'}}};
 assert.deepEqual(defensibleSaving(bill,'2026-11-18').map(s=>s.reason),['late_fee_avoided','early_discount_used']);
 assert.deepEqual(defensibleSaving(bill,'2026-11-25').map(s=>s.reason),['late_fee_avoided']);
 assert.deepEqual(defensibleSaving(bill,'2026-12-01'),[]);
 assert.deepEqual(defensibleSaving({...bill,fields:{lateFeeCents:{value:null},earlyDiscountCents:{value:null},discountDeadline:{value:null}}},'2026-11-01'),[]);
});
test('the store isolates users and keeps files under the owner folder',async()=>{
 const backend=new MemoryBackend();const a=backend.for(USER),b=backend.for(OTHER);
 const row=await a.insert('suggestions',{id:'33333333-3333-4333-8333-333333333333',userId:USER,createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',kind:'demo_bill',status:'open',dedupeKey:'x',title:'t',body:'b',actionLabel:'a',payload:{}});
 assert.equal(await b.get('suggestions',row.id),null);assert.equal((await b.list('suggestions')).length,0);
 await assert.rejects(b.update('suggestions',row.id,{status:'accepted'}),e=>e instanceof StoreError&&e.code==='not_found');
 await assert.rejects(b.insert('suggestions',{...row,id:'44444444-4444-4444-8444-444444444444'}),e=>e.code==='invalid');
 await assert.rejects(a.putFile(OTHER+'/file.png',new Uint8Array([1]),'image/png'),e=>e.code==='invalid');
 await a.putFile(USER+'/file.png',new Uint8Array([1,2]),'image/png');assert.equal(await b.getFile(USER+'/file.png'),null);assert.equal((await a.getFile(USER+'/file.png')).bytes.length,2);
 assert.equal((await a.list('suggestions',{where:[{column:'status',value:'open'}]})).length,1);
 await assert.rejects(a.list('suggestions',{where:[{column:'nope',value:1}]}),e=>e.code==='invalid');
});
