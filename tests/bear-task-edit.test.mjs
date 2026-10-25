import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {rhythmPresets} from '../lib/bear/domain/labels.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {updateTask,setItemDone,estimateTaskCost,splitIntoPurchases,reopenTask} from '../lib/bear/services/task-edit.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {everythingView} from '../lib/bear/services/everything.ts';
import {parseItemLines,totalCost,qtyFactor} from '../lib/bear/domain/items.ts';

const USER='22222222-2222-4222-8222-222222222222';const NOW=new Date('2026-11-10T09:00:00+11:00');
async function onboard(store,extra={}){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['family','home','money'],lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},onboardingComplete:true,...extra});}
const LIST='Bunnings: 2 bags potting mix, drill bits, 3 x fence palings, outdoor paint, due 5 December 2026';
async function listTask(store){const {extraction}=await createCapture(store,null,{method:'text',text:LIST,referenceYear:2026});const auto=await maybeAutoSetup(store,extraction,NOW);return {extraction,auto};}

test('item lines parse quantities and estimates multiply only counted quantities',()=>{
 const items=parseItemLines('2 bags potting mix\n3 x fence palings\neggs x 2\nmilk');
 assert.deepEqual(items.map(i=>[i.name,i.quantity]),[['potting mix','2 bags'],['fence palings','3 x'],['eggs','2'],['milk',null]]);
 assert.equal(qtyFactor('3 x'),3);assert.equal(qtyFactor('2 bags'),2);assert.equal(qtyFactor('1kg'),1);
 assert.equal(totalCost([{quantity:'2',estimatedCents:500},{quantity:null,estimatedCents:null}]),1000);assert.equal(totalCost([{quantity:null,estimatedCents:null}]),null);
});

test('a typed hardware list is set up automatically with items, area, a reminder and no verify step',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction,auto}=await listTask(store);
 assert.equal(extraction.general.kind,'shopping');assert.equal(extraction.general.items.length,4);
 assert.ok(auto,'auto set up');assert.equal(auto.task.title,'Bunnings run','short title, not the pasted line');assert.equal(auto.task.notes,null,'list is not repeated in notes');assert.equal(auto.task.setupBy,'bear');assert.equal(auto.area,'home');assert.equal(auto.task.items.length,4);assert.equal(auto.task.dueAt,'2026-12-05');assert.equal(auto.planned,true);
 assert.equal((await store.list('reminders')).length>0,true);
 assert.equal((await everythingView(store)).areas.find(a=>a.key==='home').projects.length,1);
});

test('auto set-up leaves bills, switched-off users and unnamed captures alone',async()=>{
 const store=new MemoryBackend().for(USER);const p=await onboard(store);
 const bill=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 28/11/2026. BPAY biller 12345',referenceYear:2026});
 assert.equal(await maybeAutoSetup(store,bill.extraction,NOW),null);
 await store.update('profiles',p.id,{pins:{...p.pins,preferences:{...p.pins.preferences,autoSetup:false}}});
 const note=await createCapture(store,null,{method:'text',text:'Return the permission form for Max by 12/11/2026',referenceYear:2026});
 assert.equal(await maybeAutoSetup(store,note.extraction,NOW),null);
});

test('prices are estimated by the AI service, never invented, and keep user prices',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await assert.rejects(estimateTaskCost(store,null,auto.task.id),e=>e.code==='ai_unavailable');
 const first=auto.task.items[0];await updateTask(store,auto.task.id,{items:auto.task.items.map(i=>i.id===first.id?{...i,estimatedCents:2000}:i)});
 const provider=new FakeProvider(input=>({prices:input.text.split('\n').map((n,i)=>({name:n,cents:(i+1)*1000}))}));
 const priced=await estimateTaskCost(store,provider,auto.task.id);
 assert.equal(priced.items.find(i=>i.id===first.id).estimatedCents,2000,'user price kept');assert.ok(priced.items.every(i=>i.estimatedCents!==null));
 assert.equal(provider.calls[0].text.split('\n').length,3,'only unpriced items were sent');assert.ok(priced.estimatedCents>0);
});

test('items can be ticked over several trips and the last tick completes the task with a win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);const [a,b,c,d]=auto.task.items;
 let r=await setItemDone(store,auto.task.id,{itemId:a.id},NOW);assert.equal(r.completed,false);
 r=await setItemDone(store,auto.task.id,{itemId:b.id},NOW);r=await setItemDone(store,auto.task.id,{itemId:b.id,done:false},NOW);assert.equal(r.task.items.find(i=>i.id===b.id).done,false);
 r=await setItemDone(store,auto.task.id,{itemId:b.id},NOW);r=await setItemDone(store,auto.task.id,{itemId:c.id},NOW);assert.equal(r.completed,false);
 r=await setItemDone(store,auto.task.id,{itemId:d.id},NOW);assert.equal(r.completed,true);assert.equal(r.win.title,auto.task.title);
 assert.equal((await winsView(store)).cards.length,1);
});

test('"got everything" completes a list in one go',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 const r=await setItemDone(store,auto.task.id,{all:true},NOW);assert.equal(r.completed,true);assert.ok(r.task.items.every(i=>i.done));
});

