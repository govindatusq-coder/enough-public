// Prints the 100-case stress test, by pattern and dimension.
import {cases,TODAY} from '../tests/fixtures/load-cases.mjs';
import {score} from '../tests/load-harness.mjs';
const results=cases.map(c=>score(c,TODAY));
const dims=['recognition','decomposition','ownership','burden','closure'];
const by={};for(const r of results){(by[r.pattern]??={n:0,...Object.fromEntries(dims.map(d=>[d,0]))}).n++;for(const d of dims)if(r[d])by[r.pattern][d]++;}
console.log('pattern'.padEnd(22)+dims.map(d=>d.slice(0,11).padStart(13)).join(''));
for(const [p,v] of Object.entries(by))console.log(p.padEnd(22)+dims.map(d=>`${v[d]}/${v.n}`.padStart(13)).join(''));
const tot=Object.fromEntries(dims.map(d=>[d,results.filter(r=>r[d]).length]));
console.log('TOTAL'.padEnd(22)+dims.map(d=>`${tot[d]}/${results.length}`.padStart(13)).join(''));
for(const r of results)if(r.notes.length)console.log('-',r.id+':',r.notes.join('; '));
