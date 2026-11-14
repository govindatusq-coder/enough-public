// Several to-dos in one breath become several to-dos; one thing stays one thing.
import test from 'node:test';
import assert from 'node:assert/strict';
import {splitTodos} from '../lib/bear/services/split-todos.ts';
const cases=[
 ['call mum, buy milk and book the dentist',['Call mum','Buy milk','Book the dentist']],
 ['Call mum. Buy milk. Book the dentist for Friday.',['Call mum','Buy milk','Book the dentist for Friday']],
 ['I need to call mum and also pay the electricity bill and pick up the dry cleaning tomorrow',['Call mum','Pay the electricity bill','Pick up the dry cleaning tomorrow']],
 ['book car service\nbuy birthday present for Sam\nemail the school about camp',null],   // mentions camp: left to the school reader
 ['book car service\nbuy birthday present for Sam\nemail the accountant about tax',['Book car service','Buy birthday present for Sam','Email the accountant about tax']],
 ['1. renew passport 2. book flights 3. organise pet sitter',['Renew passport','Book flights','Organise pet sitter']],
 ['- renew passport\n- book flights\n- organise pet sitter',['Renew passport','Book flights','Organise pet sitter']],
 ['call mum then buy milk',['Call mum','Buy milk']],
 ['remind me to call the plumber and don’t forget to pay the rego by Friday',['Call the plumber','Pay the rego by Friday']],
 ['Book the dentist for Ava on Tuesday at 3pm, and order her school shoes',['Book the dentist for Ava on Tuesday at 3pm','Order her school shoes']],
 // one thing stays one thing
 ['buy milk, eggs and bread',null],
 ['buy milk',null],
 ['call mum',null],
 ['Book flights to Melbourne and Sydney',null],
 ['pick up Sam and Ava from school at 3',null],
 ['Organise birthday party for Sam, with cake and balloons',null],
 ['Return the excursion permission note and pay $25 by Wednesday',null],
 ['Hi parents, please return the form and pay $12 by Friday. Regards, Mr Ahmed',null],
 ['Dentist appointment Friday 3pm',null],
 ['Talk to Sam about the party, and the sleepover',null],
];
for(const [input,expected] of cases)test(`"${input.replace(/\n/g,' / ').slice(0,70)}" → ${expected?expected.length+' things':'one thing'}`,()=>{
 assert.deepEqual(splitTodos(input),expected||[input]);
});
test('long text is never split here, and there is a ceiling on how many',()=>{
 const long='call mum and buy milk. '.repeat(40);assert.deepEqual(splitTodos(long),[long]);
 const many=Array.from({length:12},(_,i)=>`call person ${i+1}`).join('\n');assert.deepEqual(splitTodos(many),[many]);
});
