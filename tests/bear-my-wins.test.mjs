// My Wins: a plain count of things done (this week, this month, all time) and the latest ones; undo takes it back off,
// examples never count, and a task ticked twice counts once.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {addOne} from '../lib/bear/board/service.ts';
import {completeTask,completeSchema} from '../lib/bear/services/completion.ts';
import {reopenTask} from '../lib/bear/services/task-edit.ts';
import {myWins} from '../lib/bear/services/my-wins.ts';

const s=new MemoryBackend().for('3c3c3c3c-0000-4000-8000-000000000001');
const done=(id,at)=>completeTask(s,completeSchema.parse({taskId:id,method:null}),new Date(at));
test('counts by her week (from Monday) and month, newest first; undo and examples don’t count; ticked twice counts once',async()=>{
 await ensureProfile(s);await saveProfile(s,{name:'Sarah',onboardingComplete:true});
 const [a,b,c,d,e]=await Promise.all(['Old one','Last month','Monday','Today','Example'].map(t=>addOne(s,{title:t,listId:null})));
 await done(a.id,'2026-09-10T10:00:00+10:00');await done(b.id,'2026-10-31T22:00:00+11:00');
 await done(c.id,'2026-11-23T08:00:00+11:00');await done(d.id,'2026-11-25T09:00:00+11:00');
 await s.update('tasks',e.id,{isDemo:true});await done(e.id,'2026-11-25T09:30:00+11:00');
 const now=new Date('2026-11-25T12:00:00+11:00');
 let w=await myWins(s,now);
 assert.deepEqual({total:w.total,week:w.week,month:w.month},{total:4,week:2,month:2});
 assert.deepEqual(w.recent.map(r=>r.title),['Today','Monday','Last month','Old one']);
 await reopenTask(s,d.id);w=await myWins(s,now);assert.equal(w.total,3,'undone comes back off');assert.equal(w.week,1);
 await done(d.id,'2026-11-25T10:00:00+11:00');w=await myWins(s,now);assert.equal(w.total,4,'ticked again counts once');
});
