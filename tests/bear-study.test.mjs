// Research study: off by default, code + consent to join, schedule, scoring, validation, withdrawal with
// deletion, the check-in card, and a pseudonymous export with no household content.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {joinStudy,respondStudy,leaveStudy,studyStatus} from '../lib/bear/study/service.ts';
import {nextDue,STUDY_WEEKS} from '../lib/bear/study/schedule.ts';
import {scoreSUS,scoreTLX,validateAnswers,TLX,SUS,WEEKLY} from '../lib/bear/study/instruments.ts';
import {buildStudyExport,toCSV} from '../lib/bear/study/export.ts';
import {bearIdeas} from '../lib/bear/services/ideas.ts';

const NOW=new Date('2026-11-10T09:00:00+11:00');const day=n=>new Date(NOW.getTime()+n*86400000);
const on=()=>{process.env.BEAR_STUDY_ENABLED='on';process.env.BEAR_STUDY_CODE='BEAR-2026';process.env.BEAR_STUDY_ID='loadbear-pilot-1';};
const off=()=>{delete process.env.BEAR_STUDY_ENABLED;delete process.env.BEAR_STUDY_CODE;delete process.env.BEAR_STUDY_ID;};
async function person(backend,id){const s=backend.for(id);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true});return s;}
const all=(inst,v)=>Object.fromEntries(inst.items.map(i=>[i.id,typeof v==='function'?v(i):v]));

