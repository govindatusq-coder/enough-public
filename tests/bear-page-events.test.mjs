// A page with several events on it becomes several tasks, each with its own date; a date that does not hold up is dropped.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {checkEvents,eventsToSorted,keepOnPage,readPageEvents} from '../lib/bear/services/page-events.ts';
import {placePage} from '../lib/bear/services/sort-service.ts';

const TODAY='2026-11-14';const NOW=new Date('2026-11-14T10:00:00+11:00');
const ev=(o)=>({title:'x',date:null,endDate:null,time:null,action:null,actionDue:null,source:'',...o});
const PAGE={events:[
 ev({title:'School photos',date:'2026-11-17',source:'Tue 17 Nov – School photos (full uniform)'}),
 ev({title:'Year 3 excursion to the zoo',date:'2026-11-20',time:'09:00',action:'Return the permission form',actionDue:'2026-11-18',source:'Fri 20 Nov – Year 3 excursion to the zoo, 9am. Permission form due Wed 18 Nov'}),
 ev({title:'Swimming carnival',date:'2026-11-26',source:'Thursday 26 November: Swimming carnival'}),
 ev({title:'Book fair',date:'2026-12-01',endDate:'2026-12-03',source:'1–3 Dec Book fair in the library'}),
 ev({title:'Christmas concert',date:'2026-12-09',time:'18:00',source:'Wed 9 Dec Christmas concert 6pm'}),
 ev({title:'Term 4 ends',date:'2026-12-11',source:'Fri 11 Dec Term 4 ends'}),
 ev({title:'Uniform shop sale',date:null,source:'Uniform shop sale – date to be confirmed'}),
]};
async function person(){const s=new MemoryBackend().for('91919191-9191-4919-8919-919191919191');await ensureProfile(s);await saveProfile(s,{name:'G',areas:['family'],onboardingComplete:true});return s;}

test('every event on the page is kept as its own entry with its own date',()=>{
 const e=checkEvents(PAGE,TODAY,null);assert.equal(e.length,7);assert.deepEqual(e.map(x=>x.date),['2026-11-17','2026-11-20','2026-11-26','2026-12-01','2026-12-09','2026-12-11',null]);
 assert.equal(e[1].actionDue,'2026-11-18');assert.equal(e[1].time,'09:00');assert.equal(e[3].endDate,'2026-12-03');
});
test('a date is only believed if it holds up',()=>{
 const one=o=>checkEvents({events:[ev({title:'Thing',source:'Thing',...o})]},TODAY,null)[0];
 assert.equal(one({date:'2026-11-18',source:'Fri 18 Nov Thing'}).date,null,'18 Nov 2026 is a Wednesday, not a Friday, and no nearby year fits');
 assert.equal(one({date:'2025-11-20',source:'Fri 20 Nov Thing'}).date,'2026-11-20','the wrong year is corrected when the weekday says so');
 assert.equal(one({date:'20 November'}).date,null);assert.equal(one({date:'2026-02-30'}).date,null);assert.equal(one({date:'2029-06-01'}).date,null,'implausibly far off');assert.equal(one({date:'2026-06-01'}).date,null,'long gone');
 assert.equal(one({date:'2026-11-20',actionDue:'2026-11-25'}).actionDue,null,'an action cannot be due after its event');
 assert.equal(one({date:'2026-11-20',endDate:'2026-11-19'}).endDate,null);assert.equal(one({date:'2026-11-20',time:'9am'}).time,null);
 assert.deepEqual(checkEvents({events:'nope'},TODAY,null),[]);assert.deepEqual(checkEvents({events:[{title:'x'}]},TODAY,null),[]);
 assert.equal(checkEvents({events:[PAGE.events[0],PAGE.events[0]]},TODAY,null).length,1,'the same entry twice is one');
});
test('entries whose words are not on the page are dropped',()=>{
 const transcript='Tue 17 Nov School photos full uniform. Thursday 26 November Swimming carnival.';
 const kept=keepOnPage(checkEvents(PAGE,TODAY,null),transcript);assert.deepEqual(kept.map(e=>e.title),['School photos','Swimming carnival']);
 assert.equal(keepOnPage(checkEvents(PAGE,TODAY,null),null).length,7,'with no transcript to check against, nothing is dropped');
});
test('each event becomes its own sorted item: dated by what needs the parent, never by a guess',()=>{
 const s=eventsToSorted(checkEvents(PAGE,TODAY,null),TODAY,['Ava']);assert.equal(s.length,7);
 const zoo=s.find(x=>/zoo/i.test(x.title));assert.equal(zoo.deadline,'2026-11-18','the form is due before the trip, so that is the date that matters');assert.match(zoo.title,/^Return the permission form for /);
 const sale=s.find(x=>/Uniform/.test(x.title));assert.deepEqual([sale.deadline,sale.deadlineSource],[null,null]);
 assert.ok(s.every(x=>x.domain==='family'),'a school page is family');
 assert.deepEqual(s.map(x=>x.light).slice(0,3),['amber','amber','amber']);assert.equal(s.find(x=>/Term 4/.test(x.title)).light,'green');
 const past=eventsToSorted(checkEvents({events:[ev({title:'Athletics day',date:'2026-11-03',source:'Tue 3 Nov Athletics day'}),PAGE.events[0]]},TODAY,null),TODAY);assert.deepEqual(past.map(x=>x.title),['School photos'],'something already past is left out');
});
test('a photographed page ends up as separate tasks in the right area, with dates and reminders, and no duplicates on a second go',async()=>{
 const s=await person();const provider=new FakeProvider(()=>PAGE);
 const events=await readPageEvents(provider,{text:null,images:[{mime:'image/png',bytes:new Uint8Array([1,2,3])}],documents:[]},TODAY);
 assert.equal(provider.calls[0].images.length,1,'the picture itself is what is read');assert.match(provider.calls[0].system,/EVERY separate event/);
 const items=await placePage(s,events,TODAY,[],NOW);assert.equal(items.length,7);assert.ok(items.every(i=>i.taskId&&!i.error),JSON.stringify(items.filter(i=>!i.taskId)));
 const tasks=(await s.list('tasks')).filter(t=>t.status==='open');assert.equal(tasks.length,7);
 assert.deepEqual(tasks.map(t=>t.dueAt).sort(),['2026-11-17','2026-11-18','2026-11-26','2026-12-01','2026-12-09','2026-12-11',null].sort());
 const zoo=tasks.find(t=>/zoo/i.test(t.title));assert.ok(/On 2026-11-20 at 09:00/.test(zoo.notes)&&/From a page you gave Bear/.test(zoo.notes),'the day of the event itself is kept in the notes');
 assert.equal((await homeView(s,NOW)).areas.find(a=>a.key==='family').open,7);
 assert.ok((await s.list('reminders')).filter(r=>r.status==='scheduled').length>=6,'every dated one has a reminder');
 const again=await placePage(s,events,TODAY,[],NOW);assert.ok(again.every(i=>i.already));assert.equal((await s.list('tasks')).filter(t=>t.status==='open').length,7);
});
test('if the page cannot be listed, Bear falls back to its ordinary reading instead of failing',async()=>{
 const {ProviderError}=await import('../lib/bear/ai/provider.ts');
 assert.deepEqual(await readPageEvents(new FakeProvider(()=>new ProviderError('busy','rate_limited')),{text:'x',images:[],documents:[]},TODAY),[]);
 assert.deepEqual(await readPageEvents(new FakeProvider(()=>({nonsense:true})),{text:'x',images:[],documents:[]},TODAY),[]);
});

