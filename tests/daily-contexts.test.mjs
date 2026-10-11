import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,localDate,restore,completeProfile} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {resumeSetup} from '../lib/onboarding.ts';
import {constraints,recommend} from '../lib/recommendations.ts';
import {matchesSittingContext,sittingContexts} from '../lib/daily-contexts.ts';
import {catalogue} from '../lib/ideas.ts';
import {aiContext} from '../lib/ai-ideas.ts';
import {createAiConsent} from '../lib/ai-consent.ts';
const now=new Date(2026,9,5,12);
function configured(){const s=emptyState();Object.assign(s.profile,{preferences:['Familiar places'],interests:['Music'],needs:['Nothing to add'],strengths:['I keep routines'],activity:'Mostly seated',rhythms:['Calls'],window:'Daytime'});return s;}
test('shift fatigue applies energy and limited-time checks only on the recorded local day',()=>{
 const s=configured();s.today={date:localDate(now),context:'Tired after a shift'};assert.ok(constraints(s,now).has('Fatigue'));assert.ok(constraints(s,now).has('Limited time'));
 assert.ok(recommend(s,now).every(r=>r.idea.effort==='gentle'&&r.idea.minutes<=20&&r.idea.extraMin<=5&&!['strength','vigorous-burst'].includes(r.idea.intensity)));
 const tomorrow=new Date(2026,9,6,0);assert.equal(constraints(s,tomorrow).has('Fatigue'),false);assert.equal(constraints(s,tomorrow).has('Limited time'),false);
});
test('stress boosts short familiar outdoor walking while all existing boundaries remain hard constraints',()=>{
 const s=configured(),base=new Map(recommend(s,now).map(r=>[r.idea.id,r.score]));s.today={date:localDate(now),context:'Feeling stressed'};const walk=recommend(s,now).find(r=>r.idea.key==='call-family-walk');assert.equal(walk.score-base.get(walk.idea.id),6);
 s.profile.needs=['Safety matters'];assert.ok(recommend(s,now).every(r=>!r.idea.outdoor));s.profile.needs=['Pain / discomfort'];assert.ok(recommend(s,now).every(r=>r.idea.movementMode==='seated'));
});
test('optional sitting contexts boost only relevant short breaks and never change setup completion or gap resume',()=>{
 const s=configured();assert.equal(completeProfile(s.profile),true);const base=new Map(recommend(s,now).map(r=>[r.idea.id,r.score]));s.profile.sittingContexts=['Desk work'];assert.equal(completeProfile(s.profile),true);assert.equal(resumeSetup(s.profile),0);
 const colleague=recommend(s,now).find(r=>r.idea.key==='walk-to-colleague');assert.equal(colleague.score-base.get(colleague.idea.id),3);const long=catalogue.find(i=>i.key==='walking-1on1');assert.equal(matchesSittingContext(long,'Desk work'),false);
 s.profile.interests=[];assert.equal(resumeSetup(s.profile),2);
 for(const c of sittingContexts)assert.ok(catalogue.some(i=>matchesSittingContext(i,c)));
});
test('legacy profiles, known choices and optional skips round-trip; invalid or repeated contexts are rejected',()=>{
 const s=configured();assert.equal(restore(JSON.stringify(validateState(s))).profile.sittingContexts,undefined);s.profile.sittingContexts=['Driving','Commute'];assert.deepEqual(restore(JSON.stringify(validateState(s))).profile.sittingContexts,s.profile.sittingContexts);
 for(const choices of [['Unknown'],['Driving','Driving'],null]){s.profile.sittingContexts=choices;assert.throws(()=>validateState(s));assert.throws(()=>restore(JSON.stringify(s)));}
});
test('reduced AI permission excludes stress and shift-fatigue notes and derived health limits',()=>{
 const s=configured();s.aiConsent=createAiConsent('without-health');s.profile.sittingContexts=['Desk work'];
 for(const context of ['Feeling stressed','Tired after a shift']){s.today={date:localDate(now),context};const data=aiContext(s,now);assert.equal(data.today.context,'');assert.deepEqual(data.hardLimits.avoidIntensity,[]);assert.equal(data.hardLimits.maxMovementMinutes,60);assert.deepEqual(data.sittingContexts,['Desk work']);}
});
