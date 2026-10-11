import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export const productionOrigin='https://enough-public.vercel.app';
export function nativeConfig(target=productionOrigin){
 const url=new URL(target);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash||!/^[-a-z0-9.]+$/i.test(url.hostname))throw Error('Use an HTTPS origin with no credentials, port, path, query or fragment.');
 return {appId:'app.enough.movement',appName:'ENOUGH',webDir:'www',server:{url:url.origin,cleartext:false},ios:{contentInset:'automatic'}};
}
export async function configureNative(target=productionOrigin){
 const config=nativeConfig(target),host=new URL(config.server.url).hostname;
 const sources=['ios/App/App/EnoughMovementPlugin.swift','android/app/src/main/java/app/enough/movement/EnoughMovementPlugin.kt'];
 const changes=await Promise.all(sources.map(async path=>{
  const file=new URL(path,import.meta.url),source=await readFile(file,'utf8');
  const marker=/url\.host == "[-a-z0-9.]+"/g;
  if((source.match(marker)||[]).length!==1)throw Error('Expected one native origin guard in '+path);
  return {file,source:source.replace(marker,'url.host == '+JSON.stringify(host))};
 }));
 await writeFile(new URL('capacitor.config.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
 for(const change of changes)await writeFile(change.file,change.source);
 return config;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const config=await configureNative(process.env.ENOUGH_NATIVE_SERVER_URL||productionOrigin);
 process.stdout.write('Native content and health origin: '+config.server.url+'\n');
}
