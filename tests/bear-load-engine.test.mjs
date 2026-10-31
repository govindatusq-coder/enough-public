import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,TODAY} from './fixtures/load-cases.mjs';
import {score,caps,FORBIDDEN} from './load-harness.mjs';
import {understand,applyAction,recompute,graphState} from '../lib/bear/load/engine.ts';
import {describe} from '../lib/bear/load/view.ts';
import {patterns,v1Patterns} from '../lib/bear/load/patterns.ts';
import {cognitiveLoadVector,absorbed} from '../lib/bear/load/vector.ts';
import {ownershipSummary} from '../lib/bear/load/ownership.ts';

const results=cases.map(c=>score(c,TODAY));

test('there are at least 100 fixtures, ten for each V1 pattern',()=>{
 assert.ok(cases.length>=100);
 for(const p of v1Patterns)assert.ok(cases.filter(c=>c.pattern===p.id).length>=10,p.id);
});
test('quality gate: at least 95% correct primary-pattern recognition',()=>{
 const ok=results.filter(r=>r.recognition).length/results.length;assert.ok(ok>=0.95,`${ok*100}%: `+results.filter(r=>!r.recognition).map(r=>r.id+' '+r.notes.join(',')).join(' | '));
});
test('quality gate: at least 90% correct closure',()=>{
 const ok=results.filter(r=>r.closure).length/results.length;assert.ok(ok>=0.9,`${ok*100}%: `+results.filter(r=>!r.closure).map(r=>r.id+' '+r.notes.join(',')).join(' | '));
});
test('quality gate: zero false "Bear has this covered" capability claims',()=>{
 const bad=results.filter(r=>!r.ownership);assert.equal(bad.length,0,bad.map(r=>r.id+' '+r.notes.join(',')).join(' | '));
});
test('no giant checklists: decomposition stays small and never leaks templates',()=>{
 const bad=results.filter(r=>!r.decomposition);assert.equal(bad.length,0,bad.map(r=>r.id+' '+r.notes.join(',')).join(' | '));
});
test('human burden: one smallest action (or nothing) on at least 95% of cases',()=>{
 const ok=results.filter(r=>r.burden).length/results.length;assert.ok(ok>=0.95,results.filter(r=>!r.burden).map(r=>r.id+' '+r.notes.join(',')).join(' | '));
});

test('every pattern definition is complete and closes on real evidence, never on a reminder',()=>{
 for(const p of Object.values(patterns)){
  assert.ok(p.closure.conditions.length>0,p.id);assert.ok(p.decomposition.steps.length>0,p.id);
  for(const set of p.closure.conditions)for(const k of set)assert.ok(!/reminder|dismiss|sent_email|contacted|booked|ordered/.test(k),`${p.id} closes on ${k}`);
 }
});

test('the school camp: consent first, then payment, then nothing until packing matters',()=>{
 const text='YEAR 5 CAMP\n17–19 November\nConsent and $120 payment due Friday.\nStudents need sleeping bag, hat, water bottle and enclosed shoes.';
 let {graph,recognition}=understand({text,today:TODAY,caps});
 assert.equal(recognition.primary,'SCHOOL_EVENT');assert.deepEqual(recognition.attached.slice(0,2),['FORM_APPLICATION','BILL_PAYMENT']);
 let v=describe(graph,TODAY);
 assert.equal(v.headline,'I’ve got the Year 5 camp.');
 assert.equal(v.needsYou.headline,'Consent is due Friday');
 assert.ok(v.covered.includes('Year 5 camp 17–19 November'));assert.ok(v.covered.some(l=>/Payment \$120 due Friday/.test(l)));
 assert.ok(v.comingUp.some(c=>/Packing/.test(c.line)),'packing is held back');
 let r=applyAction(graph,{stepId:v.needsYou.stepId},TODAY,caps);graph=r.graph;assert.equal(r.said,'Consent sorted.');
 v=describe(graph,TODAY);assert.equal(v.needsYou.headline,'Pay $120');
 r=applyAction(graph,{stepId:v.needsYou.stepId},TODAY,caps);graph=r.graph;
 v=describe(graph,TODAY);assert.equal(v.needsYou,null);assert.equal(v.nothingForYou,true);assert.equal(v.headline,'Year 5 camp covered.');
 assert.notEqual(graphState(graph),'resolved','paying for camp does not close camp');
 // Packing comes back two days before, then the event passing closes it.
 v=describe(recompute(graph,'2026-11-15',caps),'2026-11-15');assert.match(v.needsYou.headline,/Pack for Year 5 camp/);
 graph=applyAction(graph,{stepId:v.needsYou.stepId},'2026-11-15',caps).graph;
 assert.equal(graphState(recompute(graph,'2026-11-20',caps)),'resolved');
});

