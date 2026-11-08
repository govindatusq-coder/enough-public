// Enterprise API v1: contract, authentication, tenant isolation (Scenario F), idempotency, rate limits,
// privacy-preserving reporting, provisioning, white-label safety and the mock benefits-platform adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {handle,RateLimiter,K_ANONYMITY} from '../lib/bear/enterprise/api.ts';
import {MemoryTenantRegistry} from '../lib/bear/enterprise/tenants.ts';
import {brandFor,LOAD_BEAR_BRAND} from '../lib/bear/enterprise/branding.ts';
import {MockBenefitsPlatform,signLaunch,verifyLaunch} from '../lib/bear/enterprise/benefits-adapter.ts';

const NOW=new Date('2026-11-09T09:00:00+11:00');
function world(){const reg=new MemoryTenantRegistry();const backend=new MemoryBackend();const a=reg.createTenant('Acme Pty Ltd');const b=reg.createTenant('Beta Co');
 const deps={registry:reg,storeFor:u=>backend.for(u),now:()=>NOW};
 const call=(key,method,path,body=null,headers={})=>handle({method,path,headers:{authorization:`Bearer ${key}`,...headers},body},deps);
 return {reg,a,b,deps,call};}
const CAMP='Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November. Students need a sleeping bag.';

test('authentication: no key, bad key, revoked key → 401 with a structured error and request id',async()=>{
 const w=world();
 const r1=await handle({method:'GET',path:'/api/v1/capabilities',headers:{},body:null},w.deps);assert.equal(r1.status,401);assert.equal(r1.body.error.code,'unauthenticated');assert.ok(r1.headers['X-Request-Id']);
 assert.equal((await w.call('lbk_notarealkeynotarealkey00','GET','/api/v1/capabilities')).status,401);
 w.reg.revokeKey(w.a.key);assert.equal((await w.call(w.a.key,'GET','/api/v1/capabilities')).status,401);
});
test('stateless extract and plan: the same engine, evidence included, nothing stored',async()=>{
 const w=world();const r=await w.call(w.a.key,'POST','/api/v1/responsibilities/extract',{text:CAMP,today:'2026-11-03'});
 assert.equal(r.status,200);assert.equal(r.body.responsibilities.length,3);assert.ok(r.body.responsibilities.every(x=>x.sourceEvidence[0].excerpt));
 const p=await w.call(w.a.key,'POST','/api/v1/responsibilities/plan',{text:'Renew the car registration by 30 November.'});assert.equal(p.status,200);assert.equal(p.body.plan.valid,true);
 assert.equal((await w.call(w.a.key,'POST','/api/v1/responsibilities/extract',{text:''})).body.error.code,'invalid_request');
 assert.equal((await w.call(w.a.key,'POST','/api/v1/responsibilities/extract',{text:'x',extra:1})).status,400,'unknown fields rejected');
});
test('provision → create → read → plan → history → verify, for the tenant’s own member',async()=>{
 const w=world();assert.equal((await w.call(w.a.key,'POST','/api/v1/members',{externalId:'emp-001'})).status,201);
 const H={'x-loadbear-subject':'emp-001'};
 const c=await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},H);assert.equal(c.status,201);const id=c.body.responsibilityIds[0];
 const g=await w.call(w.a.key,'GET',`/api/v1/responsibilities/${id}`,null,H);assert.equal(g.status,200);assert.equal(g.body.id,id);assert.ok(['ready','planned'].includes(g.body.state));assert.ok(g.body.statusText);
 assert.equal((await w.call(w.a.key,'POST','/api/v1/responsibilities/plan',{responsibilityId:id},H)).body.plan.valid,true);
 const v=await w.call(w.a.key,'POST',`/api/v1/responsibilities/${id}/verify`,{method:'user_confirmation'},H);assert.equal(v.status,200);assert.equal(v.body.state,'verified');assert.equal(v.body.verification.method,'user_confirmation');
 const h=await w.call(w.a.key,'GET',`/api/v1/responsibilities/${id}/history`,null,H);assert.ok(h.body.events.some(e=>e.to==='verified'));
 assert.equal((await w.call(w.a.key,'POST',`/api/v1/responsibilities/${id}/verify`,{method:'document'},H)).status,400,'only supported verification methods');
});
test('Scenario F: one tenant can’t reach another tenant’s members or responsibilities',async()=>{
 const w=world();await w.call(w.a.key,'POST','/api/v1/members',{externalId:'emp-001'});await w.call(w.b.key,'POST','/api/v1/members',{externalId:'emp-001'});
 const id=(await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},{'x-loadbear-subject':'emp-001'})).body.responsibilityIds[0];
 // Same external id in tenant B is a different person: A's data is invisible.
 assert.equal((await w.call(w.b.key,'GET',`/api/v1/responsibilities/${id}`,null,{'x-loadbear-subject':'emp-001'})).status,404);
 assert.equal((await w.call(w.b.key,'GET',`/api/v1/responsibilities/${id}/history`,null,{'x-loadbear-subject':'emp-001'})).status,404);
 assert.equal((await w.call(w.b.key,'POST',`/api/v1/responsibilities/${id}/verify`,{method:'user_confirmation'},{'x-loadbear-subject':'emp-001'})).status,404);
 assert.equal((await w.call(w.b.key,'GET',`/api/v1/responsibilities/${id}`,null,{'x-loadbear-subject':'emp-999'})).status,403,'unknown subject');
 assert.equal((await w.call(w.a.key,'GET',`/api/v1/responsibilities/${id}`)).status,403,'no subject');
});
test('deprovisioning ends access straight away',async()=>{
 const w=world();await w.call(w.a.key,'POST','/api/v1/members',{externalId:'emp-002'});const H={'x-loadbear-subject':'emp-002'};
 const id=(await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},H)).body.responsibilityIds[0];
 assert.equal((await w.call(w.a.key,'DELETE','/api/v1/members/emp-002')).status,200);
 assert.equal((await w.call(w.a.key,'GET',`/api/v1/responsibilities/${id}`,null,H)).status,403);
});
test('idempotency: the same key replays the first result and does the work once',async()=>{
 const w=world();await w.call(w.a.key,'POST','/api/v1/members',{externalId:'emp-003'});const H={'x-loadbear-subject':'emp-003','idempotency-key':'create-abc-123'};
 const r1=await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},H);
 const r2=await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},H);
 assert.deepEqual(r2.body,r1.body);assert.equal(r2.headers['Idempotent-Replay'],'true');
 const member=await w.reg.member(w.a.tenant.id,'emp-003');assert.equal((await w.deps.storeFor(member.userId).list('tasks')).filter(t=>t.load).length,1);
 assert.equal((await w.call(w.a.key,'POST','/api/v1/members',{externalId:'x'},{'idempotency-key':'bad key!'})).status,400);
});
test('rate limiting per tenant',async()=>{
 const w=world();const deps={...w.deps,rateLimit:new RateLimiter(3,60_000)};
 const go=k=>handle({method:'GET',path:'/api/v1/capabilities',headers:{authorization:`Bearer ${k}`},body:null},deps);
 for(let i=0;i<3;i++)assert.equal((await go(w.a.key)).status,200);
 const r=await go(w.a.key);assert.equal(r.status,429);assert.equal(r.headers['Retry-After'],'60');
 assert.equal((await go(w.b.key)).status,200,'other tenants unaffected');
});
test('actions through the API: approval enforced, unsupported actions explained, never faked',async()=>{
 const w=world();await w.call(w.a.key,'POST','/api/v1/members',{externalId:'emp-004'});const H={'x-loadbear-subject':'emp-004'};
 const id=(await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:'Return the library books by 12 November.'},H)).body.responsibilityIds[0];
 const pay=await w.call(w.a.key,'POST',`/api/v1/responsibilities/${id}/actions`,{actionType:'make_payment',approved:true},H);assert.equal(pay.status,409);assert.equal(pay.body.outcome.status,'not_available');
 const draft=await w.call(w.a.key,'POST',`/api/v1/responsibilities/${id}/actions`,{actionType:'draft_message',input:{draft:'Hi'}},H);assert.equal(draft.body.outcome.status,'prepared');
 assert.equal((await w.call(w.a.key,'POST',`/api/v1/responsibilities/${id}/actions`,{actionType:'launch_rocket'},H)).status,400);
});
test('employer reporting: aggregated, coarse, and suppressed for small groups; never personal details',async()=>{
 const w=world();for(let i=0;i<K_ANONYMITY-1;i++)await w.call(w.a.key,'POST','/api/v1/members',{externalId:`e${i}`});
 const small=await w.call(w.a.key,'GET','/api/v1/reports/usage');assert.equal(small.body.suppressed,true);assert.equal(small.body.activeMembers,null);
 await w.call(w.a.key,'POST','/api/v1/members',{externalId:'e-last'});
 await w.call(w.a.key,'POST','/api/v1/responsibilities',{text:CAMP},{'x-loadbear-subject':'e0'});
 const big=await w.call(w.a.key,'GET','/api/v1/reports/usage');assert.equal(big.body.suppressed,false);assert.equal(big.body.activeMembers,K_ANONYMITY);
 const text=JSON.stringify(big.body);for(const leak of ['camp','Year 5','180','e0','emp'])assert.ok(!text.includes(leak),leak);
 assert.deepEqual(Object.keys(big.body).sort(),['activeMembers','completionsConfirmed','membersUsingLoadBear','responsibilitiesManaged','suppressed']);
});
test('white-label: safe overrides only; Load Bear branding is the default',async()=>{
 assert.deepEqual(brandFor(null),LOAD_BEAR_BRAND);
 const b=brandFor({appName:'Life Admin',primary:'#123456',accent:'red;background:url(x)',logoUrl:'javascript:alert(1)'});
 assert.equal(b.appName,'Life Admin');assert.equal(b.primary,'#123456');assert.equal(b.accent,LOAD_BEAR_BRAND.accent);assert.equal(b.logoUrl,null);
 const w=world();w.reg.tenants.get(w.a.tenant.id).brand={appName:'Life Admin, Handled'};assert.equal((await w.call(w.a.key,'GET','/api/v1/branding')).body.brand.appName,'Life Admin, Handled');
});
test('mock benefits platform: provision, launch token, usage report, deprovision (demo adapter)',async()=>{
 const w=world();const platform=new MockBenefitsPlatform({call:async(m,p,b)=>{const r=await w.call(w.a.key,m,p,b);return {status:r.status,body:r.body};},launchSecret:'test-secret',tenantId:w.a.tenant.id,baseUrl:'https://app.example'});
 assert.equal((await platform.provisionEmployee('hero-42')).ok,true);
 const url=await platform.launchUrl('hero-42');const token=new URL(url).searchParams.get('token');
 assert.deepEqual(verifyLaunch('test-secret',token),{tenantId:w.a.tenant.id,externalId:'hero-42'});
 assert.equal(verifyLaunch('wrong-secret',token),null);assert.equal(verifyLaunch('test-secret',signLaunch('test-secret','t','s',Date.now()-10*60_000)),null,'expired');
 assert.equal((await platform.usageReport()).suppressed,true);
 assert.equal((await platform.deprovisionEmployee('hero-42')).ok,true);
});
test('unknown endpoints and methods',async()=>{
 const w=world();assert.equal((await w.call(w.a.key,'GET','/api/v1/admin/users')).status,404);assert.equal((await w.call(w.a.key,'GET','/api/v2/responsibilities')).status,404);
});

