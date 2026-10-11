import test from 'node:test';
import assert from 'node:assert/strict';
import {compareFindings,fingerprintFinding} from '../scripts/lint-baseline.mjs';

const root='/repo',message={ruleId:'example/rule',severity:2,line:1,column:1,endColumn:6,message:'A reviewed issue.'};
const result={filePath:'/repo/app/example.tsx',source:'known issue\nunchanged',messages:[message]};
const known=fingerprintFinding(result,message,root);
test('lint baseline accepts only the reviewed file, rule and source, and gates warnings too',()=>{
 assert.equal(compareFindings([result],[known],root).unexpected.length,0);
 for(const changed of [
  {...result,filePath:'/repo/app/new.tsx'},
  {...result,source:'different issue\nunchanged'},
  {...result,messages:[{...message,ruleId:'example/new-rule'}]},
  {...result,messages:[{...message,severity:1}]},
 ])assert.equal(compareFindings([changed],[known],root).unexpected.length,1);
});
test('additional findings and parser failures cannot hide behind the baseline',()=>{
 assert.equal(compareFindings([{...result,messages:[message,message]}],[known],root).unexpected[0].messages.length,1);
 const fatal={...message,fatal:true};
 const fatalBaseline=fingerprintFinding(result,fatal,root);
 assert.equal(compareFindings([{...result,messages:[fatal]}],[fatalBaseline],root).unexpected.length,1);
 assert.equal(compareFindings([],[known],root).resolved.length,1);
});
