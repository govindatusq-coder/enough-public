import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ProviderError} from '../lib/bear/ai/provider.ts';
import {rhythmPresets,ensureProfile,saveProfile,setDayMode} from '../lib/bear/services/profile.ts';
import {createCapture,CaptureError} from '../lib/bear/services/capture.ts';
import {confirmBill,ConfirmError} from '../lib/bear/services/task-inference.ts';
import {recommendPlan,acceptPlan} from '../lib/bear/services/reminder-planning.ts';
import {dueReminders,markDelivered,interact} from '../lib/bear/services/reminders.ts';
import {assistanceFor} from '../lib/bear/services/assistance.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {respondToSuggestion,refreshSuggestions} from '../lib/bear/services/suggestions.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {banned} from '../lib/bear/domain/copy.ts';

const USER='11111111-1111-4111-8111-111111111111';
const NOW=new Date('2026-11-10T09:00:00+11:00'); // Tuesday morning, Sydney
const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]);
const field=(value,confidence=0.95,evidence='')=>({value,confidence,evidence});
const empty=()=>({value:null,confidence:0,evidence:null});
function billOutput(overrides={}){
 return {documentType:'bill',biller:field('Energy Australia'),billerKey:'energy-australia',category:field('electricity'),amountDueCents:field(18460,0.96,'Total amount due $184.60'),currency:'AUD',
  dueDate:field('2026-11-28',0.55,'Due date 28/11/2026 ... Pay by 20/11/2026 for discount'),issueDate:field('2026-11-05'),accountReference:field('1234 5678 90'),isRecurring:field(true,0.8),expectedRecurrence:field('quarterly',0.8),
  paymentMethods:field(['bpay','card_online']),paymentUrl:field('https://www.energyaustralia.com.au/pay'),bpayBillerCode:field('3111'),bpayReference:field('123456789012'),directDebitActive:field(false,0.6),
  lateFeeCents:field(1500,0.9,'Late payment fee $15.00'),earlyDiscountCents:field(900,0.9),discountDeadline:field('2026-11-20',0.9),servicePeriodStart:field('2026-08-05'),servicePeriodEnd:field('2026-11-05'),personHint:empty(),alreadyPaid:field(false,0.9),
  candidateDates:[{label:'due',date:'2026-11-28',evidence:'Due date 28/11/2026'},{label:'discount',date:'2026-11-20',evidence:'Pay by 20/11/2026'}],
  candidateAmounts:[{label:'total_due',cents:18460,evidence:'$184.60'},{label:'discount',cents:900,evidence:'$9.00'}],notes:null,...overrides};
}
// The model returns a general understanding with the bill reading nested inside.
function modelOutput(overrides={},general={}){
 const bill=billOutput(overrides);
 return {kind:'bill',summary:'An electricity bill',title:field(`Pay ${bill.category.value||'electricity'} bill`),area:field('money'),when:bill.dueDate,timeOfDay:empty(),person:empty(),location:empty(),isRecurring:bill.isRecurring,steps:[],estimatedMinutes:2,extractedText:null,bill,...general};
}
async function onboard(store){
 await ensureProfile(store);
 return saveProfile(store,{name:'Sarah',areas:['money','family','home'],people:[{role:'me',name:'Sarah'},{role:'child',name:'Ava'}],
  pins:{preferences:{reminderLeadTime:'few_days',nudgeTolerance:'gentle',planningDetail:'a_few_steps',proactiveSuggestions:'sometimes',tone:'warm'},interests:['Family time'],needs:['Bills & money'],strengths:['Keeping calm in chaos']},
  lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},emptyMoments:['morning_scramble','dinner_bedtime'],onboardingComplete:true});
}

