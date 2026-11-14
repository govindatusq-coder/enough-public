// "Search for when X is on and remind me": Bear looks it up, shows what it found and where, and saves nothing until asked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {asksToFindOut,readFinding,DAILY_LOOKUPS} from '../lib/bear/services/lookup.ts';
import {lookUp,acceptFound,acceptSchema,keptNote,sortAndPlace} from '../lib/bear/services/sort-service.ts';

const TODAY='2026-11-14';const NOW=new Date('2026-11-14T10:00:00+11:00');
const Q='Search the internet for when the red bull soap car racing is on in 2026 and send me a reminder';
const PAGES=[{title:'Red Bull Soapbox Race Sydney',url:'https://www.redbull.com/au-en/events/soapbox-sydney'},{title:'What’s on',url:'https://example.org/whats-on'}];
const reply=o=>JSON.stringify({found:true,answer:'The Red Bull Soapbox Race is on Sunday 6 December 2026 at The Domain.',subject:'Red Bull Soapbox Race',date:'2026-12-06',sourceUrls:[PAGES[0].url],...o});
async function person(){const s=new MemoryBackend().for('81818181-8181-4818-8818-818181818181');await ensureProfile(s);await saveProfile(s,{name:'Govind',areas:['me'],onboardingComplete:true});return s;}
const researcher=(finding,calls=[])=>async(q,today)=>{calls.push(q);if(finding instanceof Error)throw finding;return {finding,usage:{inputTokens:900,outputTokens:120},searches:2,model:'fake'};};
const openTasks=async s=>(await s.list('tasks')).filter(t=>t.status==='open');

