// Outlook calendar: encrypted tokens, PKCE sign-in, approval-gated all-day events, duplicate-proof retries.
// Runs the REAL adapter over HTTP against a local stand-in for Microsoft (tests/support/fake-microsoft.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {calendarConfig} from '../lib/bear/calendar/config.ts';
import {encrypt,decrypt} from '../lib/bear/calendar/crypto.ts';
import {saveTokens,loadTokens,disconnect,isConnected} from '../lib/bear/calendar/accounts.ts';
import {authorizeUrl,pkce,newState,eventBody} from '../lib/bear/calendar/graph.ts';
import {completeConnection,requestCalendarAdd,approveCalendarAdd,tokenGetter} from '../lib/bear/calendar/service.ts';
import {capability} from '../lib/bear/engine/actions.ts';
import {idempotencyKey} from '../lib/bear/engine/execution.ts';
import {startFakeMicrosoft} from './support/fake-microsoft.mjs';

const KEY=randomBytes(32).toString('base64');const USER='20202020-2020-4202-8202-202020202020';const NOW=new Date('2026-11-03T09:00:00+11:00');
const CAMP='Hi parents, Lily’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.';
const envFor=(ms)=>({BEAR_CALENDAR_ENABLED:'on',BEAR_MS_CLIENT_ID:ms.state.clientId,BEAR_MS_CLIENT_SECRET:ms.state.secret,BEAR_TOKEN_KEY:KEY,BEAR_MS_AUTHORITY:ms.authority,BEAR_GRAPH_BASE_URL:ms.graphBase,BEAR_MS_TENANT:'consumers'});
async function world(){const ms=await startFakeMicrosoft();const env=envFor(ms);const cfg=calendarConfig(env);
 const s=new MemoryBackend().for(USER);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true,people:[{role:'child',name:'Lily'}]});
 const {extraction}=await createCapture(s,null,{method:'text',text:CAMP,referenceYear:2026});const task=(await maybeAutoSetup(s,extraction,NOW)).task;
 const d={cfg,f:fetch,env,now:NOW};return {ms,env,cfg,s,task,d};}
async function signIn(w){const {verifier,challenge}=pkce();const state=newState();const redirectUri='http://localhost:3000/api/bear/calendar/callback';
 const res=await fetch(authorizeUrl(w.cfg,{redirectUri,state,challenge}),{redirect:'manual'});const loc=new URL(res.headers.get('location'));assert.equal(loc.searchParams.get('state'),state);
 await completeConnection(w.s,w.d,{code:loc.searchParams.get('code'),redirectUri,verifier});}

