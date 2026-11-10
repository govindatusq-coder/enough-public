// Decision benchmark. Usage: node evaluation/run-decisions.mjs
// Two systems on the same labelled cases (evaluation/dataset/decisions.json):
//   decide     = lib/bear/engine/decide.ts (rule-based decision layer): exact decision accuracy + confusion.
//   extractor  = lib/bear/engine/extract.ts (the current engine): only "creates an item?" vs "tracked?" proxy,
//                because it has no decision output.
// Dev and held-out are reported separately. Held-out is not clean: its cases were written before rules were tuned,
// but dev failures were read while tuning, so treat held-out as a weak check, not an independent test.
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractResponsibilities} from '../lib/bear/engine/extract.ts';
import {decide} from '../lib/bear/engine/decide.ts';
const here=dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(resolve(here,'dataset/decisions.json'),'utf8'));
const LABELS=['ACT','ASK','WAIT','UPDATE','CLOSE','IGNORE'];
const rows=data.cases.map(c=>({...c,decided:decide(c.text).decision,extractorCreated:extractResponsibilities(c.text,{today:data.today,sourceId:c.id}).responsibilities.length>0}));
function accuracy(rs){const ok=rs.filter(r=>r.decided===r.expected).length;return {n:rs.length,correct:ok,accuracy:+(ok/rs.length).toFixed(3)};}
function confusion(rs){const m={};for(const e of LABELS){m[e]={};for(const p of LABELS)m[e][p]=0;}for(const r of rs)m[r.expected][r.decided]++;return m;}
function proxy(rs){const tracked=r=>r.expected!=='IGNORE';const tp=rs.filter(r=>r.extractorCreated&&tracked(r)).length,fp=rs.filter(r=>r.extractorCreated&&!tracked(r)).length,fn=rs.filter(r=>!r.extractorCreated&&tracked(r)).length;
 return {precision:tp+fp?+(tp/(tp+fp)).toFixed(3):null,recall:tp+fn?+(tp/(tp+fn)).toFixed(3):null};}
const splits={dev:rows.filter(r=>r.split==='dev'),heldout:rows.filter(r=>r.split==='heldout')};
const out={generated:new Date().toISOString(),note:'decide = rule-based baseline; held-out not clean (see run-decisions.mjs header)',
 decide:Object.fromEntries(Object.entries(splits).map(([k,rs])=>[k,{...accuracy(rs),confusion:confusion(rs)}])),
 extractorProxy:Object.fromEntries(Object.entries(splits).map(([k,rs])=>[k,proxy(rs)])),
 wrong:rows.filter(r=>r.decided!==r.expected).map(r=>({id:r.id,split:r.split,expected:r.expected,decided:r.decided,text:r.text.slice(0,90)}))};
const dest=resolve(here,'results/decisions-decide.json');writeFileSync(dest,JSON.stringify(out,null,1));
console.log(JSON.stringify({decide:{dev:out.decide.dev.accuracy,heldout:out.decide.heldout.accuracy},extractorProxy:out.extractorProxy},null,1));
console.log(out.wrong.map(w=>`${w.id} ${w.split} expected ${w.expected} got ${w.decided}: ${w.text}`).join('\n'));
console.log('wrote',dest);
