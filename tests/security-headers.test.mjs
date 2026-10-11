import test from 'node:test';
import assert from 'node:assert/strict';
import {createScriptNonce,contentSecurityPolicy,permissionsPolicy,securityHeaders,supabaseOrigin} from '../lib/security-headers.ts';

const parse=value=>new Map(value.split(';').map(part=>part.trim().split(/\s+/)).filter(parts=>parts[0]).map(([key,...sources])=>[key,sources]));
test('production scripts need a fresh nonce and do not permit inline code, eval or wildcard origins',()=>{
 const nonces=Array.from({length:30},createScriptNonce);
 assert.equal(new Set(nonces).size,30);
 for(const nonce of nonces){
  assert.equal(Buffer.from(nonce,'base64').length,16);
  const policy=parse(contentSecurityPolicy({nonce,supabaseUrl:'https://project.supabase.co'}));
  assert.ok(policy.get('script-src').includes(`'nonce-${nonce}'`));
  assert.ok(policy.get('script-src').includes("'strict-dynamic'"));
  assert.ok(!policy.get('script-src').includes("'unsafe-inline'"));
  assert.ok(!policy.get('script-src').includes("'unsafe-eval'"));
  assert.ok(![...policy.values()].flat().some(value=>value.includes('*')));
  assert.deepEqual(policy.get('frame-ancestors'),["'none'"]);
  assert.deepEqual(policy.get('base-uri'),["'none'"]);
 }
 assert.throws(()=>contentSecurityPolicy({nonce:"bad'; script-src *"}));
});
test('the policy preserves existing Supabase auth, private photo, QR and approved library photo sources',()=>{
 const policy=parse(contentSecurityPolicy({supabaseUrl:'https://project.supabase.co'}));
 assert.deepEqual(policy.get('connect-src'),["'self'",'https://project.supabase.co']);
 for(const url of ['https://upload.wikimedia.org','https://live.staticflickr.com','https://images.unsplash.com','https://cdn.stocksnap.io'])assert.ok(policy.get('img-src').includes(url));
 for(const origin of ["'self'",'blob:','data:'])assert.ok(policy.get('img-src').includes(origin));
 assert.ok(policy.get('media-src').includes('blob:'));
 assert.ok(policy.get('style-src').includes('https://fonts.googleapis.com'));
 assert.ok(policy.get('font-src').includes('https://fonts.gstatic.com'));
 for(const sources of policy.values())assert.ok(!sources.includes('https://api.openai.com'));
});
test('backend configuration cannot inject directives or silently use an insecure production origin',()=>{
 assert.equal(supabaseOrigin('https://project.supabase.co/'),'https://project.supabase.co');
 for(const value of ['http://project.supabase.co','https://name:password@project.supabase.co','https://project.supabase.co/path','https://project.supabase.co/?x=1','data:text/plain,hello'])assert.throws(()=>supabaseOrigin(value));
 assert.equal(supabaseOrigin('http://localhost:54321',true),'http://localhost:54321');
 assert.throws(()=>supabaseOrigin('http://other.example',true));
 const production=contentSecurityPolicy(),development=contentSecurityPolicy({development:true});
 assert.match(production,/upgrade-insecure-requests/);assert.doesNotMatch(production,/unsafe-eval|ws:/);
 assert.match(development,/unsafe-eval/);assert.doesNotMatch(development,/upgrade-insecure-requests/);
});
test('sensor and camera access remains first-party while unrelated browser capabilities are denied',()=>{
 for(const name of ['accelerometer','gyroscope','magnetometer','camera'])assert.ok(permissionsPolicy.includes(name+'=(self)'));
 for(const name of ['autoplay','microphone','geolocation','payment','display-capture','usb','serial','hid','clipboard-read','clipboard-write'])assert.ok(permissionsPolicy.includes(name+'=()'));
 const headers=new Map(securityHeaders().map(({key,value})=>[key,value]));
 assert.equal(headers.get('X-Content-Type-Options'),'nosniff');
 assert.equal(headers.get('Referrer-Policy'),'strict-origin-when-cross-origin');
 assert.equal(headers.get('X-Frame-Options'),'DENY');
});
