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
