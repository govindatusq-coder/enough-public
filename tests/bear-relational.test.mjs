// Relational Priority: people, past self, present self, future self and reality, with the hidden
// power / loss / meaning layer. These fixtures check BOTH that Bear reasons well AND that the person
// never has to read or do more because of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {confirmBill} from '../lib/bear/services/task-inference.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {notToday,prioritiseOpen,priorityView,whyView,setImportance,setReliance} from '../lib/bear/services/priority.ts';
import {bearIdeas} from '../lib/bear/services/ideas.ts';
import {interpret,otherPeople,pastSelfEvidence,futureSelf,personName} from '../lib/bear/priority/relational.ts';
import {stamp} from '../lib/bear/store/store.ts';

const USER='77777777-7777-4777-8777-777777777777';const NOW=new Date('2026-10-27T09:00:00+11:00');
const day=n=>new Date(NOW.getTime()+n*86400000);
async function setup(){const store=new MemoryBackend().for(USER);await ensureProfile(store);await saveProfile(store,{name:'Sarah',areas:['work','family','home','money','health','me'],onboardingComplete:true});return store;}
async function give(store,text){const {extraction}=await createCapture(store,null,{method:'text',text,referenceYear:2026});return (await maybeAutoSetup(store,extraction,NOW)).task;}
async function read(store,texts,now=NOW){const ts=[];for(const t of texts)ts.push(await give(store,t));const pr=await prioritiseOpen(store,now);return {pr,get:i=>pr.results.get(ts[i].id),rel:i=>pr.relational.get(ts[i].id),ts};}
const words=r=>r.explanation.reasons.map(x=>`${x.title} ${x.text}`).join(' | ');
// Internal constructs must never reach the person.
const INTERNAL=/\b(power|threat|loss exposure|meaning score|leverage|psychological availability|future option|neglect\w*|saturat\w*|score|relational|ptm|past self|present self|future self|senior|junior|owe)\b|\d\.\d/i;

