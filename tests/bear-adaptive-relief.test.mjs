// Adaptive Responsibility Engine: relief events for real outcomes only, truthful reinforcement, optional feedback that is
// read cautiously, strategy and timing learning, her communication choice shaping pushes, and who carries each part.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload} from '../lib/bear/board/service.ts';
import {giveToBear,stepAction,detailView,momentFeedback,momentFeedbackSchema} from '../lib/bear/rre/service.ts';
import {completeTask,completeSchema} from '../lib/bear/services/completion.ts';
import {reliefMessage,reliefSummary,RELIEF_EVENTS} from '../lib/bear/adaptive/relief.ts';
import {giveFeedback,allowAgain} from '../lib/bear/adaptive/feedback.ts';
import {commsFilter} from '../lib/bear/adaptive/comms.ts';
import {scoreProfile} from '../lib/bear/adaptive/profile.ts';
import {saveAnswers} from '../lib/bear/adaptive/service.ts';
import {recommend} from '../lib/bear/rre/service.ts';

const MON=new Date('2026-11-23T20:00:00+11:00');const backend=new MemoryBackend();let n=0;
async function person(){const s=backend.for(`ad300000-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Sarah',onboardingComplete:true});return s;}

test('relief is recorded for real outcomes (captured, prepared, watched, finished), with where it came from and how sure',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Order a red scrunchie for Sarah by Friday',via:'text'},MON);const id=r.added[0].id;
 await giveToBear(s,null,id,MON);await stepAction(s,id,{action:'done'},MON);
 await completeTask(s,completeSchema.parse({taskId:(await unload(s,null,{text:'Water the plants',via:'text'},MON)).added[0].id,method:null}),MON);
 const sum=await reliefSummary(s,new Date('2026-11-01'));
 assert.ok(sum.responsibility_captured>=2&&sum.information_prepared===1&&sum.monitoring_established===1&&sum.responsibility_completed===1,JSON.stringify(sum));
 const ev=(await s.list('behaviour_events')).filter(e=>e.type==='relief');
 for(const e of ev){assert.ok(RELIEF_EVENTS.includes(e.detail.event));assert.ok(['user_confirmed','recipient_confirmed','system_record','unverified'].includes(e.detail.verified));assert.ok(!('text' in e.detail),'never her words');}
 assert.equal(ev.find(e=>e.detail.event==='responsibility_completed').detail.verified,'user_confirmed');
 assert.ok((await ensureProfile(s)).adaptive.timing.reduce((a,b)=>a+b,0)>=1,'finishing teaches Bear when she gets things done');
});
test('reinforcement says only what happened, in a way that suits her',()=>{
 assert.equal(reliefMessage('responsibility_completed'),'One less thing on your mind.');
 assert.equal(reliefMessage('responsibility_completed',{profile:scoreProfile({control:'plan_own',howDone:'in_advance'}),early:true}),'Sorted, ahead of time.');
 assert.equal(reliefMessage('responsibility_completed',{profile:scoreProfile({control:'plan_own',howDone:'in_advance'}),early:false}),'That’s sorted.');
 assert.equal(reliefMessage('responsibility_completed',{profile:scoreProfile({control:'depends_others'})}),'That’s sorted. Nothing more to do on it.');
 assert.match(reliefMessage('ownership_accepted',{who:'Daniel'}),/^Daniel accepted this\. You don’t need to organise it yourself\.$/);
 for(const e of RELIEF_EVENTS)assert.doesNotMatch(reliefMessage(e),/streak|minutes saved|hours|points|\d/,'no scores, no invented savings');
});
test('feedback is optional and cautious; strategy choices are learned; "don’t suggest" can be undone',async()=>{
 const s=await person();await saveAnswers(s,{answers:{control:'fixed_routine'}},MON);
 const r=await unload(s,null,{text:'Tidy the linen cupboard',via:'text'},MON);const id=r.added[0].id;
 const first=await recommend(s,{minutes:30,exclude:[]},MON,{});assert.equal(first.askFeedback,true);
 await giveFeedback(s,{taskId:id,kind:'dont_suggest',strategy:'match'},MON);
 const p=await ensureProfile(s);assert.equal(p.adaptive.suppressed.length,1);assert.equal(p.adaptive.feedback[0].kind,'dont_suggest');
 assert.equal((await recommend(s,{minutes:30,exclude:[]},MON,{})).askFeedback,false,'not asked again the same day');
 assert.equal((await recommend(s,{minutes:30,exclude:[]},MON,{})).recommendation,null,'respected');
 await allowAgain(s,{pattern:p.adaptive.suppressed[0].pattern,domain:p.adaptive.suppressed[0].domain});
 assert.ok((await recommend(s,{minutes:30,exclude:[]},MON,{})).recommendation,'allowed again');
 for(let i=0;i<3;i++)await momentFeedback(s,momentFeedbackSchema.parse({taskId:id,surface:'finish',response:'do_it',strategy:'offload'}),MON);
 assert.deepEqual((await ensureProfile(s)).adaptive.strategy.offload,{yes:3,no:0});
});
test('her choice of how Bear helps decides which reminders reach her phone (all still show in the app)',()=>{
 const it=(at,due)=>({reminder:{scheduledFor:at},task:{dueAt:due}});
 const items=[it('2026-11-24T08:00:00+11:00','2026-11-24'),it('2026-11-24T18:00:00+11:00','2026-11-30'),it('2026-11-25T09:00:00+11:00','2026-11-28')];
 assert.equal(commsFilter(items,null,'Australia/Sydney').length,3);assert.equal(commsFilter(items,'as_i_go','Australia/Sydney').length,3);
 assert.equal(commsFilter(items,'only_when_open','Australia/Sydney').length,0);
 assert.deepEqual(commsFilter(items,'important_only','Australia/Sydney').map(i=>i.task.dueAt),['2026-11-24']);
 assert.equal(commsFilter(items,'daily_checkin','Australia/Sydney').length,2,'one a day');
});
test('a task’s page says who is carrying each part, and the latest useful moment to act',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Order a red scrunchie for Sarah by Friday',via:'text'},new Date('2026-11-23T10:00:00+11:00'));
 const d=await detailView(s,r.added[0].id,new Date('2026-11-23T10:00:00+11:00'));
 assert.equal(d.carrying.labour.anticipation,'bear');assert.ok(['bear','you'].includes(d.carrying.labour.execution));
 assert.ok(d.carrying.latestUsefulActionAt&&d.carrying.latestUsefulActionAt<d.dueAt,'ordering online needs lead time');
});
test('relief policy integration: awareness and quiet backup plans; a push budget; her place kept when interrupted',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Call the dentist to book a check-up by Friday\nOrder a red scrunchie for Sarah by Friday',via:'text'},new Date('2026-11-23T10:00:00+11:00'));
 const {attributesOf}=await import('../lib/bear/adaptive/attributes.ts');
 for(const a of r.added){const d=await detailView(s,a.id,new Date('2026-11-23T10:00:00+11:00'));const t=await s.get('tasks',a.id);const at=attributesOf(t,t.rre,{status:d.status});
  assert.ok(['ready_for_her','understood_not_ready','prepared_for_approval'].includes(at.awareness),at.awareness);assert.ok(at.contingencies.some(c=>/deadline/.test(c.if)));}
 const items=[0,1,2,3,4].map(i=>({reminder:{scheduledFor:`2026-11-24T${String(8+i).padStart(2,'0')}:00:00+11:00`},task:{dueAt:i===4?'2026-11-24':'2026-12-10'}}));
 const kept=commsFilter(items,null,'Australia/Sydney');assert.equal(kept.length,3,'three a day');assert.ok(kept.some(i=>i.task.dueAt==='2026-11-24'),'due-today always gets through');
 const id=r.added[0].id;const {saveProgress}=await import('../lib/bear/board/service.ts');await saveProgress(s,id,{},new Date('2026-11-23T11:00:00+11:00'));
 const rec=await recommend(s,{minutes:20,exclude:[id===r.added[0].id?r.added[1].id:r.added[0].id]},new Date('2026-11-24T12:30:00+11:00'),{});
 if(rec.recommendation?.taskId===id)assert.match(rec.recommendation.note||'',/where you left off|ready/);
});
test('relief policy: consequence first, prepared before presenting, and nothing offered on a chaos day unless it matters',async()=>{
 const AT=new Date('2026-11-24T20:30:00+11:00');
 const s=await person();await unload(s,null,{text:'Pay the excursion levy by tomorrow\nTidy the linen cupboard',via:'text'},new Date('2026-11-24T19:00:00+11:00'));
 const r1=await recommend(s,{minutes:20,exclude:[]},AT,{});assert.match((await s.get('tasks',r1.recommendation.taskId)).title,/levy/i,'the deadline at risk comes first');
 const t=await unload(s,null,{text:'Reply to Mel about camp by Friday',via:'text'},AT);void t;
 const p=await ensureProfile(s);await s.update('profiles',p.id,{dayMode:'chaos',dayModeSetAt:AT.toISOString()});
 const r2=await recommend(s,{minutes:20,exclude:[]},AT,{});
 assert.ok(!r2.recommendation||/levy/i.test((await s.get('tasks',r2.recommendation.taskId)).title),'on a chaos day only what matters');
 const old=await recommend(s,{minutes:20,exclude:[]},AT,{BEAR_RELIEF_POLICY:'off'});assert.ok(old.recommendation||old.message,'rollback still works');
});
