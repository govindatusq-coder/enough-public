// Scores lib/bear/engine/decide.ts on evaluation/dataset/fresh-unseen.json (labels frozen before the run).
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {decide} from '../lib/bear/engine/decide.ts';
const here=dirname(fileURLToPath(import.meta.url));
const d=JSON.parse(readFileSync(resolve(here,'dataset/fresh-unseen.json'),'utf8'));
const LABELS=['ACT','ASK','WAIT','UPDATE','CLOSE','IGNORE'];
const rows=d.cases.map(c=>({...c,decided:decide(c.text).decision,rule:decide(c.text).rule}));
const ok=rows.filter(r=>r.decided===r.expected).length;
const m={};for(const e of LABELS){m[e]={};for(const p of LABELS)m[e][p]=0;}for(const r of rows)m[r.expected][r.decided]++;
const out={generated:new Date().toISOString(),accuracy:+(ok/rows.length).toFixed(3),correct:ok,n:rows.length,confusion:m,wrong:rows.filter(r=>r.decided!==r.expected).map(({id,expected,decided,rule,text})=>({id,expected,decided,rule,text}))};
writeFileSync(resolve(here,'results/decisions-fresh.json'),JSON.stringify(out,null,1));
console.log(`accuracy ${out.correct}/${out.n} = ${out.accuracy}`);
for(const w of out.wrong)console.log(`${w.id} expected ${w.expected} got ${w.decided} [${w.rule}]: ${w.text.slice(0,100)}`);
