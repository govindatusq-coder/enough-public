// Drop Bear's own reading (no AI): a request phrased to Bear becomes a task in plain words, the time of day she said is kept,
// and the background she gave ("I'm working all day", "budget around $45") is context, never a task or a purchase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sortOne,segment,timeOf,withoutContext} from '../lib/bear/services/sorter.ts';

const TUE='2026-11-24';
test('times of day she said, as HH:MM; bare numbers are never times',()=>{
 assert.equal(timeOf('before Friday 09:00').time,'09:00');assert.equal(timeOf('pick up at 3 pm').time,'15:00');assert.equal(timeOf('by 4.15pm').time,'16:15');
 assert.equal(timeOf('12am').time,'00:00');assert.equal(timeOf('buy 2 bags of potting mix'),null);assert.equal(timeOf('room 12'),null);
});
test('“Can you handle…” comes off; the task reads as a task; the date and time are fields',()=>{
 const s=sortOne('Can you handle tidying the home office desk and organizing cords before Saturday 10:00?',TUE);
 assert.equal(s.title,'Tidy the home office desk and organizing cords');assert.equal(s.deadline,'2026-11-28');assert.equal(s.time,'10:00');
 assert.equal(sortOne('Could you please sort out planning weekly dinners by Friday',TUE).title,'Plan weekly dinners');
 assert.equal(sortOne('Swimming lessons on Friday',TUE).title,'Swimming lessons','no request, nothing rewritten');
 assert.equal(sortOne('Book the dentist at 3pm',TUE).time,null,'a time with no date is not kept as a due time');
});
test('background sentences are context, not tasks',()=>{
 const msg='Can you handle paying the school fees before Friday 09:00? I am working most of the day. Please avoid extra errands if possible. Budget around A$45 if we need to buy something. I have not checked what we already have.';
 assert.equal(withoutContext(msg),'Can you handle paying the school fees before Friday 09:00?');
 const parts=segment(msg);assert.equal(parts.length,1);const s=sortOne(parts[0],TUE);assert.equal(s.title,'Pay the school fees');assert.doesNotMatch(s.original,/budget|buy/i);
 assert.equal(withoutContext('Buy milk. Call Mum.'),'Buy milk. Call Mum.','real tasks are never dropped');
 assert.equal(withoutContext('I am out of milk.'),'I am out of milk.','a single sentence is left as it is');
 assert.equal(withoutContext('I am out of milk. Call Mum.'),'I am out of milk. Call Mum.','“I am out of milk” is a task, not background');
});