test('the P0 bill vertical slice works end to end',async()=>{
 const backend=new MemoryBackend();const store=backend.for(USER);
 // new user → onboarding → Areas + Life Rhythm stored
 const profile=await onboard(store);
 assert.equal(profile.onboardingComplete,true);assert.equal(profile.lifeRhythm.blocks.length,rhythmPresets.length);
 const areas=await store.list('areas');assert.deepEqual(areas.map(a=>a.key).sort(),['family','home','money']);
 assert.equal((await store.list('people')).find(p=>p.role==='child')?.name,'Ava');
 // uploads bill → extraction succeeds → uncertain field triggers verification
 const provider=new FakeProvider(()=>modelOutput());
 const {capture,extraction,document}=await createCapture(store,provider,{method:'screenshot',file:{bytes:png,mime:'image/png',name:'bill.png'}});
 assert.equal(capture.status,'needs_verification');assert.ok(document);assert.ok(document.objectKey.startsWith(USER+'/'));
 assert.equal(provider.calls[0].images.length,1);
 assert.equal(extraction.fields.amountDueCents.value,18460);assert.equal(extraction.fields.amountDueCents.source,'model');
 assert.ok(extraction.fields.dueDate.confidence<0.75,'low confidence due date');
 const q=extraction.questions.find(x=>x.field==='dueDate');assert.ok(q,'asks specifically about the due date');assert.match(q.question,/28 November 2026/);
 assert.equal((await store.list('ai_inferences')).length,1,'inference provenance stored');
 // confirming without verification is refused — never silently authoritative
 await assert.rejects(confirmBill(store,{extractionId:extraction.id,corrections:{},confirmedFields:['biller','amountDueCents'],allowDuplicate:false,forPerson:null}),e=>e instanceof ConfirmError&&e.code==='unverified_dueDate');
 // user corrects the field → bill task created
 const {bill,task,project,dependencies}=await confirmBill(store,{extractionId:extraction.id,corrections:{dueDate:'2026-11-27'},confirmedFields:['biller','amountDueCents'],allowDuplicate:false,forPerson:null});
 assert.equal(bill.fields.dueDate.value,'2026-11-27');assert.equal(bill.fields.dueDate.source,'user');assert.equal(bill.fields.dueDate.userVerified,true);
 assert.equal(project.title,'Pay November electricity bill');assert.equal(task.title,'Pay electricity bill');assert.equal(project.areaKey,'money');
 assert.deepEqual(project.resourceDocumentIds,[document.id]);
 assert.equal((await store.list('user_corrections')).length,1);
 assert.ok(dependencies.some(d=>d.kind==='confirm_discount'),'discount deadline becomes a dependency');
 // reminder recommended → accepted → scheduled
 const plan=await recommendPlan(store,bill,task,NOW);
 assert.ok(plan.suggested.when,'a time is suggested');assert.ok(plan.suggested.when>NOW.toISOString());assert.ok(plan.suggested.when.slice(0,10)<='2026-11-25','protects the deadline with lead time');
 const suggestedLocal=new Date(plan.suggested.when).toLocaleTimeString('en-AU',{hour:'numeric',hour12:false,timeZone:'Australia/Sydney'});
 assert.ok(!['6','7','8','17','18','19'].includes(suggestedLocal.replace(/^0/,'')),'avoids morning rush, dinner and bedtime: '+plan.suggested.label);
 assert.ok(plan.alternatives.some(a=>a.key==='custom'));
 const reminders=await acceptPlan(store,{billId:bill.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:true},NOW);
 assert.equal(reminders[0].status,'scheduled');assert.equal(reminders[0].scheduledFor,plan.suggested.when);
 assert.equal(reminders.length,2,'follow-up the evening before if unpaid');
 // nothing fires before its time
 assert.equal((await dueReminders(store,NOW)).length,0);
 const home0=await homeView(store,NOW);assert.equal(home0.needsYou.length,0);assert.ok(home0.handling.lines.some(l=>/1 bill being watched/.test(l)));
 // user opens reminder when it is due → Bear offers assistance
 const at=new Date(new Date(plan.suggested.when).getTime()+60000);
 const due=await dueReminders(store,at);assert.equal(due.length,1);
 assert.match(due[0].decision.message,/electricity bill is due on 2026-11-27\. Want me to help you sort it now\?/);
 assert.ok(!banned.test(due[0].decision.message));assert.ok(due[0].decision.actions.some(a=>/Pay it/.test(a.label)));
 await markDelivered(store,due[0].reminder.id,'in_app',at);
 await interact(store,{reminderId:due[0].reminder.id,action:'opened'},at);
 const assist=await assistanceFor(store,bill);
 assert.ok(assist.options.some(o=>o.key==='bpay'&&/3111/.test(o.detail)));assert.ok(assist.options.some(o=>o.key==='open_payment'));assert.ok(assist.options.some(o=>o.key==='original'));
 assert.match(assist.explanation,/\$15\.00 late fee/);
 await interact(store,{reminderId:due[0].reminder.id,action:'helped'},at);
 // user marks bill paid → task completes → Win → Wealth entry (defensible: $15 late fee avoided, $9 discount missed because paid after 20 Nov)
 const paidAt=new Date('2026-11-24T20:00:00+11:00');
 const done=await completeTask(store,{taskId:task.id,method:'bpay',expectNext:null},paidAt);
 assert.equal((await store.get('tasks',task.id)).status,'done');assert.equal((await store.get('bills',bill.id)).status,'paid');
 assert.equal(done.win.title,'Electricity bill paid');assert.match(done.win.detail,/3 days early/);assert.match(done.win.detail,/\+\$15\.00 late fee avoided/);
 assert.equal(done.ledger.length,1);assert.equal(done.ledger[0].reason,'late_fee_avoided');assert.equal(done.ledger[0].amountCents,1500);assert.equal(done.ledger[0].defensible,true);
 assert.equal((await store.list('reminders')).filter(r=>r.status==='scheduled').length,0,'remaining reminders quietly closed');
 // recurring expectation offered, then accepted
 assert.ok(done.suggestion&&done.suggestion.kind==='expect_recurring');assert.match(done.suggestion.title,/quarter/);
 await respondToSuggestion(store,{suggestionId:done.suggestion.id,response:'accept'},paidAt);
 const exp=await store.list('recurring_expectations');assert.equal(exp.length,1);assert.equal(exp[0].status,'expecting');assert.equal(exp[0].expectedFrom,'2027-02-20');assert.equal(exp[0].expectedTo,'2027-03-06');
 const wins=await winsView(store);assert.equal(wins.totals.handled,1);assert.equal(wins.totals.moneyCents,1500);
 const home=await homeView(store,paidAt);assert.equal(home.ledgers.wealth.headline,'$15.00 protected this month');
 assert.equal(home.needsYou.length,0);
});

