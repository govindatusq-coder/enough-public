// Load Bear 2.0, Phase 3: category coverage, evidence-based anticipation, Bear Ideas integration and the
// internal Responsibility Transferred measure.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {areaView} from '../lib/bear/services/areas.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {bearIdeas,actOnIdea} from '../lib/bear/services/ideas.ts';
import {coverageView} from '../lib/bear/coverage/coverage-service.ts';
import {anticipateSchool} from '../lib/bear/coverage/expectations.ts';
import {responsibilityReport} from '../lib/bear/coverage/instrumentation.ts';
import {stamp} from '../lib/bear/store/store.ts';

const USER='99999999-9999-4999-8999-999999999999';const NOW=new Date('2026-11-03T09:00:00+11:00');const day=n=>new Date(NOW.getTime()+n*86400000);
async function setup(){const s=new MemoryBackend().for(USER);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true,people:[{role:'child',name:'Lily'}]});return s;}
async function give(s,text,now=NOW){const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});return (await maybeAutoSetup(s,extraction,now))?.task;}
const CAMP='Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November. Students need a sleeping bag, water bottle and enclosed shoes.';
const PHOTOS='School photos are on Thursday 20 November. Order online at www.msp.com.au using code KX72P by 18 November.';
// A finished school item from last year, as history.
async function lastYear(s,kind,date,title){const t=await s.insert('tasks',stamp(USER,{projectId:'00000000-0000-4000-8000-000000000001',kind:'school',title,status:'done',dueAt:null,estimatedMinutes:5,cognitiveEffort:'low',forPerson:null,isDemo:false,load:{version:1,primaryId:'p',nodes:[{id:'p',pattern:'SCHOOL_EVENT',role:'primary',parentId:null,title,confidence:1,entities:{school:{event:title,kind,date,endDate:null,child:null,obligations:[]}},steps:[],state:'resolved',waiting:null,evidence:[],resolvedAt:null,clarification:null,gate:null}],createdAt:date,updatedAt:date}}));return t;}

