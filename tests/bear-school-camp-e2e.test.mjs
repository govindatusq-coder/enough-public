// The reference workflow: a school camp notice → understand → plan → prepare → present → execute (honestly) → verify →
// monitor → complete. Real pipeline, real state changes, no canned responses. Outward actions are NOT_SUPPORTED in
// production, so the test shows the honest handoff; the approval/recovery path is exercised with a TEST adapter that
// behaves like a fallible service (injected capability; production never does that).
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {actOnLoad,readLoad} from '../lib/bear/services/load.ts';
import {applyConfirmation} from '../lib/bear/inbound/process.ts';
import {extractResponsibilities} from '../lib/bear/engine/extract.ts';
import {planFor} from '../lib/bear/engine/plan.ts';
import {responsibilityView} from '../lib/bear/engine/view.ts';
import {history,syncState} from '../lib/bear/engine/events.ts';
import {executeAction,requestApproval,decideApproval,confirmExecution,idempotencyKey} from '../lib/bear/engine/execution.ts';
import {statusCardModel} from '../lib/bear/engine/status.ts';
import {calendarEventIcs} from '../lib/bear/engine/prepare.ts';

const USER='16161616-1616-4161-8161-161616161616';const NOW=new Date('2026-11-03T09:00:00+11:00');const AFTER=new Date('2026-11-19T09:00:00+11:00');
const NOTICE='Hi parents, Lily’s Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November. Students need a sleeping bag, water bottle and enclosed shoes.';
const AVAILABLE=(t)=>({actionType:t,category:'B',available:true,state:'AVAILABLE',integrationRequired:true,requiresUserApproval:true,riskLevel:'medium',supportsVerification:true,needs:'contact_external'});
async function setup(){const s=new MemoryBackend().for(USER);await ensureProfile(s);await saveProfile(s,{name:'Sarah',areas:['family'],onboardingComplete:true,people:[{role:'child',name:'Lily'}]});return s;}
const card=async(s,id,now=NOW)=>{const v=await responsibilityView(s,id,now);return statusCardModel({title:v.title,state:v.state,nextAction:v.nextAction,prepared:v.prepared,bearHandling:v.bearHandling,verification:v.verification});};