test('off unless enabled; joining needs the right code and consent',async()=>{
 const s=await person(new MemoryBackend(),'aaaaaaaa-0000-4000-8000-000000000001');
 off();assert.deepEqual(await studyStatus(s,NOW),{available:false});
 on();try{
  assert.equal((await studyStatus(s,NOW)).enrolled,false,'nobody is enrolled by default');
  await assert.rejects(joinStudy(s,'WRONG',NOW),/doesn’t match/);
  const st=await joinStudy(s,' bear-2026 ',NOW);assert.equal(st.enrolled,true);assert.equal(st.due.phase,'baseline');assert.equal(st.endsOn,'2026-12-22');
 }finally{off();}
});
test('schedule: baseline, weekly check-ins for weeks 1–5, final at week 6, nothing twice, missed weeks not carried',()=>{
 const E='2026-11-10';const done=[];
 assert.deepEqual(nextDue(E,E,done).instruments,['context','tlx']);
 done.push({phase:'baseline',week:0,instrument:'context'},{phase:'baseline',week:0,instrument:'tlx'});
 assert.equal(nextDue(E,'2026-11-12',done),null,'quiet in week 0 after the baseline');
 assert.deepEqual(nextDue(E,'2026-11-17',done),{phase:'weekly',week:1,instruments:['weekly'],label:'Weekly check-in (about a minute)'});
 done.push({phase:'weekly',week:1,instrument:'weekly'});assert.equal(nextDue(E,'2026-11-18',done),null);
 assert.equal(nextDue(E,'2026-12-01',done).week,3,'week 2 missed, not carried over');
 assert.deepEqual(nextDue(E,'2026-12-22',done).instruments,['context','tlx','sus']);assert.equal(nextDue(E,'2027-03-01',done).phase,'end');
 done.push(...['context','tlx','sus'].map(i=>({phase:'end',week:STUDY_WEEKS,instrument:i})));assert.equal(nextDue(E,'2027-03-01',done),null);
});
test('scoring: raw TLX is the mean of six; SUS follows the standard formula',()=>{
 assert.equal(scoreTLX(all(TLX,50)),50);assert.equal(scoreTLX({tlx_mental:50}),null);
 assert.equal(scoreSUS(all(SUS,i=>+i.id.split('_')[1]%2?5:1)),100);assert.equal(scoreSUS(all(SUS,3)),50);assert.equal(scoreSUS({sus_1:5}),null);
});
test('validation: numbers in range only, unknown items rejected, every question skippable',()=>{
 assert.equal(validateAnswers('weekly',{admin_minutes:120}).ok,true,'partial answers are fine');
 assert.equal(validateAnswers('weekly',{mental_load:11}).ok,false);assert.equal(validateAnswers('weekly',{note:'free text'}).ok,false);
 assert.equal(validateAnswers('weekly',{}).ok,false);assert.equal(validateAnswers('weekly',{admin_minutes:'lots'}).ok,false);
 assert.ok(WEEKLY.items.every(i=>i.kind==='scale'||i.kind==='number'),'no free-text items at all');
});
test('only what is due can be answered; no duplicates or back-filling',async()=>{
 on();try{const s=await person(new MemoryBackend(),'aaaaaaaa-0000-4000-8000-000000000002');await joinStudy(s,'BEAR-2026',NOW);
  await assert.rejects(respondStudy(s,{phase:'weekly',week:1,instrument:'weekly',answers:{admin_minutes:60}},NOW),/isn’t due/);
  await respondStudy(s,{phase:'baseline',week:0,instrument:'context',answers:{share_carried:80,admin_minutes:300}},NOW);
  await assert.rejects(respondStudy(s,{phase:'baseline',week:0,instrument:'context',answers:{share_carried:80}},NOW),/isn’t due/);
  const st=await respondStudy(s,{phase:'baseline',week:0,instrument:'tlx',answers:all(TLX,60)},NOW);assert.equal(st.due,null);
  assert.equal((await studyStatus(s,day(7))).due.phase,'weekly');
 }finally{off();}
});
test('participants get one quiet check-in card in Bear Ideas when something is due; nobody else does',async()=>{
 on();try{const b=new MemoryBackend();const s=await person(b,'aaaaaaaa-0000-4000-8000-000000000003');const other=await person(b,'aaaaaaaa-0000-4000-8000-000000000004');
  await joinStudy(s,'BEAR-2026',NOW);
  const card=(await bearIdeas(s,NOW)).ideas.find(i=>i.type==='study');assert.ok(card);assert.equal(card.href,'/bear/study');
  assert.ok(!(await bearIdeas(other,NOW)).ideas.some(i=>i.type==='study'));
 }finally{off();}
});
test('leaving: consent off straight away, answers deleted if asked, and Bear works the same',async()=>{
 on();try{const s=await person(new MemoryBackend(),'aaaaaaaa-0000-4000-8000-000000000005');await joinStudy(s,'BEAR-2026',NOW);
  await respondStudy(s,{phase:'baseline',week:0,instrument:'context',answers:{share_carried:70}},NOW);
  await leaveStudy(s,true,NOW);assert.equal((await studyStatus(s,NOW)).enrolled,false);assert.equal((await s.list('study_responses')).length,0);
  assert.ok(!(await bearIdeas(s,NOW)).ideas.some(i=>i.type==='study'));
 }finally{off();}
});
test('export: consenting, non-withdrawn participants only; pseudonymous; numbers only; no household content',async()=>{
 on();try{const b=new MemoryBackend();
  const a=await person(b,'aaaaaaaa-0000-4000-8000-000000000006');const c=await person(b,'aaaaaaaa-0000-4000-8000-000000000007');const w=await person(b,'aaaaaaaa-0000-4000-8000-000000000008');
  for(const s of [a,w]){await joinStudy(s,'BEAR-2026',NOW);await respondStudy(s,{phase:'baseline',week:0,instrument:'tlx',answers:all(TLX,40)},NOW);}
  await leaveStudy(w,false,NOW);
  const {extraction}=await createCapture(a,null,{method:'text',text:'Year 5 camp is on 18 November. Payment of $180 is due 12 November.',referenceYear:2026});await maybeAutoSetup(a,extraction,NOW);
  const out=await buildStudyExport([a,c,w],{secret:'a-long-study-secret-123',studyId:'loadbear-pilot-1',today:'2026-11-10'});
  assert.equal(out.participants.length,1);assert.equal(out.excluded,2,'not enrolled, and withdrawn');
  assert.equal(out.responses.length,1);assert.equal(out.responses[0].score,40);
  const text=JSON.stringify(out)+toCSV(out.participants);for(const leak of ['camp','Sarah','180','Year 5',a.userId])assert.ok(!text.includes(leak),leak);
  await assert.rejects(buildStudyExport([a],{secret:'short',studyId:'x',today:'2026-11-10'}),/study_secret_required/);
 }finally{off();}
});
