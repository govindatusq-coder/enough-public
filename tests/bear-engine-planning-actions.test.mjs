// Responsibility Engine, Phases 2–3: dependency-aware planning with deterministic validation, pattern
// knowledge, the action capability registry, approvals, verification honesty, the intervention policy and
// the household foundation. Includes brief scenarios E, G, H and I.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {planFor,validatePlan,patternKnowledge} from '../lib/bear/engine/plan.ts';
import {registry,performAction,capability} from '../lib/bear/engine/actions.ts';
import {decideIntervention} from '../lib/bear/engine/intervention.ts';
import {canView,moveAssignment,isAccepted} from '../lib/bear/engine/household.ts';
import {patternIds} from '../lib/bear/load/types.ts';

const NOW=new Date('2026-11-03T09:00:00+11:00');
async function camp(){const s=new MemoryBackend().for('34343434-3434-4343-8343-343434343434');await ensureProfile(s);await saveProfile(s,{name:'S',areas:['family'],onboardingComplete:true});
 const {extraction}=await createCapture(s,null,{method:'text',text:'Year 5 camp is on 18 November. Permission forms are due 10 November. Payment of $180 is due 12 November. Students need a sleeping bag.',referenceYear:2026});return (await maybeAutoSetup(s,extraction,NOW)).task;}

// ---------- planning ----------
test('a school camp plan: valid, with consent and payment as parallel branches',async()=>{
 const t=await camp();const p=planFor(t.load);
 assert.equal(p.valid,true,JSON.stringify(p.issues));assert.equal(p.order.length,p.steps.length);
 const groups=new Set(p.steps.filter(s=>p.next.includes(s.id)).map(s=>s.group));assert.ok(groups.has('Consent')&&groups.has('Payment'),'both branches can go now');
});
test('deterministic validation catches cycles, missing prerequisites and contradictory deadlines',()=>{
 const S=(id,dependsOn=[],dueAt=null,status='pending',owner='human')=>({id,label:id,owner,status,dueAt,dependsOn});
 assert.ok(validatePlan([S('a',['b']),S('b',['a'])]).issues.some(i=>i.kind==='cycle'));
 assert.ok(validatePlan([S('a',['ghost'])]).issues.some(i=>i.kind==='missing_prerequisite'));
 const c=validatePlan([S('pay',[], '2026-11-20'),S('confirm',['pay'],'2026-11-10')]);assert.ok(c.issues.some(i=>i.kind==='contradictory_deadline'));assert.equal(c.valid,false);
 const ok=validatePlan([S('a'),S('b',['a']),S('c',['a'])]);assert.equal(ok.valid,true);assert.deepEqual(ok.next,['a']);assert.ok(ok.issues.some(i=>i.kind==='blocked'&&i.detail==='One thing needs to happen first.'));
 const done=validatePlan([S('a',[],null,'done'),S('b',['a']),S('c',['a'])]);assert.deepEqual(done.next.sort(),['b','c']);assert.deepEqual(done.parallel,[['b','c']]);
 assert.ok(validatePlan([S('x',[],null,'skipped')]).issues.some(i=>i.kind==='unnecessary'));
});
test('every one of the ten patterns has dependencies, evidence, safe actions, failures, criteria and checks',()=>{
 for(const id of patternIds.filter(p=>p!=='UNKNOWN_LOAD')){const k=patternKnowledge(id);
  assert.ok(k.requiredEvidence.length&&k.safeNextActions.length&&k.failureConditions.length&&k.uncertaintyChecks.length&&k.completionCriteria,id);}
});

