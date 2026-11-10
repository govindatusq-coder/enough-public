// Calendar files: prepared from what the source stated, never invented, never "added" by Bear.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {calendarFileFor} from '../lib/bear/services/calendar-file.ts';
import {eventForTask} from '../lib/bear/engine/calendar-event.ts';
import {calendarEventIcs,parseTime} from '../lib/bear/engine/prepare.ts';
import {history} from '../lib/bear/engine/events.ts';
const NOW=new Date('2026-11-03T09:00:00+11:00');
async function give(text,s=null){s??=new MemoryBackend().for('18181818-1818-4181-8181-181818181818');await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true,people:[{role:'child',name:'Lily'}]});
 const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});return {s,task:(await maybeAutoSetup(s,extraction,NOW))?.task};}

test('a school camp becomes an all-day file with the right dates, and the record says prepared, not added',async()=>{
 const {s,task}=await give('Hi parents, Lily’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.');
 const f=await calendarFileFor(s,task.id,NOW);assert.equal(f.filename,'load-bear-year-5-camp.ics');
 assert.match(f.ics,/DTSTART;VALUE=DATE:20261118/);assert.match(f.ics,/SUMMARY:Year 5 camp/);assert.match(f.ics,/DESCRIPTION:For Lily\./);
 assert.ok(!/20261110|20261112/.test(f.ics),'the consent and payment deadlines are not events');
 const ev=(await history(s,task.id)).find(e=>e.eventType==='action_prepared');assert.deepEqual([ev.metadata.prepared,ev.metadata.sent],[true,false]);
 assert.ok(!JSON.stringify(ev).includes('Lily'),'no names in the log');
});
test('a deadline is not an event: a form due on a date gives no calendar file',async()=>{
 const {s,task}=await give('Please return the permission form by 20 November.');assert.ok(task);
 assert.equal(await calendarFileFor(s,task.id,NOW),null);assert.equal(eventForTask(task),null);
});
test('a timed appointment keeps its clock time, is one hour, and says the length wasn’t given',()=>{
 const ics=calendarEventIcs({uid:'a1',title:'Dentist',date:'2026-12-02',time:'9:15am',location:'12 High St, Ipswich',stamp:new Date('2026-11-03T00:00:00Z')});
 assert.match(ics,/DTSTART:20261202T091500\r\n/);assert.match(ics,/DTEND:20261202T101500\r\n/);assert.match(ics,/LOCATION:12 High St\\, Ipswich/);assert.match(ics,/set to one hour/);assert.ok(!/VALUE=DATE/.test(ics));
 assert.match(calendarEventIcs({uid:'a',title:'Late',date:'2026-12-02',time:'11:30pm'}),/DTEND:20261203T003000/,'crosses midnight correctly');
});
test('times are read strictly; anything unclear stays an all-day event (never invented)',()=>{
 assert.deepEqual(['10:30','10:30am','2pm','14:00','12am','12pm'].map(parseTime),['10:30','10:30','14:00','14:00','00:00','12:00']);
 for(const bad of ['', 'noon','25:00','13pm','10:75','soon',null,undefined])assert.equal(parseTime(bad),null,String(bad));
 assert.match(calendarEventIcs({uid:'a',title:'x',date:'2026-12-02',time:'sometime'}),/VALUE=DATE:20261202/);
});
test('someone else’s responsibility, or a missing one, gives nothing',async()=>{
 const {task}=await give('Year 5 camp is on 18 November.');const other=new MemoryBackend().for('19191919-1919-4191-8191-191919191919');await ensureProfile(other);
 assert.equal(await calendarFileFor(other,task.id,NOW),null);assert.equal(await calendarFileFor(other,'nope',NOW),null);
});
