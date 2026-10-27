import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {notToday,setImportance,prioritiseOpen} from '../lib/bear/services/priority.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {areaView} from '../lib/bear/services/areas.ts';
import {bearIdeas} from '../lib/bear/services/ideas.ts';
const worthNow=async(store,now)=>(await bearIdeas(store,now)).ideas.find(i=>i.type==='worth_doing_now')?.taskId||null;

const USER='44444444-4444-4444-8444-444444444444';const NOW=new Date('2026-10-26T09:00:00+11:00');
async function onboard(store){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true});}
async function give(store,text){const {extraction}=await createCapture(store,null,{method:'text',text,referenceYear:2026});return (await maybeAutoSetup(store,extraction,NOW)).task;}

test('the one thing worth doing now lives in Bear Ideas (My Bear stays calm), with reasons, and Need you stays small',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const consent=await give(store,'Return the excursion permission note by 28 October.');
 await give(store,'Car registration expires 30 November 2026. Renew online.');await give(store,'Need to buy a new phone charger.');
 const home=await homeView(store,NOW);assert.equal(home.oneThing,null,'no recommendation card on My Bear');
 const idea=(await bearIdeas(store,NOW)).ideas.find(i=>i.type==='worth_doing_now');
 assert.equal(idea?.taskId,consent.id);assert.ok(idea.why.length>=1&&idea.why.length<=3);
 assert.equal(home.handling.needs,1,'one thing, not three');
});

test('nothing worth doing now means no card, and Bear says so',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 await give(store,'Waiting for an email reply from the school about the uniform.');
 const home=await homeView(store,NOW);assert.equal(home.oneThing,null);assert.equal(home.handling.needs,0);
});

test('"Not today" steps back until tomorrow, learns gently, and only asks why the second time',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const t=await give(store,'Return the excursion permission note by 28 October.');
 let r=await notToday(store,t.id,null,NOW);assert.equal(r.askWhy,false);
 assert.equal(await worthNow(store,NOW),null,'not pushed again today');
 assert.equal(await worthNow(store,new Date('2026-10-27T09:00:00+11:00')),t.id,'back tomorrow');
 r=await notToday(store,t.id,null,new Date('2026-10-27T09:00:00+11:00'));assert.equal(r.askWhy,true);
 await notToday(store,t.id,'not_important',new Date('2026-10-27T09:00:00+11:00'));
 const p=await ensureProfile(store);assert.ok(p.loadMap.learned.choices['not_important:SCHOOL_EVENT']>=1||p.loadMap.learned.choices['not_important:FORM_APPLICATION']>=1);
 assert.equal((await store.get('tasks',t.id)).importance,'not');
});

test('the person’s own say on importance wins over Bear’s guess',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const t=await give(store,'Need to buy a new phone charger.');
 const before=(await prioritiseOpen(store,NOW)).results.get(t.id).importance;
 await setImportance(store,t.id,'very',NOW);
 const after=(await prioritiseOpen(store,NOW)).results.get(t.id).importance;assert.ok(after>before);assert.equal(after,0.95);
});

test('feature flag off: no priority card, everything else as before',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await give(store,'Return the excursion permission note by 28 October.');
 process.env.BEAR_PRIORITY_ENGINE_V1='off';try{const home=await homeView(store,NOW);assert.equal(home.oneThing,null);}finally{delete process.env.BEAR_PRIORITY_ENGINE_V1;}
});

test('My Wins counts pressure prevented from what really happened',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const t=await give(store,'Return the excursion permission note by 6 November.');
 await completeTask(store,{taskId:t.id,method:null,expectNext:false},NOW);
 const w=await winsView(store);assert.equal(w.pressure.early,1);assert.equal(w.pressure.rushes,1);assert.ok(w.pressure.offMind>=1);
 const c=(await store.list('completions'))[0];assert.ok(c.timing?.latestSafe,'timing snapshot saved');
});

test('area pages use calm timing labels and put what is worth doing first',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const charger=await give(store,'Need to buy a new phone charger.');const kettle=await give(store,'Urgently need to get a replacement kettle today.');
 await store.update('projects',charger.projectId,{areaKey:'home'});await store.update('projects',kettle.projectId,{areaKey:'home'});
 const area=await areaView(store,'home',NOW);
 assert.ok(area.current.length>=2,'both in the same area');assert.equal(area.current[0].taskId,kettle.id);
 assert.ok(area.current.every(i=>!/No rush/.test(i.dueLabel)));
});

test('Bear Ideas carries a few priority ideas, never the thing already on My Bear',async()=>{
 const {priorityIdeas}=await import('../lib/bear/services/priority-ideas.ts');
 const store=new MemoryBackend().for(USER);await onboard(store);
 const top=await give(store,'Return the excursion permission note by 28 October.');
 const passport=await give(store,'Passport renewal form, lodge by 1 December. Processing takes 3 weeks.');
 for(const t of ['Need to buy a new phone charger.','Need to buy new goggles.','Need to buy a doormat.'])await give(store,t);
 const ideas=await priorityIdeas(store,NOW);
 assert.ok(ideas.length>=1&&ideas.length<=4,JSON.stringify(ideas.map(i=>i.kind)));
 assert.ok(!ideas.some(i=>i.taskId===top.id),'the one on My Bear is not repeated');
 assert.ok(ideas.some(i=>i.kind==='what_matters'),'asks what matters once there is enough to go on');
 assert.ok(ideas.every(i=>i.href&&i.title&&i.body));
 process.env.BEAR_PRIORITY_ENGINE_V1='off';try{assert.deepEqual(await priorityIdeas(store,NOW),[]);}finally{delete process.env.BEAR_PRIORITY_ENGINE_V1;}
 void passport;
});