// ---------- a link to a page ----------
test('a message that is a link means "read this page"; a long message that mentions one does not',async()=>{
 const {linkIn}=await import('../lib/bear/services/lookup.ts');
 assert.equal(linkIn('https://www.school.example.edu.au/term-4-dates'),'https://www.school.example.edu.au/term-4-dates');
 assert.equal(linkIn('Term 4 dates | Our School\nhttps://school.example/term4?x=1.'),'https://school.example/term4?x=1');
 assert.equal(linkIn('read this for me https://school.example/news and add the dates'),'https://school.example/news');
 for(const t of ['call the school about the excursion','www.school.example','ftp://school.example/file','http://localhost:3000/x','http://192.168.1.1/admin','https://nodots/x',
  'Hi parents, a long newsletter with lots of words in it about many things happening this term, see https://school.example/news for the rest of it'])assert.equal(linkIn(t),null,t);
});
test('a page read from a link becomes its separate dated tasks; a page that cannot be opened is said plainly',async()=>{
 const {readLink,linkNote}=await import('../lib/bear/services/sort-service.ts');const {DAILY_LOOKUPS}=await import('../lib/bear/services/lookup.ts');
 const s=await person();const calls=[];const reader=out=>async(url,today)=>{calls.push(url);if(out instanceof Error)throw out;return {usage:{inputTokens:5000,outputTokens:600},model:'fake',...out};};
 const ok=await readLink(s,reader({events:PAGE,failed:false}),'https://school.example/term4',TODAY,NOW);assert.equal(ok.events.length,7);assert.equal(ok.why,null);
 const items=await placePage(s,ok.events,TODAY,[],NOW);assert.equal(items.filter(i=>i.taskId).length,7);
 const log=(await s.list('ai_inferences')).filter(i=>i.service==='WebLookup');assert.equal(log.length,1);assert.deepEqual(log[0].rawOutput,{opened:true,events:7},'counts only');
 const wall=await readLink(s,reader({events:null,failed:true}),'https://portal.example/login',TODAY,NOW);assert.deepEqual([wall.events.length,wall.why],[0,'unreadable']);assert.match(linkNote(wall.why),/may need a login.*PDF.*screenshots/);
 assert.equal((await readLink(s,reader(new Error('network')),'https://x.example/a',TODAY,NOW)).why,'unreadable');
 assert.equal((await readLink(s,reader({events:{events:[]},failed:false}),'https://x.example/b',TODAY,NOW)).why,'nothing');
 assert.equal((await readLink(s,null,'https://x.example/c',TODAY,NOW)).why,'off');
 const before=calls.length;for(let i=(await s.list('ai_inferences')).filter(x=>x.service==='WebLookup').length;i<DAILY_LOOKUPS;i++)await readLink(s,reader({events:{events:[]},failed:false}),'https://x.example/d',TODAY,NOW);
 const over=await readLink(s,reader({events:PAGE,failed:false}),'https://x.example/e',TODAY,NOW);assert.equal(over.why,'limit');assert.ok(calls.length>before&&calls[calls.length-1]!=='https://x.example/e','past the daily allowance the page is not fetched');
});
