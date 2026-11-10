// Decision benchmark (baseline). Usage: node evaluation/run-decisions.mjs
// The current engine only EXTRACTS responsibilities; it has no ACT/ASK/WAIT/UPDATE/CLOSE/IGNORE output yet.
// So this scores the closest honest proxy: does the engine create a new tracked item for the message?
//   tracked (expected ≠ IGNORE) vs created (engine returns ≥1 responsibility).
// Decision-level accuracy is reported as NOT MEASURABLE for the current engine. Never estimated.
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {extractResponsibilities} from '../lib/bear/engine/extract.ts';
const here=dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(readFileSync(resolve(here,'dataset/decisions.json'),'utf8'));
const rows=data.cases.map(c=>{const created=extractResponsibilities(c.text,{today:data.today,sourceId:c.id}).responsibilities.length>0;return {...c,created,tracked:c.expected!=='IGNORE'};});
function stats(rs){const tp=rs.filter(r=>r.created&&r.tracked).length,fp=rs.filter(r=>r.created&&!r.tracked).length,fn=rs.filter(r=>!r.created&&r.tracked).length,tn=rs.filter(r=>!r.created&&!r.tracked).length;
 const p=tp+fp?tp/(tp+fp):null,rc=tp+fn?tp/(tp+fn):null;return {n:rs.length,tp,fp,fn,tn,precision:p==null?null:+p.toFixed(3),recall:rc==null?null:+rc.toFixed(3),
  wrongCreations:rs.filter(r=>r.created&&r.expected==='CLOSE'||r.created&&r.expected==='IGNORE').map(r=>r.id)};}
const out={generated:new Date().toISOString(),measured:'tracked-vs-created proxy only',decisionAccuracy:'NOT MEASURABLE: engine has no decision output yet',
 dev:stats(rows.filter(r=>r.split==='dev')),heldout:stats(rows.filter(r=>r.split==='heldout')),
 missed:rows.filter(r=>!r.created&&r.tracked).map(r=>r.id),
 cases:rows.map(({id,split,category,expected,created})=>({id,split,category,expected,createdNewItem:created}))};
const dest=resolve(here,'results/decisions-baseline.json');writeFileSync(dest,JSON.stringify(out,null,1));
console.log(JSON.stringify({dev:out.dev,heldout:out.heldout,missed:out.missed},null,1));console.log('wrote',dest);