test('no Wealth entry is invented when the bill states no fee or discount',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const provider=new FakeProvider(()=>modelOutput({biller:field('Aussie Broadband'),billerKey:'aussie-broadband',category:field('internet'),lateFeeCents:empty(),earlyDiscountCents:empty(),discountDeadline:empty(),dueDate:field('2026-11-30',0.95),candidateDates:[{label:'due',date:'2026-11-30',evidence:''}],bpayBillerCode:empty(),bpayReference:empty(),expectedRecurrence:field('monthly',0.9)}));
 const {extraction}=await createCapture(store,provider,{method:'photo',file:{bytes:png,mime:'image/png',name:'b.png'}});
 assert.equal(extraction.questions.length,0,'nothing uncertain to ask');
 const {bill,task}=await confirmBill(store,{extractionId:extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null});
 const done=await completeTask(store,{taskId:task.id,method:null,expectNext:true},NOW);
 assert.equal(done.ledger.length,0);assert.equal(done.win.amountCents,null);assert.equal(done.win.detail,'20 days early');
 assert.ok(done.expectation,'expectation created directly when the user said yes');assert.equal(done.expectation.recurrence,'monthly');
 assert.equal((await store.get('bills',bill.id)).recurringExpectationId,done.expectation.id);
});

test('missing due date, ambiguous amounts and multiple dates all force verification',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const noDate=await createCapture(store,null,{method:'text',text:'Telstra\nInternet bill\nAccount number: 4455 6677\nTotal amount due: $89.00\nBPAY Biller code: 2345 Ref: 4455667788',referenceYear:2026});
 assert.equal(noDate.extraction.fields.dueDate.value,null);assert.match(noDate.extraction.questions.find(q=>q.field==='dueDate').question,/couldn't find a due date/);
 await assert.rejects(confirmBill(store,{extractionId:noDate.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents'],allowDuplicate:false,forPerson:null}),e=>e.code==='unverified_dueDate');
 const ambiguous=await createCapture(store,null,{method:'text',text:'Optus mobile\nAmount due: $65.00\nTotal amount due: $130.00\nDue date: 15/12/2026\nPay by 10/12/2026',referenceYear:2026});
 const f=ambiguous.extraction.fields;
 assert.ok(f.amountDueCents.confidence<0.75,'two total-looking amounts');assert.ok(ambiguous.extraction.questions.some(q=>q.field==='amountDueCents'&&q.options.length>=2));
 assert.ok(f.dueDate.confidence<0.75,'two due-looking dates');assert.ok(ambiguous.extraction.questions.some(q=>q.field==='dueDate'));
 // model confident but rules disagree on amount → confidence capped
 const provider=new FakeProvider(()=>modelOutput({amountDueCents:field(9999,0.98),dueDate:field('2026-11-28',0.98),candidateDates:[],candidateAmounts:[]}));
 const mixed=await createCapture(store,provider,{method:'text',text:'Energy Australia\nTotal amount due: $184.60\nDue date: 28/11/2026',referenceYear:2026});
 assert.equal(mixed.extraction.fields.amountDueCents.value,9999);assert.ok(mixed.extraction.fields.amountDueCents.confidence<=0.6);
 assert.ok(mixed.extraction.questions.some(q=>q.field==='amountDueCents'&&q.options.some(o=>o.value===18460)),'offers the rule-based candidate');
});

test('already paid, overdue, duplicate and rejected bills are handled honestly',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const paid=await createCapture(store,null,{method:'text',text:'AGL electricity\nThank you for your payment\nAmount paid: $120.00 on 01/11/2026\nBalance due: $0.00',referenceYear:2026});
 assert.equal(paid.extraction.fields.documentType,'receipt');assert.equal(paid.extraction.fields.alreadyPaid.value,true);
 await assert.rejects(confirmBill(store,{extractionId:paid.extraction.id,corrections:{dueDate:'2026-11-20',amountDueCents:12000,biller:'AGL'},confirmedFields:[],allowDuplicate:false,forPerson:null}),e=>e.code==='already_paid');
 // overdue bill: still accepted, surfaced without guilt
 const overdue=await createCapture(store,null,{method:'text',text:'Sydney Water\nTotal amount due: $210.40\nDue date: 01/11/2026\nLate payment fee: $12.00',referenceYear:2026});
 const {bill:ob,task:ot}=await confirmBill(store,{extractionId:overdue.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null});
 const plan=await recommendPlan(store,ob,ot,NOW);assert.ok(plan.suggested.when,'still offers a time');
 await acceptPlan(store,{billId:ob.id,when:plan.suggested.when,label:plan.suggested.label,rationale:'',key:'bear',followUpIfUnpaid:true},NOW);
 const home=await homeView(store,NOW);const item=home.needsYou.find(n=>n.billId===ob.id);assert.ok(item);assert.equal(item.dueLabel,'Past the due date');assert.ok(!banned.test(JSON.stringify(home)));
 const due=await dueReminders(store,new Date(plan.suggested.when));assert.match(due[0].decision.message,/hanging around/);
 const done=await completeTask(store,{taskId:ot.id,method:null,expectNext:false},NOW);assert.equal(done.ledger.length,0,'late fee not "avoided" when paid late');
 // duplicate
 const first=await createCapture(store,null,{method:'text',text:'Telstra\nTotal amount due: $99.00\nDue date: 05/12/2026',referenceYear:2026});
 await confirmBill(store,{extractionId:first.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null});
 const second=await createCapture(store,null,{method:'text',text:'Telstra\nTotal amount due: $99.00\nDue date: 05/12/2026',referenceYear:2026});
 assert.ok(second.extraction.duplicateOfBillId);
 await assert.rejects(confirmBill(store,{extractionId:second.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null}),e=>e.code==='duplicate');
 // user rejects extraction
 const {rejectCapture}=await import('../lib/bear/services/capture.ts');
 const rejected=await rejectCapture(store,second.capture.id);assert.equal(rejected.status,'rejected');assert.equal((await store.get('extractions',second.extraction.id)).status,'rejected');
 assert.equal((await store.list('bills')).length,2);
});

test('invalid images, AI failure and network failure never produce a fake bill',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const provider=new FakeProvider(()=>new ProviderError('Bear could not reach the AI service.','network'));
 await assert.rejects(createCapture(store,provider,{method:'photo',file:{bytes:new Uint8Array([1,2,3,4,5,6,7,8,9]),mime:'image/png',name:'x.png'}}),e=>e instanceof CaptureError&&/valid picture/.test(e.message));
 await assert.rejects(createCapture(store,provider,{method:'upload',file:{bytes:png,mime:'text/plain',name:'x.txt'}}),e=>/JPEG, PNG and WebP/.test(e.message));
 await assert.rejects(createCapture(store,provider,{method:'photo',file:{bytes:png,mime:'image/png',name:'x.png'}}),e=>e instanceof CaptureError&&e.status===422&&/could not reach/.test(e.message));
 const captures=await store.list('captures');assert.equal(captures.length,1);assert.equal(captures[0].status,'failed');assert.equal((await store.list('extractions')).length,0);
 assert.equal((await store.list('ai_inferences'))[0].ok,false);
 // no provider at all → images visibly unavailable, text still works through rules
 await assert.rejects(createCapture(store,null,{method:'photo',file:{bytes:png,mime:'image/png',name:'x.png'}}),e=>e.status===503&&/AI service is connected/.test(e.message));
 const text=await createCapture(store,null,{method:'text',text:'Origin Energy\nTotal amount due: $140.00\nDue date: 02/12/2026',referenceYear:2026});
 assert.equal(text.extraction.fields.amountDueCents.source,'rules');assert.equal(text.extraction.fields.dueDate.value,'2026-12-02');
 // model fails on text → rules fallback, failure recorded
 const flaky=new FakeProvider(()=>new ProviderError('busy','rate_limited'));
 const fallback=await createCapture(store,flaky,{method:'text',text:'Origin Energy\nTotal amount due: $140.00\nDue date: 03/12/2026',referenceYear:2026});
 assert.equal(fallback.extraction.fields.dueDate.value,'2026-12-03');assert.equal(fallback.extraction.inferenceId,null);
 // schema-invalid model output on text → rules used
 const junk=new FakeProvider(()=>({nonsense:true}));
 const j=await createCapture(store,junk,{method:'text',text:'Origin Energy\nTotal amount due: $140.00\nDue date: 04/12/2026',referenceYear:2026});
 assert.equal(j.extraction.fields.dueDate.value,'2026-12-04');assert.equal((await store.list('ai_inferences')).filter(i=>i.error==='schema_invalid').length,1);
});

test('notification permission denied still surfaces reminders in-app, and Chaos mode only lets essentials through',async()=>{
 const store=new MemoryBackend().for(USER);const profile=await onboard(store);
 await saveProfile(store,{notification:{...profile.notification,permission:'denied',pushEnabled:false}});
 const far=await createCapture(store,null,{method:'text',text:'Telstra\nTotal amount due: $99.00\nDue date: 05/12/2026',referenceYear:2026});
 const {bill:fb,task:ft}=await confirmBill(store,{extractionId:far.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null});
 const when=new Date('2026-11-11T20:00:00+11:00').toISOString();
 await acceptPlan(store,{billId:fb.id,when,label:'Wednesday · 8:00 pm',rationale:'',key:'custom',followUpIfUnpaid:false},NOW);
 const near=await createCapture(store,null,{method:'text',text:'Optus\nTotal amount due: $65.00\nDue date: 12/11/2026',referenceYear:2026});
 const {bill:nb} =await confirmBill(store,{extractionId:near.extraction.id,corrections:{},confirmedFields:['biller','amountDueCents','dueDate'],allowDuplicate:false,forPerson:null});
 await acceptPlan(store,{billId:nb.id,when,label:'Wednesday · 8:00 pm',rationale:'',key:'custom',followUpIfUnpaid:false},NOW);
 const at=new Date('2026-11-11T20:05:00+11:00');
 const normal=await dueReminders(store,at);assert.equal(normal.length,2,'in-app delivery does not depend on push permission');
 await setDayMode(store,'chaos');
 // day mode is only trusted for the day it was set; set it "today" relative to `at`
 const p=await ensureProfile(store);await store.update('profiles',p.id,{dayModeSetAt:at.toISOString()});
 const chaos=await dueReminders(store,at);
 assert.equal(chaos.length,1);assert.equal(chaos[0].billId,nb.id,'only the bill due tomorrow gets through');assert.equal(chaos[0].decision.essential,true);
 assert.equal((await refreshSuggestions(store,at)).length,0,'suggestions suppressed in chaos');
 const home=await homeView(store,at);assert.equal(home.dayMode,'chaos');assert.equal(home.needsYou.length,1);
 // repeated postponement changes the plan instead of nagging
 await setDayMode(store,null);
 const r=(await dueReminders(store,at)).find(d=>d.billId===fb.id).reminder;
 await interact(store,{reminderId:r.id,action:'snoozed',when:new Date('2026-11-12T20:00:00+11:00').toISOString()},at);
 await interact(store,{reminderId:r.id,action:'snoozed',when:new Date('2026-11-13T20:00:00+11:00').toISOString()},at);
 const later=(await dueReminders(store,new Date('2026-11-13T20:05:00+11:00'))).find(d=>d.billId===fb.id);
 assert.match(later.decision.message,/Maybe the plan isn't helping/);assert.ok(later.decision.actions.some(a=>a.label==='Break it down'));
 assert.ok(!banned.test(later.decision.message));
});