test('research export: opt-in only, pseudonymous, counts only (no household content)',async()=>{
 const {researchExport,pseudonym}=await import('../lib/bear/engine/research-export.ts');
 const {ensureProfile,saveProfile}=await import('../lib/bear/services/profile.ts');const {createCapture}=await import('../lib/bear/services/capture.ts');const {maybeAutoSetup}=await import('../lib/bear/services/auto-setup.ts');
 const s=new MemoryBackend().for('56565656-5656-4565-8565-565656565656');const p=await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true});
 const {extraction}=await createCapture(s,null,{method:'text',text:'Year 5 camp is on 18 November. Payment of $180 is due 12 November.',referenceYear:2026});await maybeAutoSetup(s,extraction,NOW);
 const secret='a-long-study-secret-123';
 assert.equal(await researchExport(s,secret,'2026-11-09'),null,'no consent → nothing');
 await s.update('profiles',p.id,{research:{consent:true,at:NOW.toISOString()}});
 const row=await researchExport(s,secret,'2026-11-09');assert.equal(row.participant,pseudonym(s.userId,secret));assert.notEqual(row.participant,s.userId);
 const text=JSON.stringify(row);for(const leak of ['camp','Sarah','180','Year 5',s.userId])assert.ok(!text.includes(leak),leak);
 await assert.rejects(researchExport(s,'short','2026-11-09'),/study_secret_required/);
});