// ---------- other people ----------
test('1. a student waiting on your supervision: responsibility, not rank',async()=>{
 const s=await setup();const {get,rel}=await read(s,['Review Maya’s chapter']);
 assert.ok(rel(0).waiting);assert.ok(rel(0).lift>0);
 assert.match(words(get(0)),/Maya is waiting on your feedback/);assert.match(words(get(0)),/This matters to your role/);
 assert.doesNotMatch(words(get(0)),INTERNAL);
});
test('2. a senior collaborator offering an opportunity: the opportunity counts, the seniority doesn’t',async()=>{
 const s=await setup();const {get,rel}=await read(s,['Reply to Professor Smith about the collaboration invitation','Reply to Professor Smith about the parking permit','Reply to Tom about the parking permit']);
 assert.match(words(get(0)),/useful relationship to keep moving/);assert.ok(rel(0).lift>rel(1).lift);
 assert.ok(Math.abs(get(1).importance-get(2).importance)<0.02,'a title alone adds nothing');
});
test('3. a junior colleague asking for mentoring: contribution, phrased kindly',async()=>{
 const s=await setup();const {get}=await read(s,['Review Sam’s paper draft']);
 assert.match(words(get(0)),/Your input could help Sam move this forward/);assert.doesNotMatch(words(get(0)),INTERNAL);
});
test('4 & 5. pressure is not importance: a pushy meeting request ranks below calling Mum',async()=>{
 const s=await setup();const {get,rel}=await read(s,['Meeting request from Tom again, he keeps asking','Call Mum']);
 assert.ok(rel(0).lift<=0.001,'chasing adds nothing');assert.ok(get(1).importance>get(0).importance);
 assert.match(words(get(1)),/people you care about/);
});
test('6. a shared household task: delay lands on someone else',async()=>{
 const s=await setup();const {get}=await read(s,['Put the bins out before my partner gets home']);
 assert.match(words(get(0)),/Keeps the load shared/);
});
test('7. a hard deadline still comes first (reality gate)',async()=>{
 const s=await setup();const {pr,get}=await read(s,['Return the excursion permission note by 28 October.','Call Mum','Review Sam’s paper draft']);
 assert.equal(pr.top.id,get(0).id);
});
test('8. strategic work without a deadline: protected, never given a fake one',async()=>{
 const s=await setup();
 const p=await s.insert('projects',stamp(USER,{areaKey:'work',title:'Manuscript',status:'active',dueAt:null,resourceDocumentIds:[],billId:null,importance:'very',role:'progress',createdAt:day(-21).toISOString()}));
 const t=await give(s,'Draft the Discussion argument');await s.update('tasks',t.id,{projectId:p.id});
 const r=(await prioritiseOpen(s,NOW)).results.get(t.id);assert.equal(r.deadline,null);
 const i=(await bearIdeas(s,NOW)).ideas.find(x=>x.type==='protect_time');assert.ok(i);assert.equal(i.eyebrow,'Worth protecting time for');
 assert.match(i.why.map(w=>w.text).join(' '),/hasn’t had much room lately/);
});
test('9. something enjoyable and low-stakes: not pushed, but not treated as worthless',async()=>{
 const s=await setup();const {get,rel}=await read(s,['Go to the concert with friends']);
 assert.equal(get(0).surfaceNow,false);assert.ok(rel(0).lift>=0);assert.match(words(get(0)),/Good for you now/);
});
test('10. aversive but important: more support, not more nagging, and importance holds',async()=>{
 const s=await setup();const t=await give(s,'Car registration expires 30 November 2026. Renew online.');
 const before=(await prioritiseOpen(s,NOW)).results.get(t.id).importance;
 for(let k=0;k<3;k++)await notToday(s,t.id,null,day(k));
 const r=(await prioritiseOpen(s,day(3))).results.get(t.id);assert.equal(r.support,'prepare_more');assert.ok(Math.abs(r.importance-before)<0.001);
});
test('11–13. loss exposure: financial, relational, opportunity',()=>{
 const f=interpret('Claim the $120 health fund refund','UNKNOWN_LOAD',[],[]);assert.ok(f.lossExposure.financial>0);
 const people=otherPeople('Reply to Jenny, I promised I’d send the data','UNKNOWN_LOAD');assert.ok(people[0].commitment&&people[0].waiting);
 assert.ok(interpret('Reply to Jenny, I promised I’d send the data','UNKNOWN_LOAD',people,[]).lossExposure.relational>0);
 const o=interpret('Contact the industry partner before the grant round','UNKNOWN_LOAD',otherPeople('Contact the industry partner before the grant round','UNKNOWN_LOAD'),[]);
 assert.ok(o.lossExposure.opportunity>0);assert.ok(futureSelf('Contact the industry partner before the grant round').futureOptionValue>0);
});
test('12b. someone blocked on a quick thing: worth closing the loop',async()=>{
 const s=await setup();const {get}=await read(s,['Send the analysis to Jenny so she can start']);
 assert.equal(get(0).relationalStatus,'closing_loop');assert.equal(get(0).surfaceNow,true);
 assert.equal(priorityView(get(0),null).label,'Worth closing the loop');
});
test('14–17. meaning: symbolic, a child’s development, career, community',async()=>{
 const s=await setup();const {get,rel}=await read(s,['Buy flowers for our anniversary','Book Leo’s speech therapy assessment','Submit the qualification application','Volunteer roster for the school working bee']);
 assert.match(words(get(0)),/It means something/);
 assert.match(words(get(1)),/Helps them grow/);assert.ok(rel(1).lift>0.05);
 assert.match(words(get(2)),/Opens doors later/);
 assert.match(words(get(3)),/Good for your community/);
 for(let k=0;k<4;k++)assert.doesNotMatch(words(get(k)),INTERNAL);
});
test('18. high future value, but the person has already carried a lot today: Bear goes quiet',async()=>{
 const s=await setup();
 const p=await s.insert('projects',stamp(USER,{areaKey:'work',title:'Grant',status:'active',dueAt:null,resourceDocumentIds:[],billId:null,importance:'very',role:'progress',createdAt:day(-21).toISOString()}));
 const t=await give(s,'Draft the significance section');await s.update('tasks',t.id,{projectId:p.id});
 assert.ok((await bearIdeas(s,NOW)).ideas.some(x=>x.type==='protect_time'));
 for(let k=0;k<5;k++){const x=await give(s,`Fill in the leave form ${k}`);await s.update('tasks',x.id,{status:'done',cognitiveEffort:'high'});await s.insert('completions',stamp(USER,{taskId:x.id,billId:null,completedAt:NOW.toISOString(),daysBeforeDue:null,method:null}));}
 const f=await bearIdeas(s,NOW);assert.equal(f.ideas.length,0);assert.equal(f.rested,true);
});
test('19. present meaning isn’t optimised away by career admin',async()=>{
 const s=await setup();const {get}=await read(s,['Dinner with the kids on Friday night','Update the faculty spreadsheet']);
 assert.ok(get(0).importance>=get(1).importance);
});
test('20. nothing meaningful needs attention → nothing',async()=>{
 const s=await setup();await give(s,'Waiting for an email reply from the school about the uniform.');
 assert.deepEqual((await bearIdeas(s,NOW)).ideas,[]);
});
test('names: picked up carefully, never from verbs or titles alone',()=>{
 assert.equal(personName('Review Maya’s chapter'),'Maya');assert.equal(personName('Send the analysis to Jenny'),'Jenny');
 assert.equal(personName('Reply to Professor Smith'),'Professor Smith');assert.equal(personName('Draft the Discussion argument'),null);
});
test('the person’s answer beats Bear’s guess: “No one is relying on me”',async()=>{
 const s=await setup();const t=await give(s,'Send the analysis to Jenny so she can start');
 await setReliance(s,t.id,'no');const r=(await prioritiseOpen(s,NOW)).results.get(t.id);assert.equal(r.relationalStatus,null);
});

