import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {nativeConfig,productionOrigin} from '../native/configure.mjs';
import {contentSecurityPolicy} from '../lib/content-security-policy.ts';
import {movementReadError,healthPermissionLabels} from '../lib/health-status.ts';
test('native release content and both health origin guards agree on production',async()=>{
 const config=JSON.parse(await readFile(new URL('../native/capacitor.config.json',import.meta.url),'utf8'));assert.deepEqual(config,nativeConfig());assert.equal(config.server.url,productionOrigin);assert.equal(config.server.cleartext,false);
 for(const path of ['ios/App/App/EnoughMovementPlugin.swift','android/app/src/main/java/app/enough/movement/EnoughMovementPlugin.kt']){const source=await readFile(new URL('../native/'+path,import.meta.url),'utf8');assert.ok(source.includes('url.host == "enough-public.vercel.app"'));assert.ok(!source.includes('enough-movement.govindatusq.chatgpt.site'));assert.ok(source.includes('url.scheme == "https"'));}
});
test('explicit staging builds use a single HTTPS origin and reject paths, credentials, ports and injected values',()=>{
 assert.equal(nativeConfig('https://enough-staging.example/').server.url,'https://enough-staging.example');
 for(const target of ['http://enough.example','https://name:secret@enough.example','https://enough.example:8443','https://enough.example/app','https://enough.example/?token=x','https://enough.example/#moves','javascript:alert(1)','not a url'])assert.throws(()=>nativeConfig(target));
});
test('production CSP serves fonts locally and constrains connections and remote images without eval',()=>{
 const csp=contentSecurityPolicy({supabaseUrl:'https://project.supabase.co'});assert.ok(csp.includes("font-src 'self'"));assert.ok(csp.includes("connect-src 'self' https://project.supabase.co"));assert.ok(csp.includes("frame-ancestors 'none'"));assert.ok(csp.includes("object-src 'none'"));assert.ok(!csp.includes('unsafe-eval'));assert.ok(!csp.includes('fonts.googleapis'));assert.ok(!csp.includes('fonts.gstatic'));assert.ok(!csp.includes('https:;'));assert.ok(csp.includes('https://upload.wikimedia.org'));
 assert.ok(contentSecurityPolicy({development:true,supabaseUrl:'http://localhost:54321'}).includes('unsafe-eval'));assert.ok(!contentSecurityPolicy({development:true}).includes('upgrade-insecure-requests'));
 for(const supabaseUrl of ['javascript:alert(1)','https://user:secret@project.supabase.co','https://project.supabase.co/?token=x','http://project.supabase.co'])assert.throws(()=>contentSecurityPolicy({supabaseUrl}));
});
test('health failures provide safe recovery without exposing raw messages or claiming permission from an empty result',()=>{
 assert.equal(movementReadError(Error('Health access not granted')).retry,'connect');assert.match(movementReadError(Error('Install or update Health Connect')).message,/installed and up to date/);assert.match(movementReadError(Error('Untrusted origin')).message,/approved ENOUGH website/);
 const privateError='PRIVATE_NATIVE_DIAGNOSTIC';assert.ok(!movementReadError(Error(privateError)).message.includes(privateError));assert.match(healthPermissionLabels.unconfirmed,/no records|permission may be off/i);assert.match(healthPermissionLabels.stopped,/Revoke health permission/i);
});
