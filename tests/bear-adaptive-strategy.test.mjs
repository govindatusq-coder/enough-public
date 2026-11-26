// Adaptive Responsibility Engine, strategy selection: identical to Got a Moment's own choice with no profile; with one,
// the window allows for getting started and interruptions, business hours and readiness are respected, what Bear can
// prepare or hand on is favoured for those with little control, nothing-fits offers a useful alternative or a break.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload} from '../lib/bear/board/service.ts';
import {recommend} from '../lib/bear/rre/service.ts';
import {saveAnswers} from '../lib/bear/adaptive/service.ts';
import {weightsFor,effectiveWindow,BASE_WEIGHTS,STRATEGIES} from '../lib/bear/adaptive/strategy.ts';
import {scoreProfile} from '../lib/bear/adaptive/profile.ts';
import {conditionFor} from '../lib/bear/adaptive/flags.ts';

const TUE_LUNCH=new Date('2026-11-24T12:30:00+11:00'),TUE_NIGHT=new Date('2026-11-24T20:30:00+11:00');
const backend=new MemoryBackend();let n=0;const env={};
async function person(answers){const s=backend.for(`ad200000-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Sarah',onboardingComplete:true});if(answers)await saveAnswers(s,{answers},TUE_LUNCH);return s;}
// These tests pin the earlier adaptive scoring (still available for comparison and rollback).
const ask=(s,minutes,at,extra={})=>recommend(s,{minutes,exclude:[],...extra},at,{BEAR_RELIEF_POLICY:'off'});

test('seven strategies, versioned weights blended by profile, a window that allows for real life',()=>{
 assert.deepEqual(STRATEGIES.map(x=>x.id),['allocate','prioritise','synchronise','adapt','match','offload','protect']);
 assert.deepEqual(weightsFor(null),BASE_WEIGHTS);
 const oncall=weightsFor(scoreProfile({control:'depends_others'}));const planner=weightsFor(scoreProfile({control:'plan_own',howDone:'in_advance'}));
 assert.ok(oncall.relief>planner.relief&&oncall.effort>planner.effort);assert.ok(planner.deadline>oncall.deadline);
 assert.equal(effectiveWindow(10,false,null),10,'no profile: her minutes as she said');
 assert.ok(effectiveWindow(10,false,scoreProfile({control:'depends_others'}))<effectiveWindow(10,false,scoreProfile({control:'fixed_routine'})),'less predictable days leave more room');
 assert.equal(effectiveWindow(30,true,null),5,'not sure: a small step');
});
test('no answers: exactly the choice Got a Moment always made',async()=>{
 const s=await person(null);await unload(s,null,{text:'Call the dentist to book a check-up\nReply to the school email about camp',via:'text'},TUE_LUNCH);
 const r=await ask(s,10,TUE_LUNCH);assert.equal(r.adaptive,false);assert.ok(r.recommendation);assert.ok(r.recommendation.strategy);assert.ok(r.recommendation.primary.label);
});
test('around a routine: in business hours the call is the one to do; at night it waits and something else is offered',async()=>{
 const s=await person({control:'fixed_routine',howDone:'routine'});
 await unload(s,null,{text:'Call the council about the bins\nTidy the linen cupboard',via:'text'},TUE_LUNCH);
 const day=await ask(s,20,TUE_LUNCH);assert.equal(day.adaptive,true);assert.match(day.recommendation.title,/council/i);
 assert.equal(day.recommendation.strategy,'synchronise');assert.equal(day.recommendation.primary.label,'Make the call');assert.match(day.recommendation.note,/open now/);
 const night=await ask(s,20,TUE_NIGHT);assert.doesNotMatch(night.recommendation?.title||'',/council/i,'businesses are closed');
});
test('little control over her time: a ten-minute gap is not ten minutes of doing; Bear’s part comes first',async()=>{
 const s=await person({control:'depends_others',helpers:'regularly'});
 await unload(s,null,{text:'Organise Christmas presents\nReply to the school email about camp',via:'text'},TUE_NIGHT);
 const r=await ask(s,10,TUE_NIGHT);assert.ok(r.recommendation);
 assert.ok(r.recommendation.window<10,`window ${r.recommendation.window}`);assert.ok(r.recommendation.minutes<=r.recommendation.window);
});
test('not sure how long: a small step she can stop part-way',async()=>{
 const s=await person({control:'flexible_changing',howDone:'grab_moment'});
 await unload(s,null,{text:'Reply to Mel about Saturday\nDeclutter the garage',via:'text'},TUE_NIGHT);
 const r=await ask(s,10,TUE_NIGHT,{unsure:true});assert.ok(r.recommendation);assert.equal(r.recommendation.window,5);assert.equal(r.recommendation.strategy==='match'||r.recommendation.strategy==='offload'||r.recommendation.strategy==='prioritise',true);
 assert.ok(r.recommendation.minutes<=5);
});
test('nothing fits: something useful instead (Bear prepares, someone else, set time aside) or simply a break',async()=>{
 const carer=await person({control:'depends_others',helpers:'regularly'});await unload(carer,null,{text:'Declutter the garage',via:'text'},TUE_NIGHT);
 const a=await ask(carer,2,TUE_NIGHT);assert.equal(a.recommendation,null);assert.ok(a.alternative);assert.ok(['offload','protect'].includes(a.alternative.kind));
 const empty=await person({control:'plan_own'});const b=await ask(empty,10,TUE_NIGHT);assert.equal(b.recommendation,null);assert.equal(b.alternative.kind,'protect');assert.match(b.message,/A break counts too/);
});
test('“Don’t suggest this kind of thing” is respected; experiments never run in production',async()=>{
 const s=await person({control:'fixed_routine'});await unload(s,null,{text:'Tidy the linen cupboard',via:'text'},TUE_NIGHT);
 const first=await ask(s,30,TUE_NIGHT);assert.ok(first.recommendation);
 const p=await ensureProfile(s);await s.update('profiles',p.id,{adaptive:{...(p.adaptive||{}),category:[],corrections:[],strategy:{},timing:Array(24).fill(0),feedback:[],lastFeedbackAskAt:null,suppressed:[{pattern:'chore',domain:'cleaning_laundry',at:TUE_NIGHT.toISOString()}]}});
 const again=await ask(s,30,TUE_NIGHT);assert.equal(again.recommendation,null);
 assert.equal(conditionFor({BEAR_ENGINE_CONDITION:'A'},true),'A');assert.equal(conditionFor({BEAR_ENGINE_CONDITION:'A',VERCEL_ENV:'production'},true),'E');
 assert.equal(conditionFor({},false),'B');
});
