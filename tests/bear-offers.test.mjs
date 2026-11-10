// Offers for "eligible staff/students/…": Bear asks once, remembers the person's own answer per group, never guesses,
// and never remembers sensitive groups.
import test from 'node:test';
import assert from 'node:assert/strict';
import {offerGroup,decideFor,OFFER_GROUPS} from '../lib/bear/engine/offers.ts';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile,profilePatchSchema} from '../lib/bear/services/profile.ts';

const STAFF='Financial support of up to $500 is available to eligible staff. Apply by Friday 20 November.';
test('which group an offer is for',()=>{
 assert.deepEqual(offerGroup(STAFF),{group:'staff',sensitive:false});
 assert.equal(offerGroup('Applications are open to eligible students for a one-off grant.').group,'student');
 assert.equal(offerGroup('A rebate is available to eligible seniors and pensioners.').group,'senior');
 assert.equal(offerGroup('Support is available to eligible parents and carers.').group,'parent');
 assert.deepEqual(offerGroup('A grant is open to eligible members. Apply by Friday.'),{group:null,sensitive:false},'unclear group: Bear asks, it doesn’t guess');
});
test('sensitive offers are flagged and never resolved, even if an answer is somehow present',()=>{
 for(const t of ['Support is available to eligible families experiencing hardship.','A grant for eligible people on a low income.','Help is open to eligible people with a disability.','A concession is available to eligible health care card holders.']){
  assert.equal(offerGroup(t).sensitive,true,t);
  const d=decideFor(t,{staff:'yes',student:'yes',senior:'yes',parent:'yes'});assert.equal(d.decision,'ASK',t);assert.equal(d.offer.resolved,false,t);
 }
});
test('asks the first time, then follows the person’s own answer',()=>{
 assert.equal(decideFor(STAFF,{}).decision,'ASK');assert.equal(decideFor(STAFF,{}).offer.resolved,false);
 const yes=decideFor(STAFF,{staff:'yes'});assert.deepEqual([yes.decision,yes.rule,yes.offer.resolved],['ACT','offer-remembered-yes',true]);
 const no=decideFor(STAFF,{staff:'no'});assert.deepEqual([no.decision,no.rule,no.offer.resolved],['IGNORE','offer-remembered-no',true]);
 assert.equal(decideFor(STAFF,{student:'yes'}).decision,'ASK','an answer for one group never resolves another');
});
test('nothing else changes: other emails decide exactly as before',()=>{
 for(const t of ['Please return the form by Friday.','Your payment of $35 was successful.','Sale ends Sunday. To stop receiving these emails, please unsubscribe.'])
  assert.equal(decideFor(t,{staff:'yes'}).decision,decideFor(t,{}).decision,t);
});
test('what is stored: only four groups, only yes or no',async()=>{
 assert.ok(profilePatchSchema.safeParse({offerGroups:{staff:'yes',senior:'no'}}).success);
 assert.equal(profilePatchSchema.safeParse({offerGroups:{hardship:'yes'}}).success,false,'sensitive groups can’t be stored');
 assert.equal(profilePatchSchema.safeParse({offerGroups:{staff:'maybe'}}).success,false);
 assert.equal(profilePatchSchema.safeParse({offerGroups:{staff:'yes',extra:'yes'}}).success,false);
 const s=new MemoryBackend().for('14141414-1414-4141-8141-141414141414');await ensureProfile(s);
 await saveProfile(s,{offerGroups:{staff:'yes'}});assert.deepEqual((await ensureProfile(s)).offerGroups,{staff:'yes'});
 await saveProfile(s,{offerGroups:{}});assert.deepEqual((await ensureProfile(s)).offerGroups,{},'forgetting works');
 assert.deepEqual([...OFFER_GROUPS],['staff','student','senior','parent']);
});
