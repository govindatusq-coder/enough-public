// Adaptive Responsibility Engine, onboarding and lists: answers are scored on the server, a suggested set of lists can be
// chosen (nothing deleted), Bear Brain places things by what they are, learns from her moves, and existing users keep theirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload,moveTask,boardView} from '../lib/bear/board/service.ts';
import {brainView} from '../lib/bear/rre/service.ts';
import {saveAnswers,chooseListStyle,adaptiveView,resetAdaptive} from '../lib/bear/adaptive/service.ts';

const MON=new Date('2026-11-23T10:00:00+11:00');const backend=new MemoryBackend();let n=0;
async function person(){const s=backend.for(`ad100000-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Sarah',onboardingComplete:true});return s;}
const catOf=async(s,re)=>{const b=await brainView(s,MON);for(const c of b.categories)for(const i of c.items)if(re.test(i.title))return c.id;return null;};

test('answers are scored on the server; the view explains and suggests lists; notifications are never switched on',async()=>{
 const s=await person();const before=(await ensureProfile(s)).notification;
 const v=await saveAnswers(s,{answers:{control:'depends_others',howDone:'grab_moment',assist:['prepare'],helpers:'sometimes_if_organised',comms:'daily_checkin',country:'AU'},name:'Mia'},MON);
 assert.equal(v.recommended,'support');assert.match(v.explanation,/other people’s schedules/);assert.equal(v.country,'AU');
 const p=await ensureProfile(s);assert.equal(p.name,'Mia');assert.deepEqual(p.notification,before,'notification settings untouched');assert.equal(p.temporal.comms,'daily_checkin');
 assert.equal(v.sets.length,5);assert.equal(v.style,null,'lists are not changed by answering');
});
test('existing users keep their lists until they choose; choosing a style deletes nothing',async()=>{
 const s=await person();
 const r=await unload(s,null,{text:'Call the plumber about the leak\nPay the water bill by Friday\nBuy a birthday card for Nan\nWaiting on the school to reply about camp',via:'text'},MON);
 const call=r.added.find(a=>/plumber/i.test(a.title)).id;await moveTask(s,call,{listId:'calls'},MON);
 await saveAnswers(s,{answers:{control:'fixed_routine'}},MON);
 assert.deepEqual((await boardView(s,MON)).lists.map(l=>l.id),['night','calls','followup','spare','week','aspire'],'answering changes nothing she has');
 const v=await chooseListStyle(s,{style:'routine'},MON);
 assert.deepEqual(v.lists.map(l=>l.title),['Before Work','Business Hours','After Work','Nighttime','This Week & Weekend','Waiting on Others']);
 assert.equal(v.returned,1,'the call she filed in Phone Calls comes back to My Brain Dump, not deleted');
 assert.equal((await s.get('tasks',call)).status,'open');
 assert.equal(await catOf(s,/plumber/i),'business','placed by what it is: a call needs business hours');
 assert.equal(await catOf(s,/water bill/i),'night');
 assert.ok(['week','night'].includes(await catOf(s,/birthday card/i)));
});
test('Bear Brain for a carer with little control: what Bear can prepare, what someone else could do, what’s just hers',async()=>{
 const s=await person();await saveAnswers(s,{answers:{control:'depends_others',helpers:'regularly'}},MON);await chooseListStyle(s,{style:'support'},MON);
 await unload(s,null,{text:'Pick up the dry cleaning on Thursday\nBook my physio appointment\nCall the council about the bins\nOrganise Christmas presents',via:'text'},MON);
 assert.equal(await catOf(s,/dry cleaning/i),'someone');assert.equal(await catOf(s,/physio/i),'just_me');
 assert.equal(await catOf(s,/council/i),'arrange');assert.equal(await catOf(s,/christmas/i),'bear_prep','Bear prepares gift ideas');
});
test('her corrections teach Bear: after two moves, similar things are suggested there, whatever the wording; filed things never move',async()=>{
 const s=await person();await chooseListStyle(s,{style:'windows'},MON);
 const r=await unload(s,null,{text:'Pay the school excursion levy by Friday\nPay the swimming carnival fee by Friday\nPay the school book club order by Friday',via:'text'},MON);
 const [a,b,c]=r.added.map(x=>x.id);
 assert.notEqual(await catOf(s,/book club/i),'out');
 await moveTask(s,a,{listId:'out'},MON);await moveTask(s,b,{listId:'out'},MON);
 assert.equal(await catOf(s,/book club/i),'out','learned from two of her own moves');
 const p=await ensureProfile(s);assert.equal(p.adaptive.corrections.length,2);assert.ok(p.adaptive.corrections.every(x=>x.explicit&&x.chosen==='out'));
 await resetAdaptive(s,{what:'category'});assert.notEqual(await catOf(s,/book club/i),'out','reset forgets it');
 assert.equal((await s.get('tasks',a)).listId,'out','but what she filed stays where she put it');
 void c;
});
test('Bear’s originals behave exactly as before when she has not chosen anything',async()=>{
 const s=await person();await unload(s,null,{text:'Call the dentist\nOrganise Christmas presents',via:'text'},MON);
 assert.equal(await catOf(s,/dentist/i),'calls');assert.equal(await catOf(s,/christmas/i),'week');
 assert.equal((await adaptiveView(s)).recommended,'classic','no answers, no new lists suggested');
});
