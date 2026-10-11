import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

// Run after `pnpm build`. This checks real production responses without a
// browser login, health data, photos or a provider credential.
const reservation=createServer();
await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));
const port=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
// Next canonicalises local callback URLs to localhost.
const origin=`http://localhost:${port}`;
const env={...process.env,NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL||'https://enough-ci.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'sb_publishable_ci_placeholder'};
delete env.OPENAI_API_KEY;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore','pipe','pipe']});
let output='',spawnError;
server.on('error',error=>{spawnError=error});
for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-6000)});
const request=(path,options={})=>fetch(origin+path,{...options,redirect:'manual',signal:AbortSignal.timeout(5000)});
const headerCheck=response=>{
 assert.equal(response.headers.get('x-content-type-options'),'nosniff');
 assert.equal(response.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('permissions-policy'),/camera=\(self\)/);
 assert.match(response.headers.get('permissions-policy'),/microphone=\(\)/);
 const csp=response.headers.get('content-security-policy');
 assert.ok(csp);assert.match(csp,/frame-ancestors 'none'/);
 assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'|unsafe-eval|\*/);
 assert.equal(csp.includes(','),false,'Only one policy should be enforced.');
 return csp;
};
try{
 let ready=false;
 for(let attempt=0;attempt<50;attempt++){
  if(spawnError)throw spawnError;
  if(server.exitCode!==null)throw Error('Production server exited: '+output);
  try{await request('/favicon.ico');ready=true;break}catch{await delay(100)}
 }
 assert.ok(ready,'Production server did not start: '+output);
 const nonces=[];
 for(const path of ['/','/','/signin','/recover','/update-password']){
  const response=await request(path,{headers:{'x-nonce':'untrusted-caller','Content-Security-Policy':"script-src * 'unsafe-inline'"}});
  assert.equal(response.status,200,path);
  const policy=headerCheck(response),nonce=policy.match(/'nonce-([^']+)'/)?.[1];
  assert.ok(nonce,'HTML needs a nonce.');assert.notEqual(nonce,'untrusted-caller');nonces.push(nonce);
  assert.match(response.headers.get('cache-control'),/no-store/);
  const html=await response.text(),scripts=[...html.matchAll(/<script\b[^>]*>/g)].map(match=>match[0]);
  assert.ok(scripts.length>0,'Next should render its runtime scripts.');
  for(const script of scripts)assert.ok(script.includes(`nonce="${nonce}"`),'The response policy must authorise every rendered script.');
 }
 assert.equal(new Set(nonces).size,nonces.length,'Nonces must differ for each page request.');
 const callback=await request('/auth/callback?next=https%3A%2F%2Fother.example');
 assert.ok([303,307].includes(callback.status));headerCheck(callback);
 assert.equal(new URL(callback.headers.get('location'),origin).origin,origin,'Failed OAuth callbacks must remain first-party.');
 const account=await request('/api/account');
 assert.equal(account.status,200);headerCheck(account);
 const anonymous=await account.json();assert.equal(anonymous.user,null);assert.equal(anonymous.state,null);
 for(const path of ['/api/photos','/api/idea-image?id=1234']){
  const response=await request(path);assert.equal(response.status,401,path);headerCheck(response);
 }
 const ideas=await request('/api/ideas',{method:'POST',headers:{'Content-Type':'application/json',origin},body:'{}'});
 assert.equal(ideas.status,401);headerCheck(ideas);
 const asset=await request('/images/welcome-hero.webp');assert.equal(asset.status,200);headerCheck(asset);
 console.log('Production security checks passed: fresh SSR nonces, authorised runtime scripts, caller-header replacement, security headers, OAuth callback boundary, protected account/photo/idea routes and static images.');
}finally{
 server.kill('SIGTERM');
 if(server.exitCode===null)await new Promise(resolve=>{server.once('exit',resolve);const timer=setTimeout(()=>{server.kill('SIGKILL');resolve()},3000);timer.unref()});
}
