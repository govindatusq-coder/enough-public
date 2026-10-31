import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateState} from '../lib/account-validation.ts';
import {restore} from '../lib/journey.ts';
import {recommend} from '../lib/recommendations.ts';
// The iPhone app's account-format test decodes and re-encodes this fixture. Keeping it valid
// for the website's strict schema proves both clients agree on the same JSON.
test('the iOS parity fixture is a valid website account state',async()=>{
 const raw=await readFile(new URL('../ios/Enough/EnoughTests/Fixtures/web-account.json',import.meta.url),'utf8');
 const state=validateState(JSON.parse(raw));
 assert.equal(state.profile.complete,true);
 assert.equal(state.entries.length,3);
 assert.equal(restore(raw).entries[0].movementEvidence.steps,1420);
 assert.ok(recommend(state,new Date('2026-10-20T12:00:00')).length>0);
});
