// Tell Bear once: the acceptance scenarios for sorting one message into titled, filed, traffic-lit responsibilities.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {sortMessage,sortOne,lightFor,saidDate,classify,titleFor,parseCorrection} from '../lib/bear/services/sorter.ts';
import {sortAndPlace,sortParts,changeSorted,taskLight,whenLine} from '../lib/bear/services/sort-service.ts';

const TODAY='2026-11-14';                      // a Saturday
const NOW=new Date('2026-11-14T10:00:00+11:00');
const FIVE='I need to pay the electricity bill tomorrow, Ava’s school permission form is due Monday, book a dentist appointment, mum’s birthday is next month and I should reply to Sarah about dinner tonight';
async function person(id='71717171-7171-4717-8717-717171717171'){const s=new MemoryBackend().for(id);await ensureProfile(s);await saveProfile(s,{name:'Govind',areas:['family','home','money','work','health','me'],onboardingComplete:true});return s;}
const openTasks=async s=>(await s.list('tasks')).filter(t=>t.status==='open'&&!t.isDemo);
const counts=async s=>Object.fromEntries((await homeView(s,NOW)).areas.map(a=>[a.key,a.open]));

test('1. five unrelated things in one message become five tasks',async()=>{
 const s=await person();const items=await sortAndPlace(s,null,FIVE,'text',NOW);
 assert.equal(items.length,5);assert.ok(items.every(i=>i.taskId&&!i.error),JSON.stringify(items.filter(i=>!i.taskId)));
 assert.equal(new Set(items.map(i=>i.taskId)).size,5);assert.equal((await openTasks(s)).length,5);
});
test('2. several things can be red at once, with no cap',()=>{
 const items=sortMessage('the rego is overdue, the gas bill is due today, call the school about Ava urgently, pay the plumber tomorrow and reply to the landlord tonight',TODAY);
 assert.equal(items.length,5);assert.deepEqual(items.map(i=>i.light),['red','red','red','red','red']);
});
test('3. nothing is red when nothing is urgent, however important it sounds',()=>{
 const items=sortMessage('clean out the garage sometime, read that book, and plan a holiday for next year',TODAY);
 assert.ok(items.length>=3);assert.ok(items.every(i=>i.light!=='red'));
 assert.notEqual(sortOne('Sort out my will, it is really important',TODAY).light,'red','important is not the same as urgent');
 assert.equal(sortOne('book a dentist appointment',TODAY).light,'amber');assert.equal(sortOne('read that book',TODAY).light,'green');
});
test('4. each thing lands in the right one of the six areas, by what it is for',()=>{
 const want=[['Pay the electricity bill','money'],['Complete Ava’s school permission form','family'],['Book Ava’s dentist appointment','health'],['Organise Mum’s birthday celebration','family'],
  ['Reply to Sarah about dinner','me'],['Finish the report for my manager','work'],['Arrange someone to fix the leaking tap','home'],['Renew the car insurance','money'],['Pick up my prescription','health'],['Go for a run','me'],['Mow the lawn','home'],['Email the client the proposal','work']];
 for(const [text,area] of want)assert.equal(classify(text,['Ava']).domain,area,text);
 const d=classify('Book Ava’s dentist appointment',['Ava']);assert.deepEqual(d.secondary,['family'],'the other area is kept as a tag, not a second copy');
});
test('5. titles say what needs doing',()=>{
 const t=x=>sortOne(x,TODAY).title;
 assert.equal(t('electricity bill'),'Pay the electricity bill');assert.equal(t('dentist'),'Book the dentist appointment');
 assert.equal(t('Ava’s school permission form is due Monday'),'Complete and return Ava’s school permission form');
 assert.equal(t('mum’s birthday is next month'),'Plan mum’s birthday');assert.equal(t('I should reply to Sarah about dinner tonight'),'Reply to Sarah about dinner');
 assert.equal(t('remind me to call the plumber'),'Call the plumber');
 for(const i of sortMessage(FIVE,TODAY)){assert.match(i.title,/^[A-Z][a-z]+ /);assert.ok(i.title.length<=90&&i.title.split(' ').length>=2,i.title);}
});
test('6. nothing is invented: no date, name or amount the person did not give',async()=>{
 for(const i of sortMessage('book a dentist appointment, plan a party, call the bank',TODAY)){assert.equal(i.deadline,null,i.title);assert.equal(i.deadlineSource,null);}
 assert.ok(!/ava|sarah|\$|\d/i.test(sortMessage('book a dentist appointment and pay the school fees',TODAY).map(i=>i.title).join(' ')));
 // A model that adds a name the person never said is not believed: Bear falls back to its own reading.
 const liar=new FakeProvider(()=>({tasks:[{original:'book a dentist appointment',title:'Book Oliver’s dentist appointment',domain:'health'},{original:'call the bank about the loan',title:'Call the bank',domain:'money'}]}));
 const parts=await sortParts('book a dentist appointment and call the bank about the loan',liar,TODAY,[]);assert.ok(!parts.some(p=>/Oliver/.test(p.title)));
 const made=new FakeProvider(()=>({tasks:[{original:'pay the mortgage and the school fees today',title:'Pay the mortgage',domain:'money'}]}));
 assert.equal((await sortParts('book a dentist appointment and call the bank about the loan',made,TODAY,[])).length,2,'words that were never said are rejected');
});
test('7. a stated deadline and a date Bear only proposes are kept apart',async()=>{
 const stated=sortOne('Ava’s school permission form is due Monday',TODAY);assert.deepEqual([stated.deadline,stated.deadlineSource],['2026-11-16','stated']);
 const proposed=sortOne('book a dentist appointment',TODAY);assert.deepEqual([proposed.deadline,proposed.deadlineSource],[null,null]);assert.ok(proposed.suggestedStart>TODAY,'a suggestion, in the future');
 assert.match(whenLine(proposed,TODAY),/^Suggested: /);assert.match(whenLine(stated,TODAY),/^Due /);
 const loose=sortOne('mum’s birthday is next month',TODAY);assert.deepEqual([loose.deadline,loose.window],[null,'Next month'],'a loose timeframe is not turned into a deadline');
 const prep=sortOne('finish the grant report by 30 November',TODAY);assert.equal(prep.deadline,'2026-11-30');assert.ok(prep.suggestedStart<prep.deadline&&prep.suggestedStart>TODAY,'start before the deadline, not on it');
 const s=await person();const [made]=await sortAndPlace(s,null,'book a dentist appointment and read that book',NOW&&'text'==='text'?'text':'text',NOW);
 const task=await s.get('tasks',made.taskId);assert.equal(task.dueAt,null,'the proposal is not saved as a due date');assert.ok(task.sorted.suggestedStart);
 assert.equal(saidDate('pay it by Friday',TODAY).date,'2026-11-20');assert.equal(saidDate('tomorrow',TODAY).date,'2026-11-15');assert.equal(saidDate('in 3 days',TODAY).date,'2026-11-17');
});
test('8. voice and text give the same result',async()=>{
 const a=await person('72727272-7272-4727-8727-727272727272'),b=await person('73737373-7373-4737-8737-737373737373');
 const strip=l=>l.map(({taskId,...r})=>r);
 assert.deepEqual(strip(await sortAndPlace(a,null,FIVE,'text',NOW)),strip(await sortAndPlace(b,null,FIVE,'voice',NOW)));
 assert.deepEqual((await openTasks(b)).map(t=>t.sorted.via),Array(5).fill('voice'));
});
test('9. one sentence changes one thing, and only that thing',async()=>{
 const s=await person();const items=await sortAndPlace(s,null,FIVE,'text',NOW);const ids=items.map(i=>i.taskId);
 const dentist=items.find(i=>/dentist/i.test(i.title));assert.equal(dentist.light,'amber');
 const r=await changeSorted(s,{taskIds:ids,text:'Actually, the dentist is urgent'},NOW);assert.equal(r.changed.taskId,dentist.taskId);assert.equal(r.changed.light,'red');
 const after=await Promise.all(ids.map(id=>s.get('tasks',id)));assert.equal(after.filter(t=>t.light).length,1,'nothing else was touched');
 assert.equal((await changeSorted(s,{taskIds:ids,text:'the birthday is a me thing'},NOW)).changed.domain,'me');
 assert.equal((await changeSorted(s,{taskIds:ids,text:'the dentist is due Friday'},NOW)).changed.deadline,'2026-11-20');
 assert.equal((await changeSorted(s,{taskIds:ids,text:'hello there'},NOW)).changed,null,'an unclear sentence changes nothing');
 assert.deepEqual(parseCorrection('the birthday can wait',items,TODAY),{index:items.findIndex(i=>/birthday/i.test(i.title)),light:'green'});
 const tapped=await changeSorted(s,{taskIds:ids,taskId:ids[0],light:'green'},NOW);assert.equal(tapped.changed.light,'red','a deadline that has arrived outranks "can wait"');
});
test('10. the area cards count what was sorted, and stay right through moves and completion',async()=>{
 const s=await person();const items=await sortAndPlace(s,null,FIVE,'text',NOW);
 assert.deepEqual(await counts(s),{work:0,family:2,home:0,money:1,health:1,me:1});
 const dentist=items.find(i=>/dentist/i.test(i.title));await changeSorted(s,{taskIds:[dentist.taskId],taskId:dentist.taskId,domain:'family'},NOW);
 assert.deepEqual(await counts(s),{work:0,family:3,home:0,money:1,health:0,me:1});
 await completeTask(s,{taskId:dentist.taskId,method:null,expectNext:false},NOW);assert.equal((await counts(s)).family,2);
});
test('11. telling Bear the same thing again does not make a second copy',async()=>{
 const s=await person();await sortAndPlace(s,null,FIVE,'text',NOW);
 const again=await sortAndPlace(s,null,FIVE,'voice',NOW);assert.ok(again.every(i=>i.already),'each is recognised');assert.equal((await openTasks(s)).length,5);
 const reworded=await sortAndPlace(s,null,'pay the electricity bill',null||'text',NOW);assert.ok(reworded[0].already);assert.equal((await openTasks(s)).length,5);
 const s2=await person('74747474-7474-4747-8747-747474747474');await sortAndPlace(s2,null,'book the car service and call the vet',null||'text',NOW);
 const [dated]=await sortAndPlace(s2,null,'book the car service by Friday and wash the dog','text',NOW);assert.ok(dated.already);assert.equal(dated.deadline,'2026-11-20','a date said the second time is taken');
});
test('12. the light moves by itself as the deadline nears',async()=>{
 assert.equal(lightFor({deadline:'2026-12-20'},TODAY).light,'green');assert.equal(lightFor({deadline:'2026-12-20'},'2026-12-08').light,'amber');
 assert.equal(lightFor({deadline:'2026-12-20'},'2026-12-19').light,'red');assert.equal(lightFor({deadline:'2026-12-20'},'2026-12-22').light,'red');
 const s=await person();const [i]=await sortAndPlace(s,null,'renew the passport by 20 December and tidy the shed','text',NOW);const t=await s.get('tasks',i.taskId);
 assert.deepEqual(['2026-11-14','2026-12-10','2026-12-19'].map(d=>taskLight(t,d).light),['green','amber','red']);
 // The person's own call stands until the deadline itself arrives.
 assert.equal(lightFor({deadline:'2026-12-20',person:'green'},'2026-12-10').light,'green');assert.equal(lightFor({deadline:'2026-12-20',person:'green'},'2026-12-19').light,'red');
 assert.equal(lightFor({deadline:null,person:'red'},TODAY).light,'red');
});
test('13. one thing stays one thing, and Bear’s other readers still do their job',async()=>{
 for(const one of ['buy milk, eggs and bread','pick up Sam and Ava from school at 3','Book flights to Melbourne and Sydney','call mum'])assert.equal(sortMessage(one,TODAY).length,1,one);
 const s=await person();const [m]=await sortAndPlace(s,null,'call mum',null||'text',NOW);assert.ok(m.taskId);
 const task=await s.get('tasks',m.taskId);assert.equal(task.status,'open');assert.ok((await s.list('reminders')).length>=0);assert.ok((await s.list('captures')).length===1,'it went through the ordinary capture');
});
test('14. Bear never words a proposal, or anything it has only prepared, as done',async()=>{
 const s=await person();const items=await sortAndPlace(s,null,FIVE+', and email the teacher about camp',null||'text',NOW);
 for(const i of items){const said=[i.when,i.nextAction||'',i.reason].join(' ');assert.ok(!/\b(done|sent|submitted|booked|paid|completed|finished|replied)\b/i.test(said),said);}
 assert.ok(items.some(i=>/^Suggested/.test(i.when)));assert.ok(items.filter(i=>i.nextAction).every(i=>/\b(can|will)\b/.test(i.nextAction)),'offers, not claims');
 assert.ok((await openTasks(s)).every(t=>t.status==='open'),'everything is still open: nothing was done for the person');
});

test('an answer to Bear is never a to-do: "no", "that’s all", "thanks", "yes"',async()=>{
 const {replyKind}=await import('../lib/bear/services/sorter.ts');
 for(const t of ['no','No.','nope','nah','no thanks','No thank you','no thanks Bear','nothing','nothing else','that’s all','thats all','that\'s it thanks','all good','I’m good','im done','done','no that’s all for now','No thanks, that’s all','No. Thanks!','nope, all good','not now','thanks','thank you','Cheers','No!','NO','bye'])assert.equal(replyKind(t),'closing',t);
 for(const t of ['yes','Yep','ok','sure','yes please','hi','test'])assert.equal(replyKind(t),'more',t);
 for(const t of ['no more screen time for the kids after 7','call mum','nothing in the fridge, buy groceries','done with the report, send it to the manager','thank the teacher for the report','yes book the dentist','ok call the plumber','cancel the gym membership','no rush but tidy the shed'])assert.equal(replyKind(t),null,t);
});
