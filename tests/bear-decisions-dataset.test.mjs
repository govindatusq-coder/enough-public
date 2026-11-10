// The decision benchmark's labelled set is well-formed (labels, splits, categories, ids). Scores are in evaluation/results.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(new URL('../evaluation/dataset/decisions.json',import.meta.url),'utf8'));
const LABELS=['ACT','ASK','WAIT','UPDATE','CLOSE','IGNORE'];
test('every case has a valid label, a split, a category and unique id',()=>{
 const ids=new Set();for(const c of d.cases){assert.ok(LABELS.includes(c.expected),c.id);assert.ok(['dev','heldout'].includes(c.split),c.id);assert.ok(c.category&&c.text,c.id);assert.ok(!ids.has(c.id),'duplicate '+c.id);ids.add(c.id);}
});
test('both splits and every label are represented',()=>{
 for(const s of ['dev','heldout'])assert.ok(d.cases.filter(c=>c.split===s).length>=10,s);
 for(const l of LABELS)assert.ok(d.cases.some(c=>c.expected===l),l);
});
test('the set is marked as authored, not as independent evidence',()=>{assert.match(d.authoredBy,/not independent/);});

import {decide} from '../lib/bear/engine/decide.ts';
test('the rule-based decision layer: every dev case, and it never creates from a receipt, a cancellation or small talk',()=>{
 const dev=d.cases.filter(c=>c.split==='dev');const wrong=dev.filter(c=>decide(c.text).decision!==c.expected).map(c=>c.id);
 assert.deepEqual(wrong,[],'dev failures');
 for(const c of d.cases.filter(c=>['confirmation','no_action','optional_reply','cancellation'].includes(c.category)))assert.notEqual(decide(c.text).decision,'ACT',c.id);
});

import {existsSync} from 'node:fs';
// Regression: every labelled set stays correct. The real-email set B is local-only (private), so it is skipped when absent.
for(const f of ['decisions','fresh-unseen','fresh-unseen-2','fresh-unseen-3','real-sample-5','real-sample-b5','real-sample-d5']){
 const url=new URL(`../evaluation/dataset/${f}.json`,import.meta.url);
 test(`decision rules: every case in ${f}`,{skip:!existsSync(url)},()=>{
  const set=JSON.parse(readFileSync(url,'utf8'));
  const wrong=set.cases.filter(c=>decide(c.text).decision!==c.expected).map(c=>c.id);
  assert.deepEqual(wrong,[]);
 });
}

test('a demand for payment is never read as a receipt (found by the synthetic audience)',()=>{
 for(const t of ['Payment of $392.93 for your internet account is due by Wednesday 2 December.','Payment of $200.18 for your electricity account is due by 16 November.','Your gas payment is overdue. Please pay $90.10 by 20 November.'])
  assert.notEqual(decide(t).decision,'CLOSE',t);
 for(const t of ['We’ve received your payment of $180 for the Year 5 camp. Thank you.','Your payment of $35 was successful. Thank you.','Payment received for invoice 4471.'])
  assert.equal(decide(t).decision,'CLOSE',t);
});
