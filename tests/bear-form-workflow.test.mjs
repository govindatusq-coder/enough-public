// The school permission-form workflow, end to end on the real pipeline: notice → form → prepared copy → the parent decides,
// signs and sends it → says so. Bear never submits and never marks anything done itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile,profilePatchSchema} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {actOnLoad} from '../lib/bear/services/load.ts';
import {attachForm,updateForm,preparedFormFile,forgetFormFacts} from '../lib/bear/forms/service.ts';
import {history} from '../lib/bear/engine/events.ts';
import {responsibilityView} from '../lib/bear/engine/view.ts';
import {makeForm} from './support/make-form.mjs';

const USER='22222222-3333-4333-8333-222222222222',NOW=new Date('2026-11-03T09:00:00+11:00');
const CAMP='Hi parents, Lily Nguyen’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November.';
async function setup(){const s=new MemoryBackend().for(USER);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true,people:[{role:'child',name:'Lily Nguyen'}]});return s;}
async function give(s,text){const {extraction}=await createCapture(s,null,{method:'text',text,referenceYear:2026});return (await maybeAutoSetup(s,extraction,NOW)).task;}
const valuesOf=async(bytes)=>{const f=(await PDFDocument.load(bytes)).getForm();return Object.fromEntries(f.getFields().map(x=>[x.getName(),x.constructor.name==='PDFCheckBox'?x.isChecked():(x.getText?.()||'')]));};

