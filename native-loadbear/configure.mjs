// Writes capacitor.config.json for the Load Bear shell. Pass the deployed origin:
//   LOADBEAR_SERVER_URL=https://your-app.vercel.app node configure.mjs
import {writeFile} from 'node:fs/promises';
const target=process.env.LOADBEAR_SERVER_URL||'https://enough-public-zuue.vercel.app';
const url=new URL(target);
if(url.protocol!=='https:'||url.username||url.password||url.port||url.search||url.hash)throw Error('Use an HTTPS origin with no credentials, port, query or fragment.');
const config={appId:'au.loadbear.app',appName:'Load Bear',webDir:'www',server:{url:url.origin+'/bear',cleartext:false},ios:{contentInset:'never',backgroundColor:'#FFF7E8',preferredContentMode:'mobile'}};
await writeFile(new URL('capacitor.config.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
process.stdout.write('Load Bear shell loads '+config.server.url+'\n');