// ---------- past self: friction, timing and support, never values ----------
const T=(o)=>({id:o.id||Math.random().toString(36).slice(2),status:o.status||'done',kind:'form',title:o.title||'x',postpones:o.postpones||0,size:o.size||'one_go',load:{nodes:[{pattern:o.pattern||'FORM_APPLICATION'}]}});
const C=(taskId,d)=>({taskId,completedAt:'2026-10-01T00:00:00Z',daysBeforeDue:d});
test('past self: underestimated / repeatedly late similar tasks → act earlier',()=>{
 const h=[T({id:'a'}),T({id:'b'}),T({id:'c'})];const e=pastSelfEvidence('FORM_APPLICATION','form',h,[C('a',-2),C('b',-1),C('c',3)]);
 assert.equal(e.actEarlierDays,2);
});
test('past self: repeatedly deferred similar tasks → higher deferral risk',()=>{
 const e=pastSelfEvidence('FORM_APPLICATION','form',[T({postpones:3}),T({postpones:2,status:'open'})],[]);assert.ok(e.deferralRisk>=0.5);
});
test('past self: breaking it down worked before → start small',()=>{
 const e=pastSelfEvidence('FORM_APPLICATION','form',[T({postpones:3,size:'bigger'}),T({postpones:2})],[]);assert.equal(e.breakDown,true);
});
test('past self: early and easy before → no extra support, no earlier nudging',()=>{
 const h=[T({id:'a'}),T({id:'b'}),T({id:'c'})];const e=pastSelfEvidence('FORM_APPLICATION','form',h,[C('a',5),C('b',4),C('c',3)]);
 assert.equal(e.easy,true);assert.equal(e.actEarlierDays,0);assert.equal(e.breakDown,false);
});
test('past self: late history moves timing earlier but never changes importance',async()=>{
 const s=await setup();const fresh=async()=>{const t=await give(s,'Submit the school enrolment form by 20 November 2026.');return t;};
 const t1=await fresh();const r1=(await prioritiseOpen(s,NOW)).results.get(t1.id);
 for(let k=0;k<3;k++){const x=await give(s,`Submit the sports registration form ${k} by 1 October 2026.`);await s.update('tasks',x.id,{status:'done'});await s.insert('completions',stamp(USER,{taskId:x.id,billId:null,completedAt:'2026-10-03T00:00:00Z',daysBeforeDue:-2,method:null}));}
 const r2=(await prioritiseOpen(s,NOW)).results.get(t1.id);
 assert.ok(Math.abs(r2.importance-r1.importance)<0.001,'importance unchanged');
 if(r1.latestComfortableActionAt&&r2.latestComfortableActionAt)assert.ok(r2.latestComfortableActionAt<=r1.latestComfortableActionAt,'earlier, not later');
});
test('past self: not finishing something the person said really matters doesn’t make it matter less',async()=>{
 const s=await setup();const t=await give(s,'Draft the grant narrative');await setImportance(s,t.id,'very',NOW);
 for(let k=0;k<5;k++)await notToday(s,t.id,null,day(k));
 assert.equal((await prioritiseOpen(s,day(5))).results.get(t.id).importance,0.95);
});
test('learning guard: lots of admin done does not make admin more important',async()=>{
 const s=await setup();const t=await give(s,'Update the committee spreadsheet');const before=(await prioritiseOpen(s,NOW)).results.get(t.id).importance;
 for(let k=0;k<8;k++){const x=await give(s,`Update the committee minutes ${k}`);await s.update('tasks',x.id,{status:'done'});await s.insert('completions',stamp(USER,{taskId:x.id,billId:null,completedAt:day(-1).toISOString(),daysBeforeDue:null,method:null}));}
 assert.ok(Math.abs((await prioritiseOpen(s,NOW)).results.get(t.id).importance-before)<0.001);
});