test('off unless switched on AND fully configured; says exactly what is missing (names only)',()=>{
 assert.equal(calendarConfig({}).ready,false);assert.deepEqual(calendarConfig({}).missing,['BEAR_CALENDAR_ENABLED','BEAR_MS_CLIENT_ID','BEAR_MS_CLIENT_SECRET','BEAR_TOKEN_KEY']);
 assert.deepEqual(calendarConfig({BEAR_CALENDAR_ENABLED:'on',BEAR_MS_CLIENT_ID:'x',BEAR_MS_CLIENT_SECRET:'y',BEAR_TOKEN_KEY:'short'}).missing,['BEAR_TOKEN_KEY'],'a key that isn’t 32 bytes is refused');
 assert.equal(calendarConfig({BEAR_CALENDAR_ENABLED:'on',BEAR_MS_CLIENT_ID:'x',BEAR_MS_CLIENT_SECRET:'y',BEAR_TOKEN_KEY:KEY}).ready,true);
 assert.equal(capability('create_calendar_event',{}).state,'NOT_SUPPORTED','today’s truth: not supported');
 const on={BEAR_CALENDAR_ENABLED:'on',BEAR_MS_CLIENT_ID:'x',BEAR_MS_CLIENT_SECRET:'y',BEAR_TOKEN_KEY:KEY};
 assert.equal(capability('create_calendar_event',on).state,'REQUIRES_INTEGRATION','configured but the person hasn’t connected');
 assert.equal(capability('create_calendar_event',on,{connected:['calendar'],withdrawn:[]}).state,'AVAILABLE');
});
test('tokens are encrypted: nothing usable in the store, wrong key or wrong person fails, tampering fails',async()=>{
 const s=new MemoryBackend().for(USER);await saveTokens(s,{accessToken:'ACCESS-SECRET',refreshToken:'REFRESH-SECRET',expiresAt:'2026-12-01T00:00:00Z'},KEY,['Calendars.ReadWrite'],NOW);
 const blob=JSON.stringify(await s.list('connected_accounts'));assert.ok(!blob.includes('ACCESS-SECRET')&&!blob.includes('REFRESH-SECRET'));
 assert.deepEqual((await loadTokens(s,KEY)).refreshToken,'REFRESH-SECRET');
 assert.equal(await loadTokens(s,randomBytes(32).toString('base64')),null,'wrong key: nothing, not garbage');
 const row=(await s.list('connected_accounts'))[0];assert.throws(()=>decrypt(row.encrypted,KEY,'someone-else'));
 assert.throws(()=>decrypt(row.encrypted.slice(0,-3)+'AAA',KEY,USER),'tampered');
 assert.notEqual(encrypt('x',KEY,USER),encrypt('x',KEY,USER),'a fresh IV every time');
 await disconnect(s);assert.equal(await isConnected(s),false);
});
test('the sign-in link: authorisation code + PKCE (S256), least-privilege scope, state',()=>{
 const cfg=calendarConfig({BEAR_CALENDAR_ENABLED:'on',BEAR_MS_CLIENT_ID:'cid',BEAR_MS_CLIENT_SECRET:'y',BEAR_TOKEN_KEY:KEY});const {challenge}=pkce();
 const u=new URL(authorizeUrl(cfg,{redirectUri:'https://app.example/api/bear/calendar/callback',state:'st',challenge}));
 assert.equal(u.origin+u.pathname,'https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
 assert.deepEqual([u.searchParams.get('code_challenge_method'),u.searchParams.get('response_type'),u.searchParams.get('scope')],['S256','code','offline_access Calendars.ReadWrite']);
 assert.ok(!u.searchParams.has('client_secret')&&!u.toString().includes('client_secret'),'the secret never goes in the browser link');
});
test('connect, approve, create: one all-day event, verified by reading it back; approval binds the exact event',async()=>{
 const w=await world();try{
  assert.equal((await requestCalendarAdd(w.s,w.task.id,w.d)).status,'needs_connection');
  await signIn(w);assert.equal(await isConnected(w.s),true);assert.ok(!JSON.stringify(await w.s.list('connected_accounts')).includes('at-'));
  const ask=await requestCalendarAdd(w.s,w.task.id,w.d);assert.equal(ask.status,'needs_approval');assert.deepEqual(ask.summary,{title:'Year 5 camp',when:'2026-11-18, all day',where:'Your Outlook calendar'});
  assert.equal(w.ms.state.events.size,0,'asking creates nothing');
  const done=await approveCalendarAdd(w.s,w.task.id,w.d);assert.equal(done.status,'done');assert.match(done.message,/I checked it’s there/);
  const ev=[...w.ms.state.events.values()][0];assert.deepEqual([ev.subject,ev.isAllDay,ev.start.dateTime,ev.end.dateTime],['Year 5 camp',true,'2026-11-18T00:00:00','2026-11-19T00:00:00']);
  assert.equal(ev.transactionId,idempotencyKey({responsibilityId:w.task.id,actionType:'create_calendar_event',details:{title:'Year 5 camp',date:'2026-11-18',endDate:null,location:null,description:'For Lily. Added from Load Bear.'}}));
  assert.equal((await approveCalendarAdd(w.s,w.task.id,w.d)).status,'already_done');assert.equal(w.ms.state.createCount,1,'never twice');
 }finally{await w.ms.close();}
});
test('approving without being asked, or after the event changed, creates nothing',async()=>{
 const w=await world();try{await signIn(w);
  assert.equal((await approveCalendarAdd(w.s,w.task.id,w.d)).status,'needs_approval','never asked: never done');assert.equal(w.ms.state.createCount,0);
  await requestCalendarAdd(w.s,w.task.id,w.d);
  const t=await w.s.get('tasks',w.task.id);t.load.nodes[0].entities.eventDate='2026-11-25';await w.s.update('tasks',t.id,{load:t.load});   // the date changes after the person was asked
  assert.equal((await approveCalendarAdd(w.s,w.task.id,w.d)).status,'needs_approval','a changed date needs a fresh approval');assert.equal(w.ms.state.createCount,0);
 }finally{await w.ms.close();}
});
test('an expired token is refreshed once and the create still happens; a revoked refresh asks to reconnect',async()=>{
 const w=await world();try{await signIn(w);await requestCalendarAdd(w.s,w.task.id,w.d);
  w.ms.state.expireAccessOnNextCall=true;const done=await approveCalendarAdd(w.s,w.task.id,w.d);assert.equal(done.status,'done');assert.ok(w.ms.state.log.filter(l=>l.endsWith('/token')).length>=2,'refreshed');
  const w2=await world();try{await signIn(w2);await requestCalendarAdd(w2.s,w2.task.id,w2.d);w2.ms.state.refresh.clear();w2.ms.state.access.clear();
   const r=await approveCalendarAdd(w2.s,w2.task.id,w2.d);assert.equal(r.status,'failed');assert.match(r.message,/Reconnect/);assert.equal(w2.ms.state.createCount,0);}finally{await w2.ms.close();}
 }finally{await w.ms.close();}
});
test('a lost reply is safe to retry: the event was created once and the retry returns the same one',async()=>{
 const w=await world();try{await signIn(w);await requestCalendarAdd(w.s,w.task.id,w.d);
  w.ms.state.hangNext=true;const d={...w.d,timeoutMs:50};
  // The reply never comes back (the event WAS created). Use a short timeout through the execution layer.
  const {executeAction}=await import('../lib/bear/engine/execution.ts');const {GraphCalendarAdapter}=await import('../lib/bear/calendar/graph.ts');const {calendarRequestFor}=await import('../lib/bear/calendar/service.ts');
  const r=calendarRequestFor(await w.s.get('tasks',w.task.id)).request;const {decideApproval}=await import('../lib/bear/engine/execution.ts');await decideApproval(w.s,r,'grant',NOW);
  const adapter=new GraphCalendarAdapter(w.cfg,tokenGetter(w.s,w.d),fetch);
  const first=await executeAction(w.s,r,{adapter,env:w.env,grants:{connected:['calendar'],withdrawn:[]},now:NOW,timeoutMs:100});assert.equal(first.status,'unknown_outcome');assert.match(first.userMessage,/safe to try again/);assert.equal(w.ms.state.createCount,1);
  const second=await executeAction(w.s,r,{adapter,env:w.env,grants:{connected:['calendar'],withdrawn:[]},now:NOW});assert.ok(['done','accepted'].includes(second.status),second.status);assert.equal(w.ms.state.createCount,1,'still ONE event');
 }finally{await w.ms.close();}
});
test('failures say nothing was added; throttling and server errors retry safely',async()=>{
 const w=await world();try{await signIn(w);await requestCalendarAdd(w.s,w.task.id,w.d);
  w.ms.state.failNext=503;const out=await approveCalendarAdd(w.s,w.task.id,w.d);assert.equal(out.status,'failed');assert.match(out.message,/Nothing was added/);assert.equal(w.ms.state.createCount,0);
  const retry=await approveCalendarAdd(w.s,w.task.id,w.d);assert.equal(retry.status,'done');assert.equal(w.ms.state.createCount,1);
 }finally{await w.ms.close();}
});
test('events with a time are not created (a wrong time zone could move an appointment); another person’s account is never used',async()=>{
 const w=await world();try{await signIn(w);
  const t=await w.s.get('tasks',w.task.id);t.load.nodes[0].entities.time='9:15am';await w.s.update('tasks',t.id,{load:t.load});
  assert.equal((await requestCalendarAdd(w.s,w.task.id,w.d)).status,'timed_not_supported');assert.equal((await approveCalendarAdd(w.s,w.task.id,w.d)).status,'no_event');
  const other=new MemoryBackend().for('21212121-2121-4212-8212-212121212121');await ensureProfile(other);assert.equal(await isConnected(other),false);
  assert.equal(await loadTokens(other,KEY),null);
 }finally{await w.ms.close();}
});
test('the Graph body: all-day, UTC midnight to midnight, transactionId, text trimmed',()=>{
 const b=eventBody({title:'T'.repeat(400),date:'2026-11-18',endDate:'2026-11-20',location:'Camp Site',description:'Hi'},'KEY');
 assert.deepEqual([b.isAllDay,b.start.dateTime,b.end.dateTime,b.transactionId,b.subject.length,b.location.displayName],[true,'2026-11-18T00:00:00','2026-11-21T00:00:00','KEY',250,'Camp Site']);
});
