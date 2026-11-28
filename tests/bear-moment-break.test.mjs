// Lighten Load's Need a Break: one idea that fits the time, shaped by her PINS interests and her "Sounds good"s, never a
// chore; "Another idea" is really different; no interests saved still works.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {BREAKS,chooseBreak,suggestBreak,likeBreak} from '../lib/bear/services/moment-break.ts';
import {momentSystemPrompt} from '../lib/bear/services/moment-chat.ts';
const NOW=new Date('2026-11-22T10:00:00+11:00');
const backend=new MemoryBackend();let n=0;
async function mum(pins){const s=backend.for(`f0f0f0f0-0000-4000-8000-${String(++n).padStart(12,'0')}`);const p=await ensureProfile(s);if(pins)await s.update('profiles',p.id,{pins:{...p.pins,...pins}});await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true});return s;}

test('every break fits the time it is offered for, and none is a chore, an email or an errand',()=>{
 for(const m of [2,5,10,20])for(let i=0;i<20;i++){const b=chooseBreak(m,[],{},[],[],new Date(NOW.getTime()+i*86400000));assert.ok(b&&b.minutes<=m,`${m}: ${b?.id}`);}
 for(const b of BREAKS)assert.ok(!/\b(email|inbox|laundry|wash(ing)? up|dishes|clean|tidy|errand|shop|bills?|chores?|work on|reply|organis)/i.test(b.title+' '+b.line),b.id);
 assert.equal(chooseBreak(1,[],{},[],[],NOW),null,'nothing fits one minute: no invented break');
});
test('her interests shape the idea; with none saved it still works',()=>{
 assert.equal(chooseBreak(10,['Movement'],{},[],[],NOW).interests.includes('Movement'),true);
 assert.equal(chooseBreak(10,['Friends'],{},[],[],NOW).interests.includes('Friends'),true);
 assert.ok(chooseBreak(10,[],{},[],[],NOW),'no PINS: still an idea');
});
test('"Another idea" never repeats and moves to a different kind of break',()=>{
 const first=chooseBreak(10,['Quiet'],{},[],[],NOW);const second=chooseBreak(10,['Quiet'],{},[],[first.id],NOW);
 assert.notEqual(second.id,first.id);assert.notEqual(second.kind,first.kind);
 const seen=[];let b;while((b=chooseBreak(2,[],{},[],seen,NOW)))seen.push(b.id);assert.equal(new Set(seen).size,BREAKS.filter(x=>x.minutes<=2).length,'every 2-minute idea once, then none');
});
test('"Sounds good" is the only thing Bear learns from, and it shows',async()=>{
 const s=await mum({interests:[]});const before=(await suggestBreak(s,{minutes:20,exclude:[]},NOW)).idea;
 await likeBreak(s,'hobby');await likeBreak(s,'hobby');await likeBreak(s,'not-a-real-idea');
 const p=await ensureProfile(s);assert.deepEqual(p.breakPrefs.liked,{hobby:2});
 const later=new Date(NOW.getTime()+2*86400000);assert.equal((await suggestBreak(s,{minutes:20,exclude:[]},later)).idea.id,'hobby');
 assert.ok(before);
});
test('Talk It Out: listen first, short, ask before doing, never turn distress into a task',()=>{
 const p=momentSystemPrompt({today:'2026-11-22',weekday:'Sunday',name:'Sarah',children:[]});
 for(const re of [/Listen before offering solutions/,/one or two short sentences/,/Want me to remember that\?/,/Never turn distress into a task/,/Nothing is saved until she approves it/])assert.match(p,re);
});