// ---------- Bear Ideas competition ----------
test('Bear Ideas: a small, mixed feed where mental-load reduction stays represented',async()=>{
 const s=await setup();
 const {extraction}=await createCapture(s,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 20 November 2026.',referenceYear:2026});
 await confirmBill(s,{extractionId:extraction.id,corrections:{biller:'AGL',category:'electricity',amountDueCents:18460,dueDate:'2026-11-20',isRecurring:true,expectedRecurrence:'quarterly',earlyDiscountCents:500,discountDeadline:'2026-11-10'},confirmedFields:['biller','category','amountDueCents','dueDate','isRecurring','expectedRecurrence','earlyDiscountCents','discountDeadline'],allowDuplicate:true,forPerson:null},NOW);
 await give(s,'Return the excursion permission note by 29 October.');
 const p=await s.insert('projects',stamp(USER,{areaKey:'work',title:'Manuscript',status:'active',dueAt:null,resourceDocumentIds:[],billId:null,importance:'very',role:'progress',createdAt:day(-21).toISOString()}));
 const m=await give(s,'Draft the Discussion argument');await s.update('tasks',m.id,{projectId:p.id});
 await give(s,'Send the analysis to Jenny so she can start');
 await give(s,'Update the meeting notes');
 const r=await give(s,'Car registration expires 30 November 2026. Renew online.');for(let k=0;k<3;k++)await notToday(s,r.id,null,day(k-3));
 const f=await bearIdeas(s,NOW);const kinds=f.ideas.map(i=>i.type);
 assert.ok(f.ideas.length>=3&&f.ideas.length<=5,kinds.join());
 assert.ok(f.ideas.some(i=>i.family==='load'),'mental-load reduction represented');
 assert.ok(!f.ideas.some(i=>/meeting notes/i.test(i.title)),'minor admin stays out');
 assert.ok(f.ideas.some(i=>/excursion|permission/i.test(i.title)),'the real deadline is there');
});

// ---------- cognitive load ----------
test('cognitive load: the default task view carries no reasons, no scores and at most one question',async()=>{
 const s=await setup();const {get}=await read(s,['Review Maya’s chapter']);
 const v=priorityView(get(0),null);assert.deepEqual(Object.keys(v).sort(),['ask','label','minutes','shortReason','surfaceNow']);
 assert.ok(v.ask===null||typeof v.ask==='string','one question at most');
 const w=whyView(get(0));assert.ok(w.reasons.length>=1&&w.reasons.length<=4,'reasons only on request, 1–4');
});
test('cognitive load: no internal terms or numbers in anything the person can read',async()=>{
 const s=await setup();const {pr}=await read(s,['Review Maya’s chapter','Reply to Professor Smith about the collaboration invitation','Review Sam’s paper draft','Call Mum','Put the bins out before my partner gets home','Send the analysis to Jenny so she can start','Book Leo’s speech therapy assessment','Buy flowers for our anniversary','Volunteer roster for the school working bee','Go to the concert with friends']);
 for(const r of pr.results.values()){assert.doesNotMatch(words(r),INTERNAL);assert.doesNotMatch(r.explanation.shortReason||'',INTERNAL);}
 for(const i of (await bearIdeas(s,NOW)).ideas){const text=`${i.eyebrow} ${i.title} ${i.body} ${(i.why||[]).map(w=>w.title+' '+w.text).join(' ')}`;assert.doesNotMatch(text.replace(/~\d+ min|\d+ minutes?/g,''),INTERNAL);assert.ok((i.why||[]).length<=4);}
});
test('cognitive load: My Bear unchanged and calm; Bear Ideas never more than five',async()=>{
 const s=await setup();for(const t of ['Review Maya’s chapter','Call Mum','Send the analysis to Jenny so she can start','Return the excursion permission note by 28 October.','Book Leo’s speech therapy assessment','Review Sam’s paper draft'])await give(s,t);
 const h=await homeView(s,NOW);assert.equal(h.oneThing,null);assert.ok(h.ideasCount<=5);
 assert.ok((await bearIdeas(s,NOW)).ideas.length<=5);
});
test('flags: relational reasoning switches off cleanly',async()=>{
 process.env.BEAR_RELATIONAL_V1='off';try{const s=await setup();const {pr,get}=await read(s,['Review Maya’s chapter']);assert.equal(pr.relational.size,0);assert.equal(get(0).relationalStatus,null);}finally{delete process.env.BEAR_RELATIONAL_V1;}
});
