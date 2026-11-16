// Responsibility Resolution Engine: the scrunchie and Christmas scenarios end to end, decision scenarios A–H, and safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload,addOne,openTasks,moveTask} from '../lib/bear/board/service.ts';
import {understand,pathwaysFor,kindOf} from '../lib/bear/rre/model.ts';
import {buildPlan} from '../lib/bear/rre/plan.ts';
import {chooseMoment} from '../lib/bear/rre/decide.ts';
import {learn,purchasePreference} from '../lib/bear/rre/prefs.ts';
import {recommend,giveToBear,stepAction,skip,brainView,detailView,afterDrop,setPreference,preferencesView,removePreference} from '../lib/bear/rre/service.ts';

const MON=new Date('2026-11-16T10:00:00+11:00');// Monday 10am, Sydney
const backend=new MemoryBackend();let n=0;
async function person(name='Sarah',extra={}){const s=backend.for(`c0c0c0c0-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name,areas:['family','home'],onboardingComplete:true,...extra});return s;}
const at=(iso)=>new Date(iso);

test('understanding: the outcome, not just the task',()=>{
 const u=understand({title:'Get a red scrunchie for Sarah',original:'Sarah needs a red scrunchie for Friday.',dueAt:'2026-11-20',listId:null,today:'2026-11-16',children:['Sarah']});
 assert.equal(u.kind,'acquire');assert.deepEqual(u.people,['Sarah']);assert.equal(u.item,'red scrunchie');
 assert.match(u.outcome,/^Sarah has a red scrunchie by Friday/);
 const ways=pathwaysFor(u,{title:'Get a red scrunchie for Sarah',today:'2026-11-16',minutesGuess:5}).map(p=>p.method);
 assert.deepEqual(ways,['online','in_person','borrow','other'],'order, buy locally, borrow, use one you have');
 assert.equal(kindOf('Book the dentist','',null),'appointment');assert.equal(kindOf('Follow up with the school about the excursion','',null),'followup');
 assert.equal(kindOf('Organise Christmas presents','',null),'gifts');assert.equal(kindOf('Renew the car registration','',null),'form');
 assert.equal(kindOf('Learn to play the piano one day','',null),'aspiration');
 // Nothing invented: no date given means no deadline; an aspiration never gets one.
 assert.equal(understand({title:'Book the dentist',original:'Book the dentist',dueAt:null,listId:null,today:'2026-11-16'}).deadline,null);
 assert.equal(understand({title:'Build a chicken pen',original:'',dueAt:'2026-12-01',listId:'aspire',today:'2026-11-16'}).deadline,null);
});

test('Scrunchie, end to end: tip on capture, "Saves time later" for 5 minutes, Bear prepares, she orders, Bear waits, it arrives, done',async()=>{
 const s=await person('Sarah',{family:[{name:'Sarah',relation:'child',age:7,yearLevel:null,school:null,allergies:null,notes:null}]});
 const r=await unload(s,null,{text:'Sarah needs a red scrunchie for Friday.',via:'text'},MON);assert.equal(r.added.length,1);
 const tip=await afterDrop(s,r.added.map(a=>a.id),MON);assert.match(tip.text,/ordering Sarah’s red scrunchie today could save you a shopping trip/);
 const m=await recommend(s,{minutes:5,exclude:[]},MON);const rec=m.recommendation;
 assert.equal(rec.label,'Saves time later');assert.equal(rec.title,'Order Sarah’s red scrunchie');assert.equal(rec.minutes,2,'her active time, not the delivery time');
 assert.equal(rec.why,'Ordering today could save a shopping trip later this week.');assert.equal(rec.needsBear,true);
 const id=rec.taskId;let d=await giveToBear(s,null,id,MON);
 assert.equal(d.status,'awaiting_approval');assert.equal(d.prepared.kind,'shopping');assert.match(d.prepared.note,/doesn’t buy anything/);assert.match(d.prepared.links[0].url,/^https:\/\/www\.google\.com\/search\?tbm=shop&q=red%20scrunchie/);
 // Tapping twice never prepares twice.
 const again=await giveToBear(s,null,id,MON);assert.equal(again.log.filter(l=>/Bear prepared/.test(l.text)).length,1);
 d=await stepAction(s,id,{action:'done'},MON);// she ordered it
 assert.equal(d.status,'waiting');assert.equal(d.dependencies[0].kind,'delivery');const expected=d.dependencies[0].expectedBy;assert.ok(expected>'2026-11-16');
 const rem=(await s.list('reminders',{where:[{column:'task_id',value:id}]})).filter(x=>x.status==='scheduled');assert.equal(rem.length,1,'a real reminder checks back on the expected day');
 assert.equal((await s.get('tasks',id)).status,'open','an order placed is not the outcome');
 const waitMoment=await recommend(s,{minutes:5,exclude:[]},MON);assert.equal(waitMoment.recommendation,null);assert.match(waitMoment.message,/waiting/);
 const [y,mo,da]=expected.split('-').map(Number);const nextDay=new Date(Date.UTC(y,mo-1,da+1)).toISOString().slice(0,10);const later=new Date(`${nextDay}T10:00:00+11:00`);
 const check=await recommend(s,{minutes:5,exclude:[]},later);assert.equal(check.recommendation.title,'Check the red scrunchie has arrived');
 d=await stepAction(s,id,{action:'arrived'},later);assert.equal(d.status,'completed');assert.equal((await s.get('tasks',id)).status,'done');
});

test('Scrunchie: if it doesn’t arrive, Bear keeps it open and moves to buying it locally',async()=>{
 const s=await person();const r=await unload(s,null,{text:'Sarah needs a red scrunchie for Friday.',via:'text'},MON);const id=r.added[0].id;
 await giveToBear(s,null,id,MON);await stepAction(s,id,{action:'done'},MON);
 const d=await stepAction(s,id,{action:'not_arrived'},at('2026-11-19T10:00:00+11:00'));
 assert.equal(d.pathway.id,'shop');assert.equal(d.taskStatus,'open');assert.ok(d.log.some(l=>/didn’t arrive/.test(l.text)));
});

test('Christmas gifts: "Worth doing now", shortlist from the family Bear knows, ideas only, nothing bought',async()=>{
 const fam=[{name:'Mia',relation:'child',age:9,yearLevel:null,school:null,allergies:null,notes:null},{name:'Leo',relation:'child',age:4,yearLevel:null,school:null,allergies:null,notes:null},{name:'James',relation:'partner',age:null,yearLevel:null,school:null,allergies:null,notes:null}];
 const s=await person('Sarah',{family:fam});await unload(s,null,{text:'I need to organise Christmas presents for the family',via:'text'},MON);
 const m=await recommend(s,{minutes:10,exclude:[]},MON);const rec=m.recommendation;
 assert.equal(rec.label,'Worth doing now');assert.equal(rec.title,'Review Christmas gift shortlist');assert.equal(rec.minutes,5);
 assert.equal(rec.why,'Bear will prepare some gift ideas. Choosing a few now could avoid last-minute shopping.');
 const det=await detailView(s,rec.taskId,MON);assert.equal(det.deadlines.outcome,'2026-12-24');assert.equal(det.deadlineSource,'known_date');
 let seen=null;const fake={name:'fake',model:'f',supportsVision:false,extract:async i=>{seen=i;return {output:{people:[{name:'Mia',ideas:['A craft kit','A chapter book']},{name:'Leo',ideas:['Building blocks']},{name:'Stranger',ideas:['x']}]},raw:{},provider:'fake',model:'f',latencyMs:3};}};
 const d=await giveToBear(s,fake,rec.taskId,MON);
 assert.equal(d.prepared.kind,'shortlist');assert.ok(d.prepared.lines.some(l=>l==='Mia: A craft kit, A chapter book'));assert.ok(d.prepared.lines.some(l=>/^James: \(add a few ideas\)/.test(l)));
 assert.ok(!d.prepared.lines.some(l=>/Stranger/.test(l)),'nobody invented');assert.match(seen.system,/not specific products, brands, prices or shops/);assert.match(d.prepared.note,/won’t buy anything/);
 // Without AI it still works, from the family details alone.
 const s2=await person('Sarah',{family:fam});const r2=await unload(s2,null,{text:'Organise Christmas presents',via:'text'},MON);
 const d2=await giveToBear(s2,null,r2.added[0].id,MON);assert.ok(d2.prepared.lines.some(l=>l==='Mia: (add a few ideas)'));
});

test('Scenario A: a small thing with an expiring opportunity beats a flexible chore',async()=>{
 const s=await person();await unload(s,null,{text:'Get batteries for the smoke alarm by Friday\nTidy the linen cupboard',via:'text'},MON);
 const rec=(await recommend(s,{minutes:20,exclude:[]},MON)).recommendation;assert.match(rec.title,/batteries/i);assert.equal(rec.label,'Saves time later');
});
test('Scenario B: something important with no deadline is not made urgent',async()=>{
 const s=await person();await addOne(s,{title:'Book the dentist',listId:null},MON);
 const rec=(await recommend(s,{minutes:10,exclude:[]},MON)).recommendation;assert.ok(rec);assert.ok(!['Deadline approaching','Opportunity closing'].includes(rec.label),rec.label);
 assert.doesNotMatch(rec.why,/must|most important|behind/i);
});
test('Scenario C: something blocked by a reply is never offered as doable',async()=>{
 const s=await person();const t=await addOne(s,{title:'Follow up with the school about the excursion',listId:null},MON);
 await giveToBear(s,null,t.id,MON);await stepAction(s,t.id,{action:'done'},MON);// sent; waiting for their reply
 const m=await recommend(s,{minutes:20,exclude:[]},MON);assert.equal(m.recommendation,null);assert.equal(m.waiting,1);
 // Three days on with no reply, Bear suggests checking in, not the original action.
 const r=(await recommend(s,{minutes:5,exclude:[]},at('2026-11-20T10:00:00+11:00'))).recommendation;assert.equal(r.title,'Follow up: no reply yet');
});
test('Scenario D: 5 minutes means nothing longer than 5 minutes of her time',async()=>{
 const s=await person();await unload(s,null,{text:'Paint the fence\nCall the dentist\nRSVP to the party',via:'text'},MON);
 const m=await recommend(s,{minutes:5,exclude:[]},MON);assert.ok(m.recommendation.minutes<=5,JSON.stringify(m.recommendation));
});
test('Scenario E: when ordering online can’t work in time, Bear plans another way',()=>{
 const p=buildPlan({id:'x',title:'Get a red scrunchie for Sarah',original:'Sarah needs a red scrunchie for tomorrow',dueAt:'2026-11-17',listId:null,today:'2026-11-16',minutesGuess:5});
 assert.equal(p.pathways.find(x=>x.id==='online').feasibility,'infeasible');assert.equal(p.selected,'shop');
 const r=chooseMoment([{taskId:'x',title:'Get a red scrunchie',listId:'week',plan:p,status:'open'}],{minutes:60,now:MON,today:'2026-11-16',timeZone:'Australia/Sydney'});
 assert.match(r.recommendation.title,/Buy a red scrunchie while you’re out/);assert.equal(r.recommendation.label,'Deadline approaching','a real deadline: tomorrow');
 const short=chooseMoment([{taskId:'x',title:'Get a red scrunchie',listId:'week',plan:p,status:'open'}],{minutes:5,now:MON,today:'2026-11-16',timeZone:'Australia/Sydney'});assert.equal(short.recommendation,null,'a shop trip doesn’t fit 5 minutes');
});
test('Scenario F: she prefers buying in person, and Bear respects it',async()=>{
 const s=await person();await setPreference(s,{dimension:'purchase_method',value:'in_person'},MON);
 const r=await unload(s,null,{text:'Sarah needs a red scrunchie for Friday.',via:'text'},MON);const d=await detailView(s,r.added[0].id,MON);
 assert.equal(d.pathway.id,'shop');assert.equal(purchasePreference((await ensureProfile(s)).preferences).strength,'explicit');
 // "I actually want to buy this one online": updates straight away for this one.
 const d2=await stepAction(s,r.added[0].id,{action:'switch',pathway:'online'},MON);assert.equal(d2.pathway.id,'online');assert.equal(d2.pathway.chosenBy,'you');
});
test('Scenario G: two equally good options: stable choice, and Bear says either would do',()=>{
 const mk=(id,title)=>({taskId:id,title,listId:'spare',status:'open',plan:buildPlan({id,title,original:title,dueAt:null,listId:null,today:'2026-11-16',minutesGuess:8})});
 const items=[mk('11111111-1111-4111-8111-111111111111','Tidy the desk drawer'),mk('22222222-2222-4222-8222-222222222222','Tidy the shoe rack')];
 const a=chooseMoment(items,{minutes:10,now:MON,today:'2026-11-16',timeZone:'Australia/Sydney'});const b=chooseMoment([...items].reverse(),{minutes:10,now:MON,today:'2026-11-16',timeZone:'Australia/Sydney'});
 assert.equal(a.recommendation.taskId,b.recommendation.taskId,'order of input doesn’t change the answer');assert.ok(a.recommendation.alternative);assert.match(a.recommendation.why,/just as good/);assert.ok(a.recommendation.confidence<0.5);
});
test('Scenario H: a skipped suggestion isn’t offered again straight away, but stays on the list',async()=>{
 const s=await person();await unload(s,null,{text:'RSVP to the party\nReply to the swimming coach',via:'text'},MON);
 const first=(await recommend(s,{minutes:5,exclude:[]},MON)).recommendation;await skip(s,first.taskId,MON);
 const second=(await recommend(s,{minutes:5,exclude:[]},MON)).recommendation;assert.notEqual(second.taskId,first.taskId);
 assert.ok((await openTasks(s)).some(t=>t.id===first.taskId),'not deleted');
 const another=(await recommend(s,{minutes:5,exclude:[second.taskId]},MON)).recommendation;assert.equal(another,null,'nothing else fits; the skipped one waits a day');
});
test('stability: asking again for the same time soon gives the same suggestion',async()=>{
 const s=await person();await unload(s,null,{text:'RSVP to the party\nReply to the swimming coach\nConfirm the playdate',via:'text'},MON);
 const a=(await recommend(s,{minutes:5,exclude:[]},MON)).recommendation;const b=(await recommend(s,{minutes:5,exclude:[]},at('2026-11-16T10:20:00+11:00'))).recommendation;assert.equal(a.taskId,b.taskId);
 const trace=(await ensureProfile(s)).rreTrace;assert.ok(trace.length>=2);assert.equal(trace[0].rules,'rre-1');assert.ok(trace[0].considered.length>=3);
});
test('nothing fits: no busywork, and Bear says what would',async()=>{
 const s=await person();await addOne(s,{title:'Paint the fence',listId:null},MON);
 const m=await recommend(s,{minutes:5,exclude:[]},MON);assert.equal(m.recommendation,null);assert.match(m.message,/next thing takes about/);assert.ok(m.suggestMinutes>5);
 const empty=await recommend(await person(),{minutes:10,exclude:[]},MON);assert.equal(empty.message,'Nothing needs your attention right now.');
});
test('phone calls wait for opening hours',async()=>{
 const s=await person();await addOne(s,{title:'Call the plumber',listId:null},MON);
 assert.equal((await recommend(s,{minutes:10,exclude:[]},at('2026-11-16T21:30:00+11:00'))).recommendation,null);
});

test('Bear Brain: counts, the six categories in order, priority actions with reasons, and corrections are kept',async()=>{
 const s=await person();await unload(s,null,{text:'Sarah needs a red scrunchie for Friday\nCall the dentist\nFollow up with the builder\nTidy the garage\nPay the water bill by Wednesday\nLearn to play the piano one day',via:'text'},MON);
 const b=await brainView(s,MON);assert.equal(b.total,6);
 assert.deepEqual(b.categories.map(c=>c.title),['Night Time','Phone Calls','Organise Follow-Up','Organise Time-Permitting','This Week & Weekend','Aspirations']);
 const where=w=>b.categories.find(c=>c.items.some(i=>i.title.toLowerCase().includes(w))).title;
 assert.equal(where('dentist'),'Phone Calls');assert.equal(where('builder'),'Organise Follow-Up');assert.equal(where('piano'),'Aspirations');assert.equal(where('garage'),'Organise Time-Permitting');
 assert.ok(b.priority.some(p=>/water bill/i.test(p.title)&&p.reason),'a bill due in two days needs attention');assert.ok(!b.priority.some(p=>/piano/.test(p.title)));
 const garage=b.categories.flatMap(c=>c.items).find(i=>/garage/i.test(i.title));
 await moveTask(s,garage.id,{listId:'night'},MON);
 const b2=await brainView(s,MON);const g2=b2.categories.flatMap(c=>c.items).find(i=>i.id===garage.id);assert.equal(g2.category,'night');assert.equal(g2.categoryBy,'you');
 assert.ok((await ensureProfile(s)).listLearning.some(l=>l.word==='garage'&&l.listId==='night'),'the correction is a preference signal');
});

test('preferences: one choice is an observation, several make an inference, explicit always wins, and she can remove them',async()=>{
 let p=learn([],'purchase_method','online','observed',MON);assert.equal(p[0].source,'observed');assert.equal(purchasePreference(p).method,null,'one choice is not a rule');
 p=learn(p,'purchase_method','online','observed',MON);p=learn(p,'purchase_method','online','observed',MON);assert.equal(p[0].source,'inferred');assert.equal(purchasePreference(p).method,'online');
 p=learn(p,'purchase_method','in_person','explicit',MON);assert.equal(p[0].value,'in_person');assert.equal(p[0].source,'explicit');
 const s=await person();await setPreference(s,{dimension:'purchase_method',value:'online'},MON);const list=await preferencesView(s);assert.equal(list[0].text,'Prefers ordering online when it saves a trip');
 await removePreference(s,list[0].id);assert.equal((await preferencesView(s)).length,0);
});

test('safety: nobody can act on someone else’s responsibility; Bear never claims to have bought or sent anything',async()=>{
 const a=await person('A');const b=await person('B');const t=await addOne(a,{title:'Order school shoes',listId:null},MON);
 await assert.rejects(giveToBear(b,null,t.id,MON));await assert.rejects(stepAction(b,t.id,{action:'done'},MON));await assert.rejects(detailView(b,t.id,MON));
 const d=await giveToBear(a,null,t.id,MON);assert.doesNotMatch(JSON.stringify(d.log),/ordered|purchased|sent|booked|submitted/i);
 assert.equal((await a.get('tasks',t.id)).status,'open');
});