test('reference workflow: understand → plan → prepare → present → execute → verify → complete',async()=>{
 process.env.BEAR_EXECUTION_ENABLED='on';
 try{
 const s=await setup();let allSortedTooEarly=false;
 // 1. UNDERSTAND: facts vs inferences, each with its own date; the event date is not a deadline; the right child.
 const r=extractResponsibilities(NOTICE,{today:'2026-11-03',sourceId:'n1'}).responsibilities;
 const consent=r.find(x=>x.responsibilityPattern==='FORM_APPLICATION'),pay=r.find(x=>x.responsibilityPattern==='BILL_PAYMENT');
 assert.deepEqual([consent.dueDate,consent.dueDateBasis],['2026-11-10','explicit']);assert.deepEqual([pay.dueDate,pay.amountCents],['2026-11-12',18000]);
 const {extraction}=await createCapture(s,null,{method:'email',text:NOTICE,referenceYear:2026});const auto=await maybeAutoSetup(s,extraction,NOW);const task=auto.task;
 assert.equal(task.title,'Year 5 camp');assert.equal(task.forPerson,'Lily');assert.equal(task.dueAt,'2026-11-18');
 // 2. PLAN: valid graph; packing doesn't wait for payment; consent and payment are separate branches with their own dates.
 const plan=planFor(task.load);assert.equal(plan.valid,true);assert.deepEqual(plan.issues.filter(i=>i.kind==='cycle'||i.kind==='missing_prerequisite'),[]);
 const pack=plan.steps.find(x=>/Pack for/.test(x.label)),pays=plan.steps.find(x=>/^Pay /.test(x.label));
 assert.ok(!pack.dependsOn.includes(pays.id),'packing doesn’t wait for payment');
 assert.deepEqual(plan.steps.filter(x=>x.group&&x.group!=='main').map(x=>x.group).filter((g,i,a)=>a.indexOf(g)===i).sort(),['Consent','Payment']);
 // 3. PREPARE: what Bear can really prepare, nothing sent.
 const v0=await responsibilityView(s,task.id,NOW);
 assert.deepEqual(v0.prepared.map(p=>p.label),['Consent','Payment','To have ready']);assert.match(v0.prepared[1].value,/\$180 · by 12 Nov/);
 const ics=calendarEventIcs({uid:task.id,title:'Year 5 camp',date:task.dueAt,description:'Lily',stamp:NOW});
 assert.match(ics,/DTSTART;VALUE=DATE:20261118/);assert.match(ics,/SUMMARY:Year 5 camp/);assert.ok(!/ATTENDEE|ORGANIZER/.test(ics),'a prepared file, not an invitation sent to anyone');
 const draft=await executeAction(s,{responsibilityId:task.id,actionType:'draft_message',details:{draft:'Hi, please find Lily’s signed consent attached.'}},{now:NOW});assert.equal(draft.status,'prepared');
 // 4. PRESENT: one clear thing needed, never "all sorted".
 let c=await card(s,task.id);assert.equal(c.kind,'need_you');assert.match(c.action.label,/Consent is due 10 Nov/);
 // 5a. EXECUTE, honestly: sending the consent form isn't connected in production. Bear says so and does nothing.
 const SEND={responsibilityId:task.id,actionType:'send_message',details:{to:'office@oakhill.example',subject:'Year 5 camp consent',attachment:'consent-lily.pdf'}};
 const off=await executeAction(s,SEND,{adapter:{async perform(){throw new Error('must not be called');}},now:NOW});assert.equal(off.status,'not_available');
 assert.equal((await s.get('tasks',task.id)).status,'open','nothing was marked done');
 assert.ok(!(await history(s,task.id)).some(e=>e.eventType.startsWith('execution_')),'no execution recorded for something that never ran');
 // 5b. EXECUTE with a connected service (test double): approval of the exact details, one send, then WAIT for the school.
 const sent=[];const adapter={async perform(t,input){sent.push(input);return {ok:true,reference:'MSG-1'};},async verify(){return {confirmed:false};}};
 await requestApproval(s,SEND,NOW);assert.deepEqual(await decideApproval(s,SEND,'grant',NOW),{ok:true});
 const out=await executeAction(s,SEND,{adapter,capabilityOf:AVAILABLE,now:NOW});
 assert.equal(out.status,'accepted');assert.equal(sent.length,1);
 assert.equal(await syncState(s,task.id,'system',NOW),'awaiting_confirmation');
 c=await card(s,task.id);allSortedTooEarly||=c.kind==='all_sorted';
 // Sent is not accepted-by-the-school: the consent step is still pending until the school confirms.
 const consentStep=()=>s.get('tasks',task.id).then(t=>t.load.nodes.find(n=>n.title==='Consent').steps.find(x=>x.key==='submit'));
 assert.equal((await consentStep()).status,'pending');
 // 6. VERIFY: the school's confirmation arrives by forwarded email: real evidence, recorded against both the step and the action.
 assert.equal(await applyConfirmation(s,'Thank you for submitting the Year 5 camp consent form. Consent has been received.',NOW),'submission_confirmed');
 assert.equal((await consentStep()).status,'done');
 assert.deepEqual(await confirmExecution(s,SEND,'forwarded_email',NOW),{ok:true,already:false});
 assert.equal(await applyConfirmation(s,'We have received your payment of $180 for the Year 5 camp. Thank you.',NOW),'payment_confirmed');
 // 7. CONTINUE: still not "all sorted": packing and the camp itself aren't done.
 c=await card(s,task.id);allSortedTooEarly||=c.kind==='all_sorted';assert.equal(c.kind,'on_it');
 await syncState(s,task.id,'system',NOW);
 // The person ticks "packed" (their one real job left).
 const packStep=(await s.get('tasks',task.id)).load.nodes[0].steps.find(x=>x.key==='pack');await actOnLoad(s,task.id,{stepId:packStep.id},NOW);
 c=await card(s,task.id);allSortedTooEarly||=c.kind==='all_sorted';
 // 8. COMPLETE: only after the camp has happened, with evidence.
 await readLoad(s,await s.get('tasks',task.id),AFTER);
 c=await card(s,task.id,AFTER);assert.equal(c.kind,'all_sorted');assert.match(c.evidence,/You confirmed it/);
 assert.equal(allSortedTooEarly,false,'“All sorted” never appeared before completion');
 // The record tells the true story, minimal and in order, and never holds the notice text.
 const ev=await history(s,task.id);const blob=JSON.stringify(ev);for(const leak of ['oakhill','consent-lily','Year 5','Lily','$180','18000'])assert.ok(!blob.includes(leak),leak);
 assert.equal(ev[ev.length-1].nextState,'verified');
 // USER EFFORT: what the person actually had to do for this responsibility.
 const decisions=ev.filter(e=>e.actor==='user'&&['approval_granted','approval_declined'].includes(e.eventType)).length+1/* shared the notice */+1/* ticked packed */;
 assert.ok(decisions<=3,`the person made ${decisions} decisions`);
 }finally{delete process.env.BEAR_EXECUTION_ENABLED;}
});