test('notice → form → prepared copy: Bear fills what it can verify and says what is left for the parent',async()=>{
 const s=await setup();const task=await give(s,CAMP);assert.equal(task.forPerson,'Lily Nguyen');
 const puts=[];const put=s.putFile.bind(s);s.putFile=(k,b,m)=>{puts.push(k);return put(k,b,m);};
 const r=await attachForm(s,task.id,await makeForm(),{now:NOW});assert.equal(r.ok,true);
 assert.deepEqual([r.filled,r.needsDecision,r.needsDetail],[4,8,4]);
 const t=await s.get('tasks',task.id);assert.equal(t.preparedForm.total,17);assert.deepEqual(t.preparedForm.filled.sort(),['Excursion_Date','Excursion_Name','Student_Name','Year_Level']);
 assert.ok(t.preparedForm.needsDecision.includes('Parent_Signature')&&t.preparedForm.needsDecision.includes('Consent_Given'));
 assert.ok(puts.every(k=>k.startsWith(USER+'/forms/')),'kept privately, under the owner');assert.equal(puts.length,2,'the original and the prepared copy');
 const f=await preparedFormFile(s,task.id);assert.match(f.filename,/year-5-camp-form-prepared\.pdf/);
 const v=await valuesOf(f.bytes);assert.deepEqual([v.Student_Name,v.Excursion_Date,v.Year_Level],['Lily Nguyen','18/11/2026','Year 5']);assert.equal(v.Parent_Signature,'');assert.equal(v.Consent_Given,false);
 // Nothing was submitted, sent or completed.
 assert.equal((await s.get('tasks',task.id)).status,'open');const ev=await history(s,task.id);const prep=ev.find(e=>e.eventType==='action_prepared'&&e.metadata.actionType==='prepare_form');
 assert.deepEqual([prep.metadata.filled,prep.metadata.needsDecision,prep.metadata.sent],[4,8,false]);
 assert.ok(!ev.some(e=>e.eventType.startsWith('execution_')||e.eventType==='verified'));
 const blob=JSON.stringify(ev)+JSON.stringify(await s.list('behaviour_events'));for(const leak of ['Lily','Nguyen','Sarah','Parent_Signature'])assert.ok(!blob.includes(leak),'counts only: '+leak);
 const rs=(await s.list('behaviour_events')).find(e=>e.detail?.signal==='form_prepared');assert.deepEqual([rs.detail.filled,rs.detail.total],[4,17]);
});
test('the parent adds her details once; Bear remembers them for the next form, and she can make it forget',async()=>{
 const s=await setup();const a=await give(s,CAMP);await attachForm(s,a.id,await makeForm(),{now:NOW});
 const u=await updateForm(s,a.id,{facts:{parentName:'Sarah Nguyen',phone:'0400 000 000',email:'sarah@example.com',address:'1 Test St',signature:'S',medical:'x'},remember:true,now:NOW});
 assert.deepEqual([u.ok,u.filled,u.needsDetail],[true,8,0]);
 const v=await valuesOf((await preparedFormFile(s,a.id)).bytes);assert.deepEqual([v.Parent_Guardian_Name,v.Parent_Mobile],['Sarah Nguyen','0400 000 000']);
 for(const n of ['Parent_Signature','Medical_Conditions','Emergency_Contact_Name'])assert.equal(v[n],'',n+' is still the parent’s');
 const profile=await ensureProfile(s);assert.deepEqual(Object.keys(profile.formFacts).sort(),['address','email','parentName','phone']);
 // The next form (a different excursion) arrives already filled with those details: she isn't asked again.
 const b=await give(s,'Hi parents, Lily Nguyen’s Year 6 excursion is on 25 November. Permission forms are due 20 November.');
 const r=await attachForm(s,b.id,await makeForm(),{now:NOW});assert.equal(r.needsDetail,0);assert.equal((await valuesOf((await preparedFormFile(s,b.id)).bytes)).Parent_Mobile,'0400 000 000');
 await forgetFormFacts(s);assert.deepEqual((await ensureProfile(s)).formFacts,{});
 const c=await give(s,'Hi parents, Lily Nguyen’s Year 5 swimming carnival is on 30 November. Permission forms are due 25 November.');assert.equal((await attachForm(s,c.id,await makeForm(),{now:NOW})).needsDetail,4,'forgotten means forgotten');
});
test('details are only remembered when she says so, and only the four plain ones can ever be stored',async()=>{
 const s=await setup();const a=await give(s,CAMP);await attachForm(s,a.id,await makeForm(),{now:NOW});
 await updateForm(s,a.id,{facts:{phone:'0400 000 000'},remember:false,now:NOW});assert.equal((await ensureProfile(s)).formFacts,undefined,'used for this form, not stored');
 assert.equal(profilePatchSchema.safeParse({formFacts:{medical:'asthma'}}).success,false);assert.equal(profilePatchSchema.safeParse({formFacts:{signature:'x'}}).success,false);
 assert.equal(profilePatchSchema.safeParse({formFacts:{phone:'0400'}}).success,true);
});
test('refused safely: a responsibility with no form step, a file that isn’t a form — and nothing is stored',async()=>{
 const s=await setup();const note=await give(s,'Book week parade is on 11 November.');
 const puts=[];const put=s.putFile.bind(s);s.putFile=(k,b,m)=>{puts.push(k);return put(k,b,m);};
 const camp=await give(s,CAMP);
 assert.deepEqual(await attachForm(s,note.id,await makeForm(),{now:NOW}),{ok:false,reason:'no_form_step'});
 assert.deepEqual(await attachForm(s,camp.id,new TextEncoder().encode('not a pdf'),{now:NOW}),{ok:false,reason:'not_a_pdf'});
 assert.deepEqual(await attachForm(s,'missing',await makeForm(),{now:NOW}),{ok:false,reason:'no_task'});
 assert.deepEqual(await updateForm(s,camp.id,{now:NOW}),{ok:false,reason:'no_original'});assert.equal(puts.length,0);assert.equal((await s.get('tasks',camp.id)).preparedForm,undefined);
});
test('another household can never reach the form',async()=>{
 const s=await setup();const t=await give(s,CAMP);await attachForm(s,t.id,await makeForm(),{now:NOW});
 const other=new MemoryBackend().for('44444444-4444-4444-8444-444444444444');await ensureProfile(other);
 assert.equal(await preparedFormFile(other,t.id),null);const key=(await s.get('tasks',t.id)).preparedForm.pdfKey;assert.equal(await other.getFile(key),null,'the file key itself is owner-prefixed');
});
test('completion is the parent’s word: signing and sending is hers, and “Consent’s done” is the evidence',async()=>{
 const s=await setup();const t=await give(s,CAMP);await attachForm(s,t.id,await makeForm(),{now:NOW});
 const consent=()=>s.get('tasks',t.id).then(x=>x.load.nodes.find(n=>n.title==='Consent').steps.find(st=>st.key==='submit'));
 assert.equal((await consent()).status,'pending','a prepared form is not a submitted form');
 const before=await responsibilityView(s,t.id,NOW);assert.notEqual(before.state,'verified');
 await actOnLoad(s,t.id,{stepId:(await consent()).id},NOW);assert.equal((await consent()).status,'done');
});
