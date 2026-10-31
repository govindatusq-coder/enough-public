import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,conflicts,TODAY} from './fixtures/priority-cases.mjs';
import {check,run,PANIC} from './priority-harness.mjs';

test('at least 100 prioritisation fixtures, ten per load pattern, plus conflict tests A–J',()=>{
 assert.ok(cases.length>=100);for(const p of new Set(cases.map(c=>c.pattern)))assert.ok(cases.filter(c=>c.pattern===p).length>=10,p);
 assert.equal(conflicts.length,10);
});
for(const c of [...cases,...conflicts])test(`priority: ${c.id}`,()=>{const r=check(c,TODAY);assert.ok(r.ok,r.notes.join('; '));});

test('the worked example: only the camp consent is worth doing now; the bill is Bear’s; the email is left alone',()=>{
 const c={items:[
  {id:'registration',text:'Professional registration renewal, expires 19 November 2026. Renew online.',postpones:2},
  {id:'electricity',text:'Electricity bill $210 will be paid by direct debit on 27 October.'},
  {id:'email',text:'Read that interesting email about the conference.'},
  {id:'camp',text:'YEAR 5 CAMP 17–19 November. Consent due Friday.'},
  {id:'dentist',text:'Need to book a dentist check-up.'},
 ],ctx:{values:{values:[{key:'parenting',source:'user',confidence:1},{key:'career',source:'user',confidence:1}],goals:[{id:'g',text:'Maintain professional registration',kind:'non_negotiable',createdAt:''}]}}};
 const {sel,results}=run(c,TODAY);const by=id=>results.find(r=>r.id===id);
 assert.equal(sel.top.id,'camp');assert.equal(sel.needs,1,'one thing, not five');
 assert.equal(by('electricity').surfaceNow,false);assert.equal(by('email').surfaceNow,false);assert.equal(by('dentist').surfaceNow,false);
 assert.equal(by('registration').surfaceNow,false,'important, but its comfortable time is later');
 assert.ok(by('registration').globalPriority>by('camp').globalPriority-0.2,'registration still matters a lot overall');
 assert.equal(by('registration').support,'prepare_more','aversive and important: Bear makes the step smaller');
 assert.ok(by('registration').explanation.reasons.some(x=>x.key==='matters'),'linked to the non-negotiable');
 const why=by('camp').explanation;assert.ok(why.reasons.length>=1&&why.reasons.length<=3);
 assert.ok(why.reasons.some(x=>x.key==='bear'||x.key==='window'||x.key==='pressure'));
});

test('preference and strength never raise importance; aversion never lowers it',()=>{
 const base={items:[{id:'bill',text:'Gas bill $120 due 8 November 2026.'}]};
 const plain=run(base,TODAY).results[0];const strong=run({...base,ctx:{strengths:['Money']}},TODAY).results[0];
 assert.equal(strong.importance,plain.importance);assert.equal(strong.globalPriority,plain.globalPriority);
 const avoided=run({items:[{id:'bill',text:'Gas bill $120 due 8 November 2026.',postpones:4}]},TODAY).results[0];
 assert.ok(avoided.importance>=plain.importance,'postponing does not make it matter less');
 assert.ok(avoided.latestComfortableActionAt<=plain.latestComfortableActionAt,'it comes back earlier instead');
});

test('a chaos day only lets through what genuinely can’t wait',()=>{
 const {sel}=run({items:[{id:'consent',text:'Return the excursion permission note by 30 October.'},{id:'gas',text:'Can smell gas near the oven.'}],ctx:{dayMode:'chaos'}},TODAY);
 assert.equal(sel.top.id,'gas');assert.equal(sel.needs,1);
});

test('trajectory: priority rises as the comfortable time approaches, without panic words',()=>{
 const r=run({items:[{id:'rego',text:'Car registration expires 30 November 2026. Renew online.'}]},TODAY).results[0];
 assert.ok(r.trajectory.in14>=r.trajectory.today);assert.ok(!PANIC.test(r.explanation.headline));
 assert.ok(r.latestComfortableActionAt<r.latestSafeActionAt,'comfortable comes before safe');
});
