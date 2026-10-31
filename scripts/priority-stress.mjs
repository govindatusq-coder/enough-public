import {cases,conflicts,TODAY} from '../tests/fixtures/priority-cases.mjs';
import {check} from '../tests/priority-harness.mjs';
const all=[...cases,...conflicts].map(c=>check(c,TODAY));
const by={};for(const r of all){(by[r.pattern]??={n:0,ok:0}).n++;if(r.ok)by[r.pattern].ok++;}
for(const [p,v] of Object.entries(by))console.log(p.padEnd(22),`${v.ok}/${v.n}`);
console.log('TOTAL'.padEnd(22),`${all.filter(r=>r.ok).length}/${all.length}`);
for(const r of all)if(!r.ok)console.log('-',r.id+':',r.notes.join('; '));
