// Bear's first read in the Outlook panel: off by default, labels-only feedback, wording for every decision.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile} from '../lib/bear/services/profile.ts';
import {recordDecisionFeedback,parseFeedback,DECISION_LABELS} from '../lib/bear/services/decision-feedback.ts';
import {presentRead,READ_CHOICES} from '../lib/bear/outlook/read.ts';
import {flags} from '../lib/bear/flags.ts';
const USER='13131313-1313-4131-8131-131313131313';
async function setup(){const s=new MemoryBackend().for(USER);await ensureProfile(s);return s;}

test('off unless explicitly switched on',()=>{
 delete process.env.BEAR_DECISIONS_ENABLED;assert.equal(flags.decisions(),false);
 process.env.BEAR_DECISIONS_ENABLED='on';assert.equal(flags.decisions(),true);
 process.env.BEAR_DECISIONS_ENABLED='off';assert.equal(flags.decisions(),false);delete process.env.BEAR_DECISIONS_ENABLED;
});
test('feedback keeps only labels: never the email, never anything else the caller sends',async()=>{
 const s=await setup();
 await recordDecisionFeedback(s,{predicted:'ACT',correct:false,expected:'IGNORE',rule:'explicit-request',subject:'Secret subject',text:'Pay $999 to Jo Blogg',from:'a@b.com'});
 const ev=(await s.list('behaviour_events')).filter(e=>e.detail.signal==='decision_feedback');assert.equal(ev.length,1);
 assert.deepEqual(ev[0].detail,{signal:'decision_feedback',predicted:'ACT',expected:'IGNORE',correct:false,rule:'explicit-request'});
 const blob=JSON.stringify(ev);for(const leak of ['Secret','999','Blogg','a@b.com'])assert.ok(!blob.includes(leak),leak);
});
test('feedback is validated: unknown labels, a wrong answer with no correction, and junk are refused',()=>{
 assert.throws(()=>parseFeedback({predicted:'MAYBE',correct:true}),/invalid_feedback/);
 assert.throws(()=>parseFeedback({predicted:'ACT',correct:false}),/invalid_feedback/,'a "no" needs the right answer');
 assert.throws(()=>parseFeedback({predicted:'ACT',correct:false,expected:'DANCE'}),/invalid_feedback/);
 assert.throws(()=>parseFeedback(null),/invalid_feedback/);
 assert.deepEqual(parseFeedback({predicted:'WAIT',correct:true,rule:'Bad Rule!'}),{predicted:'WAIT',correct:true,expected:'WAIT',rule:null},'odd rule names are dropped');
});
test('the panel has wording for every decision, and a choice for every label',()=>{
 for(const d of DECISION_LABELS){const r=presentRead(d);assert.ok(r.headline&&r.detail&&r.button,d);assert.doesNotMatch(r.headline+r.detail+r.button,/_|verified|ACT|IGNORE/,'plain words only');}
 assert.deepEqual(READ_CHOICES.map(c=>c.value).sort(),[...DECISION_LABELS].sort());
 assert.equal(presentRead('IGNORE').primary,false,'nothing-to-do is a quiet button, not the main one');
 assert.match(presentRead('CLOSE').detail,/won’t close anything without your say/);
});
