import {createHash} from 'node:crypto';
import {relative} from 'node:path';

export function fingerprintFinding(result,message,root){
 const file=relative(root,result.filePath).replaceAll('\\','/');
 const lines=(result.source||'').split('\n');
 const source=lines.slice(message.line-1,message.endLine||message.line).join('\n');
 const fingerprint=createHash('sha256').update(JSON.stringify([file,message.ruleId,message.severity,source,message.column,message.endColumn])).digest('hex');
 return {file,rule:message.ruleId,severity:message.severity,line:message.line,fingerprint};
}
export function compareFindings(results,baseline,root){
 const known=new Map(baseline.map(item=>[item.fingerprint,item]));
 const unexpected=[],current=[];
 for(const result of results){
  const messages=[];
  for(const message of result.messages){
   const item=fingerprintFinding(result,message,root);current.push(item);
   if(message.fatal||!message.ruleId||!known.delete(item.fingerprint))messages.push(message);
  }
  if(messages.length)unexpected.push({...result,messages});
 }
 return {unexpected,current,resolved:[...known.values()]};
}
