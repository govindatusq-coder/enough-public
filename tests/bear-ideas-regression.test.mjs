// Regression fixtures for the ORIGINAL Bear Ideas (mental-load reduction from bills), written
// before the Bear Ideas orchestrator. Every one of these behaviours must keep working.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile,setDayMode} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {confirmBill} from '../lib/bear/services/task-inference.ts';
import {refreshSuggestions,respondToSuggestion} from '../lib/bear/services/suggestions.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {stamp} from '../lib/bear/store/store.ts';

const USER='55555555-5555-4555-8555-555555555555';const NOW=new Date('2026-10-27T09:00:00+11:00');
async function onboard(store){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['money'],onboardingComplete:true});}
async function bill(store,{biller='AGL',category='electricity',cents=18460,due='2026-11-20',recurring=false,recurrence='unknown',discount=null,deadline=null,paidOn=null}={}){
 const {extraction}=await createCapture(store,null,{method:'text',text:`${biller} ${category} bill. Amount due $${(cents/100).toFixed(2)}. Due ${due}.`,referenceYear:2026});
 const corrections={biller,category,amountDueCents:cents,dueDate:due,isRecurring:recurring,expectedRecurrence:recurrence,...(discount?{earlyDiscountCents:discount,discountDeadline:deadline}:{})};
 const r=await confirmBill(store,{extractionId:extraction.id,corrections,confirmedFields:Object.keys(corrections),allowDuplicate:true,forPerson:null},NOW);
 if(paidOn)await completeTask(store,{taskId:r.task.id,method:null,paidOn,expectNext:false},NOW);
 return r.bill;
}
const kinds=async store=>(await refreshSuggestions(store,NOW)).map(s=>s.kind);

test('recurring bill: Bear offers to expect the next one, and accepting creates the expectation',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await bill(store,{recurring:true,recurrence:'quarterly'});
 const s=(await refreshSuggestions(store,NOW)).find(x=>x.kind==='expect_recurring');assert.ok(s);assert.match(s.title,/looks quarterly/);
 await respondToSuggestion(store,{suggestionId:s.id,response:'accept'},NOW);
 assert.equal((await store.list('recurring_expectations')).length,1);
});
test('early-payment discount: Bear offers a reminder before it expires, and accepting plans one',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const b=await bill(store,{discount:900,deadline:'2026-11-10'});
 const s=(await refreshSuggestions(store,NOW)).find(x=>x.kind==='discount_available');assert.ok(s);assert.match(s.title,/\$9\.00 off/);
 await respondToSuggestion(store,{suggestionId:s.id,response:'accept'},NOW);
 assert.ok((await store.list('reminders')).some(r=>r.billId===b.id&&r.plan.label.includes('discount')));
});
test('a bill that went up: Bear offers to look at why',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 await bill(store,{cents:10000,due:'2026-08-20',paidOn:'2026-08-18'});
 await bill(store,{cents:14000});assert.ok((await kinds(store)).includes('bill_increased'));
});
test('related areas: after electricity, Bear suggests adding water',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await bill(store);assert.ok((await kinds(store)).includes('add_related_areas'));
});
test('missing expected bill: Bear notices when it has not turned up',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const b=await bill(store);
 await store.insert('recurring_expectations',stamp(USER,{billerKey:'agl',biller:'AGL',category:'electricity',recurrence:'quarterly',status:'expecting',lastDueAt:'2026-07-20',expectedFrom:'2026-10-10',expectedTo:'2026-10-20',typicalAmountCents:18000,observedDueDates:['2026-07-20'],lastBillId:b.id}));
 assert.ok((await kinds(store)).includes('missing_expected'));
});
test('annual bill: paid around this time last year, Bear offers to watch for it',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 await bill(store,{category:'insurance',biller:'NRMA',due:'2025-11-15',recurring:true,recurrence:'yearly',paidOn:'2025-11-10'});
 assert.ok((await kinds(store)).includes('watch_annual'));
});
test('"Not relevant" is respected, and three of a kind stops that kind',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await bill(store);
 const s=(await refreshSuggestions(store,NOW)).find(x=>x.kind==='add_related_areas');
 await respondToSuggestion(store,{suggestionId:s.id,response:'reject'},NOW);
 assert.ok(!(await refreshSuggestions(store,NOW)).some(x=>x.id===s.id),'a rejected idea does not come back');
});
test('a Chaos day keeps Bear Ideas quiet',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await bill(store,{recurring:true,recurrence:'quarterly'});
 await setDayMode(store,'chaos');assert.deepEqual(await refreshSuggestions(store,new Date()),[]);
});
