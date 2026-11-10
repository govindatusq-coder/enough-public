// Scores lib/bear/engine/decide.ts on the de-identified real sample (labels frozen before the run).
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide} from '../lib/bear/engine/decide.ts';
const here=dirname(fileURLToPath(import.meta.url));
const d=JSON.parse(readFileSync(resolve(here,'dataset/real-sample-5.json'),'utf8'));
let ok=0;for(const c of d.cases){const r=decide(c.text);const hit=r.decision===c.expected;ok+=hit;console.log(`${c.id} ${hit?'ok  ':'MISS'} expected ${c.expected} got ${r.decision} [${r.rule}]`);}
console.log(`accuracy ${ok}/${d.cases.length}`);
