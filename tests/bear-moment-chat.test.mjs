// Got a Moment?: the conversation's own rules: safety, the answer without the AI, the tools onto the responsibility engine
// (prepare only, never send), the private conversation, and the bounded context Bear reads back.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload,openTasks} from '../lib/bear/board/service.ts';
import {momentSystemPrompt,momentTools,needsSafety,withSafety,SAFETY_LINE,minutesIn,offlineReply,findResponsibilities,suggestForTime,prepareHelp,draftMessage,loadConversation,saveConversation,contextTurns,sendSchema,KEEP_MESSAGES,CONTEXT_MESSAGES} from '../lib/bear/services/moment-chat.ts';
import {structuredOutputSchema} from '../lib/bear/ai/schema-subset.ts';

const MON=new Date('2026-11-16T10:00:00+11:00');
const backend=new MemoryBackend();let n=0;
async function person(){const s=backend.for(`d0d0d0d0-0000-4000-8000-${String(++n).padStart(12,'0')}`);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home'],onboardingComplete:true,family:[{name:'Ava',relation:'child',age:8,yearLevel:null,school:null,allergies:null,notes:null}]});return s;}

test('the instructions: one conversation, not a therapist, rest means rest, ask before doing, never claim a send',()=>{
 const p=momentSystemPrompt({today:'2026-11-16',weekday:'Monday',name:'Sarah',children:['Ava']});
 for(const re of [/not a therapist/,/vent, rest or unwind, stay with that/,/Ask before moving from talking to doing/,/Never guess at anyone else's motives/,/Lifeline 13 11 14/,/cannot send email or texts/,/never anything private/,/Never say something was sent, booked, paid, shared or arranged/])assert.match(p,re);
 assert.ok(!/mood|1 to 10|scale/i.test(p),'no mood questionnaire');
 for(const tl of momentTools)assert.ok(structuredOutputSchema(tl.input_schema),tl.name);
});
test('safety: a danger sign always gets 000 and Lifeline, even if the reply forgot',()=>{
 assert.ok(needsSafety('honestly I want to die'));assert.ok(needsSafety('I keep thinking about hurting myself'));
 assert.ok(!needsSafety('this day is killing me, so much to do'),'ordinary venting is not a crisis');
 assert.ok(withSafety('I’m here.','I want to die').includes('13 11 14'));assert.equal(withSafety('All good.','long day'),'All good.');
});
test('time in her words',()=>{
 assert.equal(minutesIn('I’ve got 10 minutes'),10);assert.equal(minutesIn('maybe 5 mins'),5);assert.equal(minutesIn('half an hour free'),30);
 assert.equal(minutesIn('a few minutes'),5);assert.equal(minutesIn('just tired'),null);
});
test('without the AI: a time finds one thing through the engine; otherwise Bear says plainly it can’t chat properly',async()=>{
 const s=await person();await unload(s,null,{text:'Reply to the school email\nOrganise Christmas presents',via:'text'},MON);
 const r=await offlineReply(s,'I have 10 minutes',MON);assert.equal(r.actions.length,1);assert.equal(r.actions[0].kind,'suggestion');assert.equal(r.actions[0].state,'proposed');assert.ok(r.actions[0].taskId);
 const c=await offlineReply(s,'Rough day',MON);assert.equal(c.actions.length,0);assert.match(c.text,/thinking service isn’t connected/);
 const d=await offlineReply(s,'I want to die',MON);assert.equal(d.text,SAFETY_LINE);
});
test('tools: find by topic, prepare only (ready for review, nothing sent), a draft is never a send, bad ids are refused',async()=>{
 const s=await person();await unload(s,null,{text:'Follow up with the school about the excursion\nBook the dentist',via:'text'},MON);
 const f=await findResponsibilities(s,'school excursion',MON);assert.equal(f.actions.length,1);assert.match(f.actions[0].title,/excursion/i);assert.match(f.result,/task_id [0-9a-f-]{36}/);
 const none=await findResponsibilities(s,'piano lessons',MON);assert.equal(none.actions.length,0);assert.match(none.result,/Nothing on her list matches/);
 const top=await findResponsibilities(s,null,MON);assert.equal(top.actions.length,2);
 const p=await prepareHelp(s,null,f.actions[0].taskId,MON);
 assert.ok(p.actions.length===1);assert.ok(['prepared','responsibility'].includes(p.actions[0].kind));
 if(p.actions[0].kind==='prepared'){assert.equal(p.actions[0].state,'ready_for_review');assert.match(p.result,/nothing sent or bought/);}
 assert.match((await prepareHelp(s,null,'not-an-id',MON)).result,/not one of her tasks/);
 assert.match((await prepareHelp(s,null,'00000000-0000-4000-8000-000000000000',MON)).result,/not open/);
 const d=await draftMessage(s,{task_id:f.actions[0].taskId,channel:'email',to:'Mrs Lee',subject:'Excursion form',body:'Hi Mrs Lee, could you resend the excursion form? Thanks, Sarah'});
 assert.equal(d.actions[0].kind,'draft');assert.equal(d.actions[0].state,'ready_for_review');assert.match(d.result,/cannot send it/);
 assert.match((await draftMessage(s,{channel:'email'})).result,/right shape/);
 assert.equal((await openTasks(s)).length,2,'looking and preparing never adds or removes tasks');
});
test('suggest_for_time: the old time buttons’ suggestion, through the same engine',async()=>{
 const s=await person();await unload(s,null,{text:'Organise Christmas presents',via:'text'},MON);
 const r=await suggestForTime(s,10,MON);assert.equal(r.actions[0].kind,'suggestion');assert.ok(r.actions[0].label&&r.actions[0].minutes);
 const empty=await person();const e=await suggestForTime(empty,10,MON);assert.equal(e.actions.length,0);assert.ok(e.result.length>0);
});
test('the conversation is kept privately on her own profile, capped, and Bear reads back only the current sitting',async()=>{
 const s=await person();const other=await person();
 const msgs=Array.from({length:KEEP_MESSAGES+10},(_,i)=>({id:`m-${String(i).padStart(8,'0')}`,role:i%2?'bear':'user',at:new Date(MON.getTime()+i*60000).toISOString(),text:`message ${i}`}));
 await saveConversation(s,msgs);const kept=await loadConversation(s);assert.equal(kept.length,KEEP_MESSAGES);assert.equal(kept.at(-1).text,`message ${KEEP_MESSAGES+9}`);
 assert.deepEqual(await loadConversation(other),[],'never visible to anyone else');
 const old=[{id:'m-aaaaaaa1',role:'user',at:'2026-11-10T09:00:00Z',text:'last week'},{id:'b-aaaaaaa1',role:'bear',at:'2026-11-10T09:00:05Z',text:'reply'},{id:'m-aaaaaaa2',role:'user',at:'2026-11-16T09:00:00Z',text:'today'}];
 assert.deepEqual(contextTurns(old).map(t=>t.content),['today'],'a long gap starts a new sitting');
 assert.ok(contextTurns(msgs).length<=CONTEXT_MESSAGES);assert.equal(contextTurns(msgs)[0].role,'user');
 assert.ok(sendSchema.safeParse({id:'m-abc12345',text:'hi'}).success);assert.ok(!sendSchema.safeParse({id:'x',text:'hi'}).success);assert.ok(!sendSchema.safeParse({id:'m-abc12345',text:'  '}).success);
});