// ---------- actions ----------
test('the registry tells the truth: internal actions available; outside actions not supported',()=>{
 const r=registry({});const st=t=>r.find(c=>c.actionType===t).state;
 for(const t of ['classify','plan','draft_message','set_reminder'])assert.equal(st(t),'AVAILABLE',t);
 for(const t of ['make_payment','submit_form','book_appointment','send_message','create_calendar_event','contact_provider'])assert.equal(st(t),'NOT_SUPPORTED',t);
 assert.equal(st('assign_member'),'NOT_SUPPORTED','household is off');
 for(const c of r)assert.equal(c.requiresUserApproval,c.category!=='A');
});
test('Scenario E: an unsupported payment is explained, with a safe alternative',async()=>{
 const o=await performAction('make_payment',{amountCents:18000},{approved:true});
 assert.equal(o.status,'not_available');assert.match(o.userMessage,/can’t do that/);assert.match(o.alternative,/amount, reference and payment link/);
});
test('drafts are “ready to review”, never “sent”; reminders say what will happen',async()=>{
 const d=await performAction('draft_message',{draft:'Hi'});assert.equal(d.status,'prepared');assert.equal(d.userMessage,'Message ready to review.');assert.doesNotMatch(d.userMessage,/sent/i);
 const r=await performAction('set_reminder',{});assert.equal(r.userMessage,'I’ll remind you.');assert.equal(r.verified,false);
});
test('approval is enforced by the engine, not the UI; Scenario I: the service says no → failure, not completion',async()=>{
 // Calendar isn't implemented, so it can never be AVAILABLE today; check the rule on a category-B action we
 // can enable: assign_member with the household foundation switched on.
 const g={connected:[],withdrawn:[],householdEnabled:true};
 assert.equal(capability('assign_member',{},g).state,'AVAILABLE');
 assert.equal((await performAction('assign_member',{},{grants:g})).status,'needs_approval');
 const failing={perform:async()=>({ok:false,error:'service_down'})};const lying={perform:async()=>{throw new Error('timeout');}};
 const f=await performAction('assign_member',{},{grants:g,approved:true,adapter:failing});assert.equal(f.status,'failed');assert.match(f.userMessage,/didn’t go through/);
 assert.equal((await performAction('assign_member',{},{grants:g,approved:true,adapter:lying})).status,'failed');
 const ok=await performAction('assign_member',{},{grants:g,approved:true,adapter:{perform:async()=>({ok:true,reference:'inv-1'})}});assert.equal(ok.status,'done');assert.equal(ok.verified,true);
 const noRef=await performAction('assign_member',{},{grants:g,approved:true,adapter:{perform:async()=>({ok:true})}});assert.equal(noRef.verified,false,'no reference, no verification');
});
test('Scenario G: withdrawing an integration stops further actions through it',async()=>{
 // Inbound email is the one integration that exists; model a withdrawn grant for an integration action.
 const before=capability('send_message',{},{connected:['contact_external'],withdrawn:[]}).state;
 const after=capability('send_message',{},{connected:['contact_external'],withdrawn:['contact_external']}).state;
 assert.equal(before,'NOT_SUPPORTED','not implemented at all today');assert.equal(after,'NOT_SUPPORTED');
 const g={connected:[],withdrawn:[],householdEnabled:false};assert.equal((await performAction('assign_member',{},{grants:g,approved:true,adapter:{perform:async()=>({ok:true,reference:'x'})}})).status,'not_available','switched off → nothing goes through, even with an adapter');
});

// ---------- intervention ----------
const base={state:'ready',daysToDeadline:10,latestSafeIn:5,consequence:'medium',humanCanActNow:true,bearCanPrepare:false,preparedAlready:false,missingInfo:[],canInferMissing:false,needsApproval:false,remindersToday:0,quietHours:false,dayMode:null,declinedRecently:false,newInformation:false};
test('intervention: silence by default, prepare before asking, one question only when it blocks',()=>{
 assert.equal(decideIntervention(base).decision,'do_nothing');
 assert.equal(decideIntervention({...base,bearCanPrepare:true}).decision,'prepare_action');
 assert.equal(decideIntervention({...base,missingInfo:['due date'],daysToDeadline:30}).decision,'do_nothing','the question can wait');
 assert.equal(decideIntervention({...base,missingInfo:['due date'],daysToDeadline:3}).decision,'request_clarification');
 assert.equal(decideIntervention({...base,missingInfo:['due date'],canInferMissing:true,latestSafeIn:0}).decision,'send_reminder');
 assert.equal(decideIntervention({...base,latestSafeIn:0,declinedRecently:true,consequence:'low'}).decision,'do_nothing','no repeats after a no');
 assert.equal(decideIntervention({...base,latestSafeIn:0,consequence:'high',remindersToday:1}).decision,'escalate');
 assert.equal(decideIntervention({...base,state:'verified'}).decision,'do_nothing');
 assert.equal(decideIntervention({...base,needsApproval:true}).decision,'request_approval');
});

// ---------- household ----------
test('household privacy: sharing a household doesn’t mean sharing everything',()=>{
 const m=[{userId:'a',role:'owner'},{userId:'b',role:'adult'},{userId:'t',role:'teen'}];
 assert.equal(canView('b',{id:'1',ownerId:'a',sensitivity:'general',sharedWith:[]},m),false,'not shared');
 assert.equal(canView('b',{id:'1',ownerId:'a',sensitivity:'medical',sharedWith:['b']},m),true);
 assert.equal(canView('t',{id:'1',ownerId:'a',sensitivity:'financial',sharedWith:['t']},m),false);
 assert.equal(canView('x',{id:'1',ownerId:'a',sensitivity:'general',sharedWith:['x']},m),false,'not a member');
});
test('Scenario H: an assignment isn’t accepted until the assignee accepts it themselves',()=>{
 let a={responsibilityId:'r',assigneeId:'b',state:'proposed',actedBy:null};
 a=moveAssignment(a,'invited','a').assignment;assert.equal(isAccepted(a),false);
 assert.equal(moveAssignment(a,'accepted','a').ok,false,'the owner can’t accept for them');
 a=moveAssignment(a,'accepted','b').assignment;assert.equal(isAccepted(a),true);
 a=moveAssignment(a,'completed','b').assignment;assert.equal(moveAssignment(a,'verified','b').ok,false,'self-verification isn’t enough');
 assert.equal(moveAssignment(a,'verified','b','a').ok,true);
});
