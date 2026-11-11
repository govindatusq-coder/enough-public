// The parent journey on the real pipeline, from a fresh account: the realistic cases a working parent hits. Written from the product
// brief's cases, not tuned to outputs. Includes the defects the first run found (lost payments, wrong child, ignored updated
// deadlines, a receipt that didn't resolve anything, junk tasks from thin or informational messages).
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {intake} from '../lib/bear/services/intake.ts';
import {eventForTask} from '../lib/bear/engine/calendar-event.ts';
import {history} from '../lib/bear/engine/events.ts';

const NOW=new Date('2026-11-03T09:00:00+11:00');
async function fresh(people=[{role:'child',name:'Mia'},{role:'child',name:'Leo'}]){const s=new MemoryBackend().for('99999999-0000-4000-8000-999999999999');await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true,people});return s;}
async function give(s,text){const {extraction,capture}=await createCapture(s,null,{method:'text',text,referenceYear:2026});return {capture,extraction,auto:await maybeAutoSetup(s,extraction,NOW)};}
const open=async s=>(await s.list('tasks')).filter(t=>t.status==='open');
const node=(t,title)=>t.load.nodes.find(n=>n.title===title);
const stepDue=(t,title,key)=>node(t,title).steps.find(x=>x.key===key)?.dueAt;