test('Bear knows when it is being asked to find something out',()=>{
 for(const t of [Q,'look up when the school holidays start','find out what time the pool closes on Sunday','google how much a passport renewal costs','Can you search for swimming lessons near me','please look up the opening hours for Bunnings','research when term 1 starts in 2027','Bear, find out when rego is due for renewal in NSW','check online if the library is open tomorrow'])assert.ok(asksToFindOut(t),t);
 for(const t of ['call the school to find out about camp','book the dentist','search','pay the electricity bill tomorrow','buy milk','look after mum on Sunday','check the tyres','find my keys','research project due Friday for Ava'])assert.ok(!asksToFindOut(t),t);
});
test('a web answer becomes a finding only with a real page behind it, and a date only when it is a real future day',()=>{
 const f=readFinding(reply({}),PAGES,TODAY);assert.deepEqual([f.date,f.subject,f.sources.length],['2026-12-06','Red Bull Soapbox Race',1]);assert.equal(f.sources[0].url,PAGES[0].url);
 assert.equal(readFinding(reply({sourceUrls:['https://made-up.example/page']}),PAGES,TODAY),null,'a link the search never returned is not a source');
 assert.equal(readFinding(reply({found:false}),PAGES,TODAY),null);assert.equal(readFinding('I think it is in December.',PAGES,TODAY),null,'no free-text answers');
 assert.equal(readFinding(reply({date:'2026-10-01'}),PAGES,TODAY).date,null,'a day already gone is not offered as a reminder');
 assert.equal(readFinding(reply({date:'December'}),PAGES,TODAY).date,null);assert.equal(readFinding(reply({date:null,answer:'The 2026 date has not been announced yet.'}),PAGES,TODAY).date,null);
 assert.equal(readFinding('Here you go: '+reply({})+' Hope that helps',PAGES,TODAY).date,'2026-12-06');
 assert.equal(readFinding(reply({extra:'x'}),PAGES,TODAY),null,'unexpected fields are rejected');
});
test('a finding is shown and nothing is saved: no to-do, no date, until the person says so',async()=>{
 const s=await person();const f=readFinding(reply({}),PAGES,TODAY);
 const r=await lookUp(s,researcher(f),Q,TODAY,NOW);assert.equal(r.found.answer,f.answer);assert.equal(r.found.dateLabel,'6 December 2026');assert.equal(r.found.sources[0].url,PAGES[0].url);
 assert.equal((await s.list('tasks')).length,0);assert.equal((await s.list('reminders')).length,0);assert.equal((await s.list('captures')).length,0);
 const log=await s.list('ai_inferences');assert.equal(log.length,1);assert.deepEqual([log[0].service,log[0].ok,log[0].usage.inputTokens],['WebLookup',true,900]);
 assert.ok(!JSON.stringify(log[0].rawOutput).includes('Soapbox'),'the log holds counts, not what was found');
});
test('accepting the reminder saves it with the found date, marked as found online, with its source',async()=>{
 const s=await person();const input=acceptSchema.parse({question:Q,subject:'Red Bull Soapbox Race',date:'2026-12-06',answer:'The Red Bull Soapbox Race is on Sunday 6 December 2026.',sources:[PAGES[0]]});
 const item=await acceptFound(s,input,NOW);assert.ok(item.taskId);assert.equal(item.title,'Red Bull Soapbox Race');assert.equal(item.deadline,'2026-12-06');assert.equal(item.deadlineSource,'web');assert.match(item.when,/found online/);
 const task=await s.get('tasks',item.taskId);assert.equal(task.dueAt,'2026-12-06');assert.ok(task.notes.includes(PAGES[0].url)&&/check the source/i.test(task.notes));assert.equal(task.status,'open');
 assert.ok((await s.list('reminders')).length>=1,'a reminder is planned');
 await assert.rejects(()=>acceptFound(s,{...input,date:'2026-01-01'},NOW),'a past date is refused');
 assert.ok(!acceptSchema.safeParse({...input,sources:[{title:'x',url:'javascript:alert(1)'}]}).success);assert.ok(!acceptSchema.safeParse({...input,sources:[]}).success,'never without a source');
});
test('when nothing reliable is found, or the search fails, the to-do is kept and Bear says so',async()=>{
 const s=await person();
 const none=await lookUp(s,researcher(null),Q,TODAY,NOW);assert.deepEqual([none.found,none.why],[null,'nothing']);assert.match(keptNote(none.why),/couldn’t find a reliable answer/);
 const broke=await lookUp(s,researcher(new Error('network')),Q,TODAY,NOW);assert.deepEqual([broke.found,broke.why],[null,'nothing']);assert.equal((await s.list('ai_inferences')).filter(i=>!i.ok).length,1);
 assert.deepEqual(await lookUp(s,null,Q,TODAY,NOW),{found:null,why:'off'});assert.equal(keptNote('off'),null);
 const [kept]=await sortAndPlace(s,null,Q,'text',NOW);assert.ok(kept.taskId,'the person still has it as a to-do');
});
test(`no more than ${DAILY_LOOKUPS} lookups per person per day`,async()=>{
 const s=await person();const calls=[];const r=researcher(readFinding(reply({}),PAGES,TODAY),calls);
 for(let i=0;i<DAILY_LOOKUPS;i++)assert.ok((await lookUp(s,r,Q,TODAY,NOW)).found);
 const over=await lookUp(s,r,Q,TODAY,NOW);assert.deepEqual([over.found,over.why],[null,'limit']);assert.equal(calls.length,DAILY_LOOKUPS,'the search is not even called');assert.match(keptNote('limit'),/for today/);
});

test('a reminder for something whose date the person does not know is also a thing to look up',async()=>{
 const {asksAboutTheWorld}=await import('../lib/bear/services/lookup.ts');const {sortOne}=await import('../lib/bear/services/sorter.ts');
 for(const t of ['Remind me when the next Ind NZ odi is on','remind me when the Easter Show starts','let me know when the new Bluey season comes out','tell me when Taylor Swift tickets go on sale','Remind me what date the school holidays start','when do the school holidays start in Queensland?','When is the next India v New Zealand ODI','what time does Bunnings close on Sunday','how much is a passport renewal','remind me when daylight saving ends'])assert.ok(asksAboutTheWorld(t)&&asksToFindOut(t),t);
 for(const t of ['remind me when I get home to call mum','remind me when we land','remind me to call the plumber','remind me when my rego is due','when is my dentist appointment','let me know when mum arrives','remind me tomorrow','tell me when you are done','where are my keys','when is it','who is picking up Ava today','where is the permission form','which bin goes out this week'])assert.ok(!asksAboutTheWorld(t),t);
 assert.equal(sortOne('Remind me when the next Ind NZ odi is on','2026-11-14').title,'Find out when the next Ind NZ odi is on','if the lookup comes back empty, the kept to-do says what it is');
});
