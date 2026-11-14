// "Where does this go?": moving a task to another area without disturbing its neighbours.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {setTaskArea,areaSchema} from '../lib/bear/services/task-edit.ts';
async function one(text){const s=new MemoryBackend().for('51515151-5151-4515-8515-515151515151');await ensureProfile(s);await saveProfile(s,{name:'S',areas:['family','home'],onboardingComplete:true});
 const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});const r=await maybeAutoSetup(s,extraction,new Date('2026-11-09T09:00:00+11:00'));return {s,task:r.task};}
const areaOf=async(s,id)=>{const t=await s.get('tasks',id);return (await s.get('projects',t.projectId)).areaKey;};
test('a task moves to the chosen area and stays one task',async()=>{
 const {s,task}=await one('Book the car service for next Tuesday');const before=(await s.list('tasks')).length;
 await setTaskArea(s,task.id,'work');assert.equal(await areaOf(s,task.id),'work');assert.equal((await s.list('tasks')).length,before);
 await setTaskArea(s,task.id,'work');assert.equal(await areaOf(s,task.id),'work','choosing the same area again changes nothing');
});
test('moving one task leaves the others in its project where they were',async()=>{
 const {s,task}=await one('Book the car service for next Tuesday');const t=await s.get('tasks',task.id);const from=await areaOf(s,task.id);
 const {id:_i,...copy}=t;const sibling=await s.insert('tasks',{...copy,id:'61616161-6161-4616-8616-616161616161',title:'Sibling'});
 const to=from==='health'?'home':'health';await setTaskArea(s,task.id,to);
 assert.equal(await areaOf(s,task.id),to);assert.equal(await areaOf(s,sibling.id),from);
});
test('only real areas are accepted',()=>{assert.ok(areaSchema.safeParse({area:'family'}).success);assert.ok(!areaSchema.safeParse({area:'school'}).success);assert.ok(!areaSchema.safeParse({area:'family',x:1}).success);});
