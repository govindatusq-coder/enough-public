// Writes tests/fixtures/suggestion-baseline.json: the recorded behaviour of the
// suggestion system (System A). Run only to record a deliberate, reviewed change:
//   TZ=UTC node scripts/suggestion-baseline.mjs
import {writeFileSync} from 'node:fs';
import {personas} from '../tests/fixtures/personas.mjs';
import {suggestionSnapshot} from '../tests/fixtures/suggestion-snapshot.mjs';
const out=Object.fromEntries(personas.map(p=>[p.id,suggestionSnapshot(p)]));
writeFileSync(new URL('../tests/fixtures/suggestion-baseline.json',import.meta.url),JSON.stringify(out,null,1)+'\n');
console.log(Object.entries(out).map(([id,s])=>`${id}: best fit ${s.bestFit?.title} (${s.bestFit?.minutes} min, ${s.bestFit?.extraMinutes} extra) · others ${s.others.map(o=>o.title).join(' / ')}`).join('\n'));