test('an unknown load asks one small question, and the answer gives it a shape',()=>{
 let {graph,recognition}=understand({text:'The thing with Mum and the house',today:TODAY,caps});
 assert.equal(recognition.primary,'UNKNOWN_LOAD');
 const v=describe(graph,TODAY);assert.equal(v.needsYou.headline,'What would make this feel sorted?');assert.equal(v.needsYou.choices.length,5);
 graph=applyAction(graph,{stepId:v.needsYou.stepId,evidence:'clarified:Wait for someone'},TODAY,caps).graph;
 assert.equal(graphState(graph),'waiting');
 const w=describe(graph,TODAY).waiting[0];assert.match(w.line,/Nothing for you to do\. I’ll bring this back .* if you haven’t heard\./);
});

test('waiting is honest: no inbox access means a date to bring it back, not "monitoring"',()=>{
 const {graph}=understand({text:'Waiting for an email reply from the school about the uniform exchange.',today:TODAY,caps});
 const n=graph.nodes[0];assert.equal(n.state,'waiting');assert.equal(n.waiting.monitoringMethod,'time_based');
 const v=describe(graph,TODAY);assert.ok(!FORBIDDEN.test(JSON.stringify(v)));assert.equal(v.nothingForYou,true);
});

test('Bear never owns a payment, and degrades claims it cannot back with an integration',()=>{
 const {graph}=understand({text:'Origin gas bill $142.10. This will be paid by direct debit on 6 November.',today:TODAY,caps});
 const sum=ownershipSummary(graph);
 assert.ok(sum.waitingOnExternal.length>=1,'the debit is the bank’s job');
 const check=graph.nodes[0].steps.find(s=>s.key==='check_debit');assert.equal(check.owner,'human');assert.match(check.degraded,/No bank connection/);
});

test('cognitive load vector: Bear absorbs remembering and monitoring; payment stays human',()=>{
 const {graph}=understand({text:'AGL electricity bill. Amount due $184.20. Due date 4 November 2026.',today:TODAY,caps});
 const v=cognitiveLoadVector(graph);assert.equal(v.remember,'bear');assert.equal(v.follow_up,'human');assert.ok(absorbed(v)>0.3);
});

test('appointment follow-up becomes its own attached load instead of closing silently',()=>{
 let {graph}=understand({text:'Doctor appointment on 27 October to go through the scan results.',today:TODAY,caps});
 const step=graph.nodes[0].steps.find(s=>s.key==='outcome');
 graph=applyAction(graph,{stepId:step.id,evidence:'follow_up_needed'},'2026-10-27',caps).graph;
 assert.equal(graph.nodes.length,2);assert.equal(graph.nodes[1].pattern,'APPOINTMENT');
 assert.notEqual(graphState(graph),'resolved','not closed until the follow-up is resolved');
});

test('a plain to-do is not interrogated: it is simply something to get done, with its date',()=>{
 const {graph,recognition}=understand({text:'Return the library books by 1 November',today:TODAY,caps});
 assert.equal(recognition.primary,'UNKNOWN_LOAD');
 const v=describe(graph,TODAY);assert.equal(v.needsYou.headline,'Return the library books by 1 November');assert.equal(v.needsYou.dueAt,'2026-11-01');assert.equal(v.needsYou.choices,null);
});