test('a larger list splits into balanced purchases that are steps of the main task',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await updateTask(store,auto.task.id,{items:auto.task.items.map((i,k)=>({...i,estimatedCents:[9000,3000,2500,1500][k]}))});
 const {steps}=await splitIntoPurchases(store,auto.task.id,2,NOW);
 assert.equal(steps.length,2);assert.equal(steps.reduce((s,t)=>s+t.items.length,0),4);
 const costs=steps.map(t=>t.estimatedCents).sort((x,y)=>x-y);assert.deepEqual(costs,[12000,18000],'2 bags of mix (18000) alone vs the other three (12000): balanced by cost, not count');
 assert.ok(steps.every(t=>t.dueAt<='2026-12-05'&&t.dueAt>'2026-11-10'));
 assert.equal((await store.list('task_dependencies',{where:[{column:'task_id',value:auto.task.id}]})).length,2);
 await assert.rejects(splitIntoPurchases(store,auto.task.id,2,NOW),e=>e.code==='already_split');
 const r=await setItemDone(store,auto.task.id,{itemId:auto.task.items[0].id},NOW);assert.equal(r.completed,false,'a split list finishes from its purchases');
});

test('a completed task can be edited, and reopened without leaving a stale win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await completeTask(store,{taskId:auto.task.id,method:null,expectNext:false},NOW);
 const edited=await updateTask(store,auto.task.id,{title:'Bunnings run for the deck',notes:'Went on Saturday',location:'Bunnings Marrickville'});
 assert.equal(edited.status,'done');assert.equal(edited.title,'Bunnings run for the deck');
 assert.equal((await winsView(store)).cards[0].title,'Bunnings run for the deck','win follows the edit');
 const reopened=await reopenTask(store,auto.task.id);assert.equal(reopened.status,'open');assert.ok(reopened.items.every(i=>!i.done));
 assert.equal((await winsView(store)).cards.length,0);assert.equal((await store.list('completions')).length,0);
 await assert.rejects(reopenTask(store,auto.task.id),e=>e.code==='not_done');
});

import {areaView,areaTiles} from '../lib/bear/services/areas.ts';
import {setWinSaving} from '../lib/bear/services/win-edit.ts';
import {confirmBill} from '../lib/bear/services/task-inference.ts';
import {homeView} from '../lib/bear/services/home.ts';

test('areas list what is current in each, without listing steps twice, and move tasks to done',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await updateTask(store,auto.task.id,{items:auto.task.items.map(i=>({...i,estimatedCents:1000}))});
 await splitIntoPurchases(store,auto.task.id,2,NOW);
 const home=await areaView(store,'home',NOW);assert.equal(home.current.length,1,'purchases are steps of the main task');assert.equal(home.current[0].taskId,auto.task.id);assert.equal(home.current[0].stepsLeft,2);assert.match(home.current[0].estimate,/about \$70/);
 const tiles=await areaTiles(store,['family','home','money']);assert.equal(tiles.find(t=>t.key==='home').open,1);assert.equal(tiles.find(t=>t.key==='money').open,0);
 assert.equal((await homeView(store,NOW)).areas.find(a=>a.key==='home').open,1);
 await completeTask(store,{taskId:auto.task.id,method:null,expectNext:false},NOW);
 const after=await areaView(store,'home',NOW);assert.equal(after.current.length,0);assert.equal(after.done.length,1);
});

async function paidElectricityBill(store){
 const {extraction}=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 28/11/2026. BPAY biller 12345 ref 998877',referenceYear:2026});
 const {bill,task}=await confirmBill(store,{extractionId:extraction.id,corrections:{biller:'AGL',amountDueCents:18460,dueDate:'2026-11-28',category:'electricity',isRecurring:false},confirmedFields:['biller','amountDueCents','dueDate','category','isRecurring'],allowDuplicate:false});
 const done=await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);
 return {bill,task,done};
}
test('a saving the person knows about is counted, labelled as theirs, replaceable and removable',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {done}=await paidElectricityBill(store);
 assert.equal((await winsView(store)).totals.moneyCents,0,'nothing was printed on the bill, so nothing is counted automatically');
 await setWinSaving(store,done.win.id,{cents:1500,reason:'early_discount_used'},NOW);
 let view=await winsView(store);assert.equal(view.totals.moneyCents,1500);assert.match(view.cards[0].detail,/\+\$15\.00 early payment discount \(you told Bear\)/);assert.equal(view.cards[0].counted[0].mine,true);
 await setWinSaving(store,done.win.id,{cents:2000,reason:'discount_used'},NOW);
 view=await winsView(store);assert.equal(view.totals.moneyCents,2000,'replaced, not added twice');assert.equal(view.cards[0].detail.split('you told Bear').length,2);
 assert.equal((await homeView(store,NOW)).ledgers.wealth.headline,'$20.00 protected this month');
 await setWinSaving(store,done.win.id,{cents:0,reason:'discount_used'},NOW);
 assert.equal((await winsView(store)).totals.moneyCents,0);
});

test('a paid bill can be made current again, and its saving goes with the win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {bill,task,done}=await paidElectricityBill(store);
 await setWinSaving(store,done.win.id,{cents:1500,reason:'early_discount_used'},NOW);
 const reopened=await reopenTask(store,task.id);assert.equal(reopened.status,'open');
 const b=await store.get('bills',bill.id);assert.equal(b.status,'watching');assert.equal(b.paidAt,null);
 const view=await winsView(store);assert.equal(view.cards.length,0);assert.equal(view.totals.moneyCents,0);
 assert.equal((await areaView(store,'money',NOW)).current.length,1);
});
