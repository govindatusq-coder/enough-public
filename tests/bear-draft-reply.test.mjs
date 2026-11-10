// Draft replies in the Outlook panel: only for scheduling questions, never claims a time works, safe with untrusted text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {draftReply,firstName,schedulingOptions} from '../lib/bear/outlook/draft.ts';
import {decide} from '../lib/bear/engine/decide.ts';

const Q='Hello. Could we do 3pm or 4pm on Tuesday 24th? I have another meeting at 1pm. Thanks.';
test('the scheduling question gets a draft with the options in brackets, never a claim that a time works',()=>{
 const d=decide(Q);assert.equal(d.rule,'scheduling-question');
 const r=draftReply({from:'Dr. Zahra Izadikhah <z@example.edu>',text:Q,decision:d.decision,rule:d.rule});
 assert.equal(r.text,'Hi Zahra,\n\nThanks for your email. [Pick one: 3pm / 4pm] on Tuesday 24th works for me.\n\nKind regards','the sender’s 1pm clash is not offered as an option');
});
test('options and day are read with fixed patterns',()=>{
 assert.deepEqual(schedulingOptions('Could we do 3pm or 4pm on Tuesday 24th?'),{times:['3pm','4pm'],day:'Tuesday 24th'});
 assert.deepEqual(schedulingOptions('Are you free at 10:30 AM, Friday?'),{times:['10:30am'],day:'Friday'});
 assert.deepEqual(schedulingOptions('Are you free sometime?'),{times:[],day:null});
 assert.equal(schedulingOptions('1pm 2pm 3pm 4pm 5pm').times.length,3,'at most three options');
});
test('with no time given the draft asks the person to suggest one',()=>{
 const r=draftReply({from:'Sam Lee <s@x.com>',text:'Are you free on Friday?',decision:'ACT',rule:'scheduling-question'});
 assert.match(r.text,/\[Suggest a time\] on Friday works for me/);
});
test('only scheduling questions get a draft: not other requests, not anything else',()=>{
 for(const [decision,rule] of [['ACT','explicit-request'],['ACT','dated-reminder'],['ASK','fyi-or-uncertain'],['WAIT','awaiting-reply-or-decision'],['IGNORE','no-responsibility-found'],['CLOSE','receipt-or-submission'],['UPDATE','cancelled-or-moved']])
  assert.equal(draftReply({from:'A B <a@b.c>',text:Q,decision,rule}),null,rule);
});
test('first names: titles dropped, odd names and bare addresses give a plain greeting',()=>{
 assert.equal(firstName('Prof Gavin Beccaria <g@x.edu>'),'Gavin');assert.equal(firstName('Mrs. Jo O’Hara'),'Jo');
 assert.equal(firstName('a.person@x.com'),null);assert.equal(firstName('<img src=x onerror=alert(1)> <a@b.c>'),null);assert.equal(firstName(null),null);
 assert.equal(draftReply({from:null,text:Q,decision:'ACT',rule:'scheduling-question'}).text.split('\n')[0],'Hi,');
});
test('untrusted text is escaped in the HTML draft',()=>{
 const r=draftReply({from:'Eve <e@x.com>',text:'Could we do <script>alert(1)</script> 3pm on Monday?',decision:'ACT',rule:'scheduling-question'});
 assert.ok(!/<script|onerror/i.test(r.html));assert.match(r.html,/^<p>Hi Eve,<\/p>/);
 // The brackets in the text survive, so the person is told where to edit.
 assert.match(r.html,/\[Pick one: 3pm\]/);
});