test('realistic failures: a lost reply never becomes "done", never repeats the send, and puts the person in charge',async()=>{
 process.env.BEAR_EXECUTION_ENABLED='on';
 try{
 const s=await setup();const {extraction}=await createCapture(s,null,{method:'email',text:NOTICE,referenceYear:2026});const task=(await maybeAutoSetup(s,extraction,NOW)).task;
 const SEND={responsibilityId:task.id,actionType:'send_message',details:{to:'office@oakhill.example',attachment:'consent-lily.pdf'}};
 await requestApproval(s,SEND,NOW);await decideApproval(s,SEND,'grant',NOW);
 let calls=0;const hang={async perform(){calls++;await new Promise(()=>{});}};
 const out=await executeAction(s,SEND,{adapter:hang,capabilityOf:AVAILABLE,now:NOW,timeoutMs:20});assert.equal(out.status,'unknown_outcome');
 assert.equal(await syncState(s,task.id,'system',NOW),'failed');
 let c=await card(s,task.id);assert.equal(c.kind,'need_you');assert.match(c.lines[0],/didn’t go through/);assert.match(c.action.label,/See what happened/);
 const again=await executeAction(s,SEND,{adapter:hang,capabilityOf:AVAILABLE,now:NOW,timeoutMs:20});assert.equal(again.status,'unknown_outcome');assert.equal(calls,1,'not sent twice');
 assert.equal((await s.get('tasks',task.id)).status,'open');
 // A changed recipient is a different action: it needs its own approval.
 const other={...SEND,details:{...SEND.details,to:'someone-else@example.com'}};assert.equal((await executeAction(s,other,{adapter:hang,capabilityOf:AVAILABLE,now:NOW})).status,'needs_approval');assert.notEqual(idempotencyKey(other),idempotencyKey(SEND));
 }finally{delete process.env.BEAR_EXECUTION_ENABLED;}
});

test('another household’s approvals and log are never visible or usable',async()=>{
 const a=await setup();const b=new MemoryBackend().for('17171717-1717-4171-8171-171717171717');await ensureProfile(b);
 const REQ={responsibilityId:'bbbbbbbb-1616-4161-8161-bbbbbbbbbbbb',actionType:'send_message',details:{to:'x@y.z'}};
 await requestApproval(a,REQ,NOW);await decideApproval(a,REQ,'grant',NOW);
 const out=await executeAction(b,REQ,{adapter:{async perform(){throw new Error('must not be called');}},capabilityOf:AVAILABLE,now:NOW});assert.equal(out.status,'needs_approval','A’s approval means nothing to B');
});
