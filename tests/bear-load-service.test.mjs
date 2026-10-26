import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {rhythmPresets} from '../lib/bear/domain/labels.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {actOnLoad,readLoad} from '../lib/bear/services/load.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {reopenTask,updateTask} from '../lib/bear/services/task-edit.ts';
import {stamp} from '../lib/bear/store/store.ts';
import {learnFromAction,learnBillLead,resetLearned,loadMapSchema} from '../lib/bear/load/loadmap.ts';
import {understand} from '../lib/bear/load/engine.ts';
import {currentCapabilities} from '../lib/bear/load/types.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
const field=(value,confidence=0.95)=>({value,confidence,evidence:null});const empty=()=>({value:null,confidence:0,evidence:null});
const campReader=()=>new FakeProvider(()=>({kind:'school',summary:'Year 5 camp 17–19 November. Consent and $120 due Friday.',title:field('Year 5 camp'),area:field('family'),when:field('2026-10-30'),timeOfDay:empty(),person:empty(),location:empty(),isRecurring:field(false),timing:field('time_sensitive'),size:field('one_go'),steps:[],items:[],estimatedMinutes:10,extractedText:null,bill:null}));

const USER='33333333-3333-4333-8333-333333333333';const NOW=new Date('2026-10-26T09:00:00+11:00');
async function onboard(store,extra={}){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['family','home','money'],lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},onboardingComplete:true,...extra});}
const CAMP='YEAR 5 CAMP\n17–19 November\nConsent and $120 payment due Friday 30 October.\nStudents need sleeping bag, hat, water bottle and enclosed shoes.';

test('a real capture runs through the engine: the task carries its load, and Home shows only what needs you',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,campReader(),{method:'text',text:CAMP,referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);
 assert.equal(task.load.nodes[0].pattern,'SCHOOL_EVENT');
 const {view}=await readLoad(store,task,NOW);
 assert.equal(view.needsYou.headline,'Consent is due Friday');
 const home=await homeView(store,NOW);
 const need=home.needsYou.find(n=>n.taskId===task.id);assert.equal(need.message,'Consent is due Friday');
 assert.equal(home.handling.needs,1);
});

test('acting on the load moves to the next one thing, then to nothing, and only the event closes it',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,campReader(),{method:'text',text:CAMP,referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);
 let {view}=await readLoad(store,task,NOW);
 let r=await actOnLoad(store,task.id,{stepId:view.needsYou.stepId},NOW);assert.equal(r.said,'Consent sorted.');assert.equal(r.view.needsYou.headline,'Pay $120');
 r=await actOnLoad(store,task.id,{stepId:r.view.needsYou.stepId},NOW);assert.equal(r.view.needsYou,null);assert.equal(r.task.status,'open','paid, but camp has not happened');
 const home=await homeView(store,NOW);assert.equal(home.needsYou.some(n=>n.taskId===task.id),false,'nothing for you to do');
 // Bear said packing will come back: a reminder really exists for that day.
 const reminders=(await store.list('reminders',{where:[{column:'task_id',value:task.id}]})).filter(x=>x.status==='scheduled'&&x.plan.windowId==='load');
 assert.equal(reminders.length,1);assert.match(reminders[0].message,/Packing/);
});

test('"Done, it’s sorted" closes the load; making it current again reopens it',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Need to buy a new phone charger',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);
 await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);
 let t=await store.get('tasks',task.id);assert.equal(t.load.nodes[0].state,'resolved');
 await reopenTask(store,task.id);t=await store.get('tasks',task.id);assert.notEqual(t.load.nodes[0].state,'resolved');
});

test('existing items are mapped conservatively: bills to BILL_PAYMENT, everything else to an unknown, captured load',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const project=await store.insert('projects',stamp(USER,{areaKey:'home',title:'Old thing',status:'active',dueAt:null,resourceDocumentIds:[],billId:null}));
 const old=await store.insert('tasks',stamp(USER,{projectId:project.id,kind:'custom',title:'Sort the garage',status:'open',dueAt:null,estimatedMinutes:5,cognitiveEffort:'low',forPerson:null,isDemo:false}));
 const {graph,view,migrated}=await readLoad(store,old,NOW);
 assert.equal(migrated,true);assert.equal(graph.nodes[0].pattern,'UNKNOWN_LOAD');assert.equal(graph.nodes[0].state,'covered');
 assert.equal(view.needsYou,null,'old items are not interrogated');
 const home=await homeView(store,NOW);assert.ok(!home.needsYou.some(n=>n.taskId===old.id&&n.message),'no engine actions for migrated items');
});

test('a date the person adds is a new fact: Bear stops asking and re-plans',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Car registration renewal',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);
 let {view}=await readLoad(store,task,NOW);assert.match(view.needsYou.headline,/When does .* expire\?/);
 await updateTask(store,task.id,{dueAt:'2026-12-01'});
 ({view}=await readLoad(store,await store.get('tasks',task.id),NOW));
 assert.equal(view.needsYou,null,'nothing until two weeks before');assert.match(view.covered[0],/renews by/);
});

test('learning is small, visible and resettable; nothing sensitive is inferred',()=>{
 let map={domains:{home:true}};
 map=learnBillLead(map,5);assert.equal(map.learned.billLeadDays,undefined,'once is not a pattern');
 map=learnBillLead(map,5);assert.equal(map.learned.billLeadDays,5);
 map=learnFromAction(map,{pattern:'REPAIR_PROBLEM',evidence:'contacted',provider:'Plumber'});map=learnFromAction(map,{pattern:'REPAIR_PROBLEM',evidence:'contacted',provider:'Plumber'});
 const {graph}=understand({text:'The kitchen tap is leaking',today:'2026-10-26',caps:currentCapabilities(),loadMap:map});
 assert.match(graph.nodes[0].steps.find(s=>s.key==='contact').label,/plumber/i,'the usual plumber is suggested');
 map=resetLearned(map);assert.deepEqual(map.learned,{});assert.deepEqual(map.providers,[]);
 assert.ok(loadMapSchema.safeParse(map).success);
 assert.equal(loadMapSchema.safeParse({domains:{},gender:'female'}).success,false,'no demographic fields exist');
});

test('people who forget until it is urgent get things back earlier',()=>{
 const caps=currentCapabilities();const text='AGL electricity bill $184.20 due 10 November 2026';
 const plain=understand({text,today:'2026-10-26',caps}).graph.nodes[0].steps.find(s=>s.key==='pay').surfaceFrom;
 const early=understand({text,today:'2026-10-26',caps,loadMap:{domains:{},cognitiveProfile:{remembering:5}}}).graph.nodes[0].steps.find(s=>s.key==='pay').surfaceFrom;
 assert.equal(plain,'2026-11-07');assert.equal(early,'2026-11-05');
});
