import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
test('life-matched home exposes NOW MINE MORE and try action',async()=>{const s=await read('components/enough-life-home.tsx');for(const x of ['NOW','MINE','MORE','I’ll try this','Nothing to catch up on'])assert.match(s,new RegExp(x));});
test('adaptive onboarding avoids persona labels and captures friction',async()=>{const s=await read('components/adaptive-life-setup.tsx');assert.match(s,/What takes up most of your week|WEEK_ROLES/);assert.match(s,/FRICTIONS/);assert.doesNotMatch(s,/Choose your persona|Senior|Frail/);});
test('eligibility precedes ranking and honours opportunity profile',async()=>{const s=await read('lib/recommendations.ts');assert.match(s,/opportunityAllows/);assert.match(s,/filter\(i=>eligible\(i,s,now\)/);assert.match(s,/alreadyDo/);});
test('kept swaps persist and only graduate after repeated use over time',async()=>{const s=await read('lib/journey.ts');assert.match(s,/keptSwaps/);assert.match(s,/recordKeptSwapUse/);assert.match(s,/21\*86400000/);assert.match(s,/k\.uses\+1>=5/);});
test('responsive and reduced-motion rules exist',async()=>{const s=await read('app/life-matched.css');assert.match(s,/@media\(max-width:760px\)/);assert.match(s,/prefers-reduced-motion/);assert.match(s,/prefers-contrast/);});