test('1. an excursion with a form and a payment: one linked responsibility for the right child, each with its own date',async()=>{
 const s=await fresh();const {auto}=await give(s,'Hi parents, Mia’s Year 3 excursion to the museum is on 20 November. Permission forms are due 13 November. Payment of $25 is due 13 November.');
 const t=auto.task;assert.deepEqual([t.title,t.forPerson,t.dueAt],['Excursion to the museum','Mia','2026-11-20']);
 assert.equal(stepDue(t,'Consent','submit'),'2026-11-13');assert.equal(node(t,'Payment').entities.amountCents,2500);assert.equal(stepDue(t,'Payment','pay'),'2026-11-13');
});
test('2. an event with no deadline still gets its date, no invented child, and can be added to a calendar',async()=>{
 const s=await fresh();const {auto}=await give(s,'Book Week parade is on 28 November. Students can dress as their favourite character.');
 assert.equal(auto.task.forPerson??null,null,'“Book Week” is not a child called Week');assert.equal(auto.task.dueAt,'2026-11-28');
 assert.equal(eventForTask(auto.task).date,'2026-11-28');
});
test('3. a notice for several children: each child keeps their own event, amount and deadlines; nothing is lost',async()=>{
 const s=await fresh();await give(s,'Dear families. Mia (Year 3): excursion to the museum on 20 November, permission and $25 due 13 November. Leo (Year 6): camp 25-27 November, permission due 18 November and $180 due 20 November. Please return forms to the office.');
 const ts=await open(s);assert.equal(ts.length,2);const mia=ts.find(t=>t.forPerson==='Mia'),leo=ts.find(t=>t.forPerson==='Leo');assert.ok(mia&&leo);
 assert.deepEqual([stepDue(mia,'Consent','submit'),node(mia,'Payment').entities.amountCents,stepDue(mia,'Payment','pay')],['2026-11-13',2500,'2026-11-13']);
 assert.deepEqual([stepDue(leo,'Consent','submit'),node(leo,'Payment').entities.amountCents,stepDue(leo,'Payment','pay')],['2026-11-18',18000,'2026-11-20'],'$180 is due 20 Nov, not the permission’s 18 Nov');
});
test('4. a bill: amount, payee, due date and reference are read and held for the person to check before anything is tracked',async()=>{
 const s=await fresh();const {extraction,auto}=await give(s,'AGL electricity bill. Amount due $184.60. Due date 20 November 2026. Reference 4455 1122.');
 assert.equal(extraction.kind,'bill');assert.equal(extraction.fields.amountDueCents.value,18460);assert.equal(extraction.fields.dueDate.value,'2026-11-20');assert.equal(auto,null,'money is always checked by the person first');assert.equal((await open(s)).length,0);
});
test('5a. an updated deadline changes the plan AND tells the parent what changed',async()=>{
 const s=await fresh();const {auto}=await give(s,'Mia’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.');
 const r=await give(s,'Update: Mia’s Year 5 camp permission forms are now due 12 November.');assert.equal(r.auto.merged,true);
 const t=(await open(s))[0];assert.equal((await open(s)).length,1,'no duplicate');assert.equal(stepDue(t,'Consent','submit'),'2026-11-12');
 assert.match(t.changeNotes[0].text,/permission form deadline changed from 10 Nov to 12 Nov/);
 assert.ok((await history(s,t.id)).some(e=>e.eventType==='update_applied'&&e.metadata.to==='2026-11-12'));
});
test('5b. an event that moves a long way is still the same event, not a second one',async()=>{
 const s=await fresh();await give(s,'Mia’s Year 5 camp is on 18 November. Permission forms are due 10 November.');
 await give(s,'Mia’s Year 5 camp has been rescheduled to 30 November.');const ts=await open(s);assert.equal(ts.length,1);assert.equal(ts[0].dueAt,'2026-11-30');assert.match(ts[0].changeNotes[0].text,/event date changed from 18 Nov to 30 Nov/);
});
test('5c. two notices that DISAGREE (no change wording): the earlier date is kept and the parent is told to check',async()=>{
 const s=await fresh();await give(s,'Mia’s Year 5 camp is on 18 November. Permission forms are due 10 November.');
 await give(s,'Reminder: Mia’s Year 5 camp permission forms are due 14 November.');
 const t=(await open(s))[0];assert.equal(stepDue(t,'Consent','submit'),'2026-11-10','not silently overwritten');assert.match(t.changeNotes[0].text,/different permission form deadline: 14 Nov instead of 10 Nov\. Bear is keeping 10 Nov\. Check which is right/);
});
test('6. a receipt resolves the obligation it belongs to, with the receipt as evidence, and does not become a new to-do',async()=>{
 const s=await fresh();const {auto}=await give(s,'Mia’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.');
 const pay=()=>s.get('tasks',auto.task.id).then(t=>node(t,'Payment').steps.find(x=>x.key==='pay'));assert.equal((await pay()).status,'pending');
 const v=await intake(s,'We have received your payment of $180 for the Year 5 camp. Thank you. Receipt no. 77123.',false,NOW);
 assert.deepEqual([v.kind,v.evidence,v.taskId],['confirmed','payment_confirmed',auto.task.id]);assert.equal((await pay()).status,'done');assert.equal((await open(s)).length,1);
 assert.equal((await intake(s,'We have received your payment of $180 for the Year 5 camp. Thank you.',false,NOW)).kind,'info','the same receipt again resolves nothing new and says so');
});
test('7. information that asks nothing is said to need nothing (and can be kept); the person’s own short notes are never dismissed',async()=>{
 const s=await fresh();
 for(const t of ['Thanks everyone for a wonderful athletics carnival! Photos are on the school website.','Congratulations to all our Year 12 graduates and their families on a wonderful night!'])assert.deepEqual(await intake(s,t,false,NOW),{kind:'info',receipt:false},t);
 for(const t of ['buy milk','call the plumber','Dentist for Leo','Please return the form by Friday','Pay the water bill $90 by 20 November'])assert.equal((await intake(s,t,false,NOW)).kind,'proceed',t);
 assert.equal((await intake(s,'Your payment of $35 was successful. Thank you for your order.',false,NOW)).kind,'info');
});
test('8. a repeated share is one responsibility, not two',async()=>{
 const s=await fresh();const a=await give(s,'Please return the excursion form by Friday 13 November.');const b=await give(s,'Please return the excursion form by Friday 13 November.');
 assert.equal(b.auto.merged,true);assert.equal(b.auto.task.id,a.auto.task.id);assert.equal((await open(s)).length,1);
});
test('9. an unreadable or ambiguous source never becomes a confident, made-up task',async()=>{
 const s=await fresh();
 for(const t of ['see attached','Fwd: see below','FYI','???','...'])assert.equal((await intake(s,t,false,NOW)).kind,'unclear',t);
 assert.equal((await intake(s,'see attached',true,NOW)).kind,'proceed','a file with that note is still read');
 const {auto}=await give(s,'Permission forms due by end of term please.');assert.equal(auto.task.dueAt,null,'“end of term” is not guessed into a date');
});
test('reading the same bill again and again gives the same answer (a shared pattern once made the amount vanish every other time)',async()=>{
 const text='AGL electricity bill. Amount due $184.60. Due date 20 November 2026. Reference 4455 1122.';const seen=new Set();
 for(let i=0;i<8;i++){const s=await fresh();const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});seen.add(`${extraction.fields.amountDueCents.value}|${extraction.fields.dueDate.value}|${extraction.fields.biller.value}`);}
 assert.deepEqual([...seen],['18460|2026-11-20|AGL']);
});
