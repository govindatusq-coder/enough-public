import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {rhythmPresets} from '../lib/bear/domain/labels.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {confirmTask,ConfirmError} from '../lib/bear/services/task-inference.ts';
import {recommendPlan,acceptPlan} from '../lib/bear/services/reminder-planning.ts';
import {dueReminders} from '../lib/bear/services/reminders.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {everythingView} from '../lib/bear/services/everything.ts';
import {banned} from '../lib/bear/domain/copy.ts';

const USER='11111111-1111-4111-8111-111111111111';const NOW=new Date('2026-11-10T09:00:00+11:00');
const field=(value,confidence=0.95)=>({value,confidence,evidence:null});const empty=()=>({value:null,confidence:0,evidence:null});
async function onboard(store){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['family','money'],lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},onboardingComplete:true});}

test('a spoken or typed non-bill becomes an Area → Project → Task with a plan, a reminder and a win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {capture,extraction}=await createCapture(store,null,{method:'voice',text:"Book Ava's dentist appointment for 18 November 2026 at 3pm",referenceYear:2026});
 assert.equal(capture.method,'voice');assert.equal(extraction.kind,'task');
 const g=extraction.general;assert.equal(g.kind,'appointment');assert.equal(g.area.value,'health');assert.equal(g.when.value,'2026-11-18');assert.equal(g.timeOfDay.value,'15:00');assert.equal(g.person.value,'Ava');
 assert.ok(extraction.questions.length>0,'rules-only understanding asks before committing');
 await assert.rejects(confirmTask(store,{extractionId:extraction.id,corrections:{},confirmedFields:[],includeSteps:true}),e=>e instanceof ConfirmError&&e.code==='unverified_title');
 const {task,project}=await confirmTask(store,{extractionId:extraction.id,corrections:{title:"Book Ava's dentist",area:'family'},confirmedFields:['when','timeOfDay','person'],includeSteps:true});
 assert.equal(project.areaKey,'family');assert.equal(task.kind,'appointment');assert.equal(task.dueAt,'2026-11-18');assert.equal(task.dueTime,'15:00');assert.equal(task.forPerson,'Ava');
 assert.equal((await store.list('areas')).find(a=>a.key==='family')?.archived,false);
 const plan=await recommendPlan(store,null,task,NOW);assert.ok(plan.suggested.when&&plan.suggested.when.slice(0,10)<='2026-11-15');
 const reminders=await acceptPlan(store,{taskId:task.id,when:plan.suggested.when,label:plan.suggested.label,rationale:'',key:'bear',followUpIfUnpaid:true},NOW);
 assert.equal(reminders[0].billId,null);assert.equal(reminders.length,2);
 const due=await dueReminders(store,new Date(new Date(plan.suggested.when).getTime()+60000));
 assert.equal(due.length,1);assert.match(due[0].decision.message,/Book Ava's dentist/);assert.ok(!banned.test(due[0].decision.message));
 const home=await homeView(store,NOW);assert.ok(home.handling.lines.some(l=>/1 other thing being held/.test(l)));
 const everything=await everythingView(store);assert.equal(everything.areas.find(a=>a.key==='family')?.projects[0].taskId,task.id);
 const done=await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);
 assert.equal(done.win.title,"Book Ava's dentist");assert.equal(done.ledger.length,0);
 assert.equal((await everythingView(store)).archived,1);
});

test('the model understanding is used for images, with steps as dependency tasks',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const provider=new FakeProvider(()=>({kind:'school',summary:'Year 2 excursion to the museum. Permission form and $12 due by 14 November.',title:field('Return the excursion form'),area:field('family'),when:field('2026-11-14'),timeOfDay:empty(),person:field('Max'),location:empty(),isRecurring:field(false),steps:['Sign the form','Put $12 in an envelope','Hand it in at the office'],estimatedMinutes:5,extractedText:'Year 2 excursion ... permission form ... by 14 November',bill:null}));
 const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
 const {extraction}=await createCapture(store,provider,{method:'photo',file:{bytes:png,mime:'image/png',name:'note.png'}});
 assert.equal(extraction.kind,'task');assert.equal(extraction.general.kind,'school');assert.equal(extraction.general.steps.length,3);assert.equal(extraction.questions.length,0);
 const {task,steps}=await confirmTask(store,{extractionId:extraction.id,corrections:{},confirmedFields:['title','area','when','person'],includeSteps:true});
 assert.equal(steps.length,3);assert.equal((await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length,3);
 const home=await homeView(store,NOW);assert.ok(!home.needsYou.some(i=>steps.some(s=>s.id===i.taskId)),'steps never surface as separate needs');
 const everything=await everythingView(store);assert.equal(everything.areas.find(a=>a.key==='family').projects[0].openSteps,3);
});

// Seen in the live app: with the AI on, ordinary to-dos typed into the chat came back as bills.
const modelSays=(kind,over={})=>new FakeProvider(()=>({kind,summary:'x',title:field('Call mum'),area:field('family'),when:empty(),timeOfDay:empty(),person:empty(),location:empty(),isRecurring:field(false),steps:[],estimatedMinutes:5,extractedText:null,bill:null,...over}));
test('a to-do the model wrongly calls a bill (no amount, nobody to pay) is still set up as a to-do',async()=>{
 const {maybeAutoSetup}=await import('../lib/bear/services/auto-setup.ts');
 for(const text of ['call mum','book the car service next Tuesday','organise the birthday party']){
  const store=new MemoryBackend().for(USER);await onboard(store);
  const {extraction}=await createCapture(store,modelSays('bill'),{method:'text',text});
  assert.equal(extraction.kind,'task',`"${text}" is not a bill`);assert.notEqual(extraction.general.kind,'bill');
  assert.ok(await maybeAutoSetup(store,extraction,NOW),`"${text}" is set up straight away`);
 }
});
test('a real bill is still a bill, with or without the model',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const a=await createCapture(store,null,{method:'text',text:'Energy Australia bill $184.60 due 28 November 2026'});assert.equal(a.extraction.kind,'bill');
 const b=await createCapture(store,modelSays('bill'),{method:'text',text:'Sydney Water account. Amount due $96.40 by 3 December 2026'});assert.equal(b.extraction.kind,'bill','the rules found an amount, so the model’s "bill" stands');
});
test('the model is never told that what it is reading is a bill',async()=>{
 const {readFileSync}=await import('node:fs');const src=readFileSync(new URL('../lib/bear/ai/anthropic.ts',import.meta.url),'utf8');
 assert.ok(!/Bill text|attached bill/.test(src),'neutral framing only');
});