test('coverage is offered once a few school notices come in, through Bear Ideas, and only once',async()=>{
 const s=await setup();await give(s,CAMP);
 assert.ok(!(await bearIdeas(s,NOW)).ideas.some(i=>i.type==='expand_coverage'),'not after one notice');
 await give(s,PHOTOS);
 const offer=(await bearIdeas(s,NOW)).ideas.find(i=>i.type==='expand_coverage');assert.ok(offer);assert.match(offer.body,/only sees what you give it/);
 await actOnIdea(s,{ideaId:offer.id,type:offer.type,action:'activate_pack'},NOW);
 assert.ok(!(await bearIdeas(s,day(1))).ideas.some(i=>i.type==='expand_coverage'));
});
test('with School admin on: one quiet line on My Bear, items grouped in the area, honest transparency in Settings',async()=>{
 const s=await setup();await give(s,CAMP);await give(s,PHOTOS);
 assert.equal((await homeView(s,NOW)).coverage,null,'off by default: My Bear unchanged');
 const offer=(await bearIdeas(s,NOW)).ideas.find(i=>i.type==='expand_coverage');await actOnIdea(s,{ideaId:offer.id,type:offer.type,action:'activate_pack'},NOW);
 const h=await homeView(s,NOW);assert.deepEqual(h.coverage,{label:'School admin',line:'Bear is keeping track of 2 things',href:'/bear/areas/family'});
 const area=await areaView(s,'family',NOW);assert.ok(area.current.every(i=>i.project?.title==='School admin'&&i.project.virtual));
 const v=(await coverageView(s,NOW)).packs[0];assert.equal(v.active,true);assert.equal(v.tracked,2);
 assert.ok(v.cannotSee.some(l=>/only sees school notices you give it/i.test(l)),'never implies Bear watches all school messages');
 assert.ok(v.needsYouLines[0].includes('always yours'));
});
test('anticipation comes only from this person’s own history, worded as a possibility',async()=>{
 const s=await setup();
 assert.deepEqual(anticipateSchool(await s.list('tasks'),'2026-11-03'),[],'no generic “Australian schools” guesses');
 await lastYear(s,'photos','2025-11-18','School photos');
 const i=(await bearIdeas(s,NOW)).ideas.find(x=>x.id==='watch:photos:2026');assert.ok(i);
 assert.match(i.title,/around this time last year/);assert.match(i.body,/Nothing has been confirmed yet/);
 // Once this year's notice is in, it's confirmed: no anticipation.
 await give(s,PHOTOS);assert.ok(!(await bearIdeas(s,NOW)).ideas.some(x=>x.id==='watch:photos:2026'));
});
test('“check with me” comes back once, in two weeks; “not this year” means not this year',async()=>{
 const s=await setup();await lastYear(s,'book_week','2025-11-25','Book Week parade');
 const w=(await bearIdeas(s,NOW)).ideas.find(x=>x.id==='watch:book_week:2026');await actOnIdea(s,{ideaId:w.id,type:w.type,action:'watch'},NOW);
 assert.ok(!(await bearIdeas(s,day(3))).ideas.some(x=>x.entity==='anticipate:book_week'),'quiet in between');
 const ask=(await bearIdeas(s,day(14))).ideas.find(x=>x.id==='ask:book_week:2026');assert.ok(ask);assert.equal(ask.href,'/bear/capture');
 await actOnIdea(s,{ideaId:ask.id,type:ask.type,action:'not_this_year'},day(14));
 assert.ok(!(await bearIdeas(s,day(20))).ideas.some(x=>x.entity==='anticipate:book_week'));
});
test('school candidates go through the same orchestrator: never more than five ideas',async()=>{
 const s=await setup();for(const t of [CAMP,PHOTOS,'Parent-teacher interviews are on 25 and 26 November. Book a time at schoolinterviews.com.au using code ABC12.','Book Week parade is on 28 November. Students can dress as their favourite book character.','The swimming carnival is on 3 December. Please update the medical form on Operoo by 28 November.'])await give(s,t);
 await lastYear(s,'fundraiser','2025-11-20','Colour run');
 assert.ok((await bearIdeas(s,NOW)).ideas.length<=5);
});
test('Responsibility Transferred counts only real system events',async()=>{
 const s=await setup();const t=await give(s,CAMP);
 let r=await responsibilityReport(s,'2026-11-03');
 assert.equal(r.obligations,1);assert.ok(r.operationsByBear.understand>=1,'extraction counts as understanding');
 assert.ok(r.operationsByBear.remember>=1,'a date Bear holds counts as remembering');
 assert.ok(!r.operationsByBear.monitor,'Bear can’t monitor an outside outcome');
 assert.ok(!r.operationsByBear.close,'nothing is closed yet');
 await completeTask(s,{taskId:t.id,method:null,expectNext:false},NOW);
 r=await responsibilityReport(s,'2026-11-03');assert.equal(r.confirmations.user_confirmed,1);
 const ev=(await s.list('behaviour_events')).find(e=>e.type==='responsibility_op');assert.ok(ev);assert.equal(ev.detail.evidence,'user_confirmed');
 assert.ok(!JSON.stringify(ev.detail).includes('camp'),'no notice text in research events');
});
test('My Wins: school notices organised, counted from real extractions only',async()=>{
 const s=await setup();await give(s,CAMP);await give(s,PHOTOS);
 const w=await winsView(s,NOW);assert.equal(w.strategic.organised,2);assert.equal(w.strategic.confirmedByEmail,0);
});
test('flag off: no coverage, no school ideas, My Bear unchanged',async()=>{
 process.env.BEAR_RESPONSIBILITY_ENGINE_ENABLED='off';try{const s=await setup();await give(s,CAMP);await give(s,PHOTOS);
  assert.ok(!(await bearIdeas(s,NOW)).ideas.some(i=>i.type==='expand_coverage'));}finally{delete process.env.BEAR_RESPONSIBILITY_ENGINE_ENABLED;}
});
