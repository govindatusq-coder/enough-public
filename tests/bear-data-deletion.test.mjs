// Deleting my data: every record, every stored file, nothing of anyone else's, and the database function covers every table.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {indexes} from '../lib/bear/store/store.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {attachForm} from '../lib/bear/forms/service.ts';
import {saveTokens} from '../lib/bear/calendar/accounts.ts';
import {requestApproval} from '../lib/bear/engine/execution.ts';
import {makeForm} from './support/make-form.mjs';

const NOW=new Date('2026-11-03T09:00:00+11:00');
async function populate(s){
 await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family','home','money'],onboardingComplete:true,people:[{role:'child',name:'Mia'}],formFacts:{phone:'0400 000 000'}});
 const {extraction}=await createCapture(s,null,{method:'text',text:'Mia’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.',referenceYear:2026});
 const task=(await maybeAutoSetup(s,extraction,NOW)).task;
 await createCapture(s,null,{method:'upload',file:{bytes:new Uint8Array([0xff,0xd8,0xff,1,2,3]),mime:'image/jpeg',name:'photo.jpg'},referenceYear:2026}).catch(()=>null);
 await attachForm(s,task.id,await makeForm(),{now:NOW});
 await requestApproval(s,{responsibilityId:task.id,actionType:'send_message',details:{to:'x@y.z'}},NOW);
 await saveTokens(s,{accessToken:'a',refreshToken:'r',expiresAt:'2026-12-01T00:00:00Z'},Buffer.alloc(32,1).toString('base64'),['x'],NOW);
 return task;
}
const counts=async(s)=>Object.fromEntries(await Promise.all(Object.keys(indexes).map(async t=>[t,(await s.list(t)).length])));
const A='aaaaaaaa-0000-4000-8000-0000000000aa',B='bbbbbbbb-0000-4000-8000-0000000000bb';

test('deleting removes every record in every table, and every stored file, for that person only',async()=>{
 const backend=new MemoryBackend();const a=backend.for(A),b=backend.for(B);
 const task=await populate(a);await populate(b);
 const before=await counts(a);assert.ok(before.tasks>0&&before.responsibility_events>0&&before.connected_accounts>0&&before.profiles>0,'there is real data to delete');
 const pf=(await a.get('tasks',task.id)).preparedForm;assert.ok(await a.getFile(pf.pdfKey)&&await a.getFile(pf.originalKey),'forms are stored');
 const bBefore=await counts(b);const bFiles=(await b.get('tasks',(await b.list('tasks'))[0].id)).preparedForm;
 await a.eraseAll();
 const after=await counts(a);for(const [t,n] of Object.entries(after))assert.equal(n,0,`${t} must be empty after deletion`);
 assert.equal(await a.getFile(pf.pdfKey),null);assert.equal(await a.getFile(pf.originalKey),null);
 assert.deepEqual(await counts(b),bBefore,'someone else’s data is untouched');assert.ok(await b.getFile(bFiles.pdfKey),'someone else’s files are untouched');
});
test('after deleting, the person starts fresh and can use Bear again',async()=>{
 const s=new MemoryBackend().for(A);await populate(s);await s.eraseAll();
 const p=await ensureProfile(s);assert.equal(p.name,'');assert.equal(p.formFacts,undefined);assert.equal((await s.list('tasks')).length,0);
 const {extraction}=await createCapture(s,null,{method:'text',text:'Please return the excursion form by Friday 13 November.',referenceYear:2026});assert.ok((await maybeAutoSetup(s,extraction,NOW)).task);
});
test('the database function deletes from EVERY table the app uses (so a new table can’t be forgotten)',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261112120000_bear_delete_my_data.sql',import.meta.url),'utf8');
 const listed=new Set([...sql.matchAll(/'([a-z_]+)'/g)].map(m=>m[1]));
 for(const table of Object.keys(indexes))assert.ok(listed.has(table),`bear_${table} is missing from bear_delete_my_data()`);
 assert.match(sql,/auth\.uid\(\)/,'only ever the caller’s rows');assert.match(sql,/revoke all on function public\.bear_delete_my_data\(\) from public,anon/);assert.match(sql,/to_regclass/,'skips tables that don’t exist yet');
 assert.match(sql,/set search_path=''/,'no search-path hijacking');
});

// Without the database helper (migration not applied) deletion still works, table by table, and says what it could not remove.
test('deletion works without the database helper, and reports a history log it cannot remove',async()=>{
 const {SupabaseStore,ERASE_ORDER}=await import('../lib/bear/store/supabase.ts');
 const fake=(opts)=>{const deleted=[];const db={
  rpc:async()=>({error:{code:'PGRST202',message:'function not found'}}),
  storage:{from:()=>({list:async()=>({data:[],error:null}),remove:async()=>({error:null})})},
  from:(table)=>({
   delete:()=>({eq:async(col,val)=>{assert.equal(col,'user_id');assert.equal(val,'u1');if(opts.missing?.includes(table))return {error:{code:'PGRST205',message:'no table'}};if(table==='bear_responsibility_events')return {error:{code:'42501',message:'permission denied'}};deleted.push(table);return {error:null};}}),
   select:()=>({eq:async()=>({count:opts.events,error:null})}),
  })};return {db,deleted};};
 const a=fake({events:3,missing:['bear_study_responses']});const r=await new SupabaseStore('u1',a.db).eraseAll();
 assert.deepEqual(r.leftover,['responsibility_events'],'the history log is reported, not hidden');
 assert.equal(a.deleted.length,ERASE_ORDER.length-2,'every other table that exists was cleared, only this person’s rows');
 assert.ok(a.deleted.indexOf('bear_tasks')<a.deleted.indexOf('bear_profiles'),'children before parents');
 const b=fake({events:0});assert.deepEqual((await new SupabaseStore('u1',b.db).eraseAll()).leftover,[],'nothing left when there is no history');
});
test('any other database failure during deletion is an error, never a silent success',async()=>{
 const {SupabaseStore}=await import('../lib/bear/store/supabase.ts');
 const db={rpc:async()=>({error:{code:'PGRST202',message:'x'}}),storage:{from:()=>({list:async()=>({data:[],error:null}),remove:async()=>({error:null})})},from:()=>({delete:()=>({eq:async()=>({error:{code:'57014',message:'timeout'}})})})};
 await assert.rejects(()=>new SupabaseStore('u1',db).eraseAll());
});
