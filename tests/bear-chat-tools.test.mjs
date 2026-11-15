// What the chat's AI is allowed to do: add tasks (dates from the person's own words) and change one it just added.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {runAddTasks,runChangeTask,addTasksTool,changeTaskTool} from '../lib/bear/services/chat-tools.ts';
import {chatSystemPrompt} from '../lib/bear/services/chat-prompt.ts';

const TODAY='2026-11-14';const NOW=new Date('2026-11-14T10:00:00+11:00');
async function person(){const s=new MemoryBackend().for('a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1');await ensureProfile(s);await saveProfile(s,{name:'Govind',areas:['family'],onboardingComplete:true});return s;}

test('add_tasks: each thing becomes a task; the date comes from the person’s words, not the AI',async()=>{
 const s=await person();const said='pay the electricity bill tomorrow and book Ava a dentist appointment';
 const {items,result}=await runAddTasks(s,{tasks:[{original:'pay the electricity bill tomorrow',title:'Pay the electricity bill',area:'money'},{original:'book Ava a dentist appointment',title:'Book Ava’s dentist appointment',area:'health'}]},said,TODAY,['Ava'],NOW);
 assert.equal(items.length,2);assert.ok(items.every(i=>i.taskId));assert.equal(items[0].deadline,'2026-11-15');assert.equal(items[1].deadline,null,'no date said, none invented');
 assert.deepEqual(items.map(i=>i.domain),['money','health']);assert.match(result,/do not list them again/);
});
test('add_tasks: a name nobody mentioned is not let into a title; a bad request adds nothing',async()=>{
 const s=await person();
 const {items}=await runAddTasks(s,{tasks:[{original:'book the dentist',title:'Book Oliver’s dentist appointment',area:'health'}]},'book the dentist',TODAY,[],NOW);
 assert.ok(!/Oliver/.test(items[0].title),items[0].title);
 const bad=await runAddTasks(s,{tasks:[{original:'x',area:'school'}]},'',TODAY,[],NOW);assert.deepEqual(bad.items,[]);assert.match(bad.result,/Not added/);
 assert.equal((await s.list('tasks')).filter(t=>t.status==='open').length,1);
});
test('change_task: one correction changes the right one, and only that one',async()=>{
 const s=await person();const {items}=await runAddTasks(s,{tasks:[{original:'book a dentist appointment',title:'Book a dentist appointment',area:'health'},{original:'clean out the garage sometime',title:'Clean out the garage',area:'home'}]},'',TODAY,[],NOW);
 const ids=items.map(i=>i.taskId);
 const r=await runChangeTask(s,{task:'dentist',priority:'urgent',area:null,due:null},ids,TODAY,NOW);assert.equal(r.item.taskId,ids[0]);assert.equal(r.item.light,'red');
 assert.equal((await s.get('tasks',ids[1])).light,undefined,'the other is untouched');
 const d=await runChangeTask(s,{task:'garage',priority:null,area:'me',due:'Friday'},ids,TODAY,NOW);assert.deepEqual([d.item.domain,d.item.deadline],['me','2026-11-20']);
 assert.equal((await runChangeTask(s,{task:'passport',priority:'urgent',area:null,due:null},ids,TODAY,NOW)).item,null,'nothing matching: nothing changed');
 assert.equal((await runChangeTask(s,{task:'dentist',priority:'urgent',area:null,due:null},[],TODAY,NOW)).item,null,'only things from this conversation can be changed');
});
test('the tools and the instructions say what they must',()=>{
 for(const tool of [addTasksTool,changeTaskTool]){assert.equal(tool.strict,true);assert.equal(tool.input_schema.additionalProperties,false);}
 const p=chatSystemPrompt({today:TODAY,weekday:'Saturday',name:'Govind',children:['Ava']});
 assert.match(p,/Just talking/);assert.match(p,/Do not add tasks/);assert.match(p,/Never ask more than one question/);assert.match(p,/never say you have/);assert.match(p,/Govind/);assert.match(p,/Ava/);
});
