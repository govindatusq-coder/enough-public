import {readFile,writeFile} from 'node:fs/promises';
import {ESLint} from 'eslint';
import {compareFindings} from './lint-baseline.mjs';

const root=process.cwd(),path=new URL('../eslint-baseline.json',import.meta.url);
const eslint=new ESLint(),results=await eslint.lintFiles(['.']);
if(process.argv.includes('--update-baseline')){
 if(results.some(result=>result.messages.some(message=>message.fatal||!message.ruleId)))throw Error('Parsing failures cannot be baselined.');
 const {current}=compareFindings(results,[],root);
 await writeFile(path,JSON.stringify({version:1,note:'Reviewed pre-existing findings; new or changed findings fail CI. See docs/verification/engineering-hygiene-2026-10-11.md.',findings:current},null,2)+'\n');
 console.log(`Recorded ${current.length} findings for review. Commit the baseline only after inspecting the changes.`);
}else{
 const baseline=JSON.parse(await readFile(path,'utf8'));
 if(baseline.version!==1||!Array.isArray(baseline.findings))throw Error('Invalid lint baseline.');
 const {unexpected,current,resolved}=compareFindings(results,baseline.findings,root);
 if(unexpected.length){
  console.error(await (await eslint.loadFormatter('stylish')).format(unexpected));
  console.error('New or changed lint findings must be fixed; existing debt is listed in eslint-baseline.json.');
  process.exitCode=1;
 }else console.log(`Lint gate passed: ${current.length} reviewed existing findings, no new findings.${resolved.length?` ${resolved.length} baseline findings have been resolved.`:''}`);
}
