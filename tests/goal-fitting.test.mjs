process.env.TZ='UTC';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {personas,NOW} from './fixtures/personas.mjs';
import {suggestionSnapshot} from './fixtures/suggestion-snapshot.mjs';
import {rank,diversify} from '../lib/opportunity-engine.ts';
import {cardCopy} from '../lib/opportunity-copy.ts';
import {illustrationFor} from '../lib/illustrations.ts';
import {opportunityById} from '../lib/opportunities.ts';
import {recordFeedback,planMoment,resolveMoment} from '../lib/opportunity-log.ts';
import {lifeMapSchema} from '../lib/life-map.ts';
import {fitCommitment,fittingQuestion,answerFittingQuestion,confirmationLines,confirmationNote,changeCommitment,demandSensitivity,commitmentSchema} from '../lib/goal-fitting.ts';
import {decideInvitation,todaysInvitation,invitationCopy,recordCheckIn,recordReview,pendingCheckIns,checkInMode,reviewDue,longerOffer,winsLedger,learnedFacts,activeMinutesToday,notTodayLabels,otherKindLabels} from '../lib/follow-through.ts';
import {adaptiveGoalFittingV1} from '../lib/flags.ts';
import {validateState} from '../lib/account-validation.ts';
import {emptyState,restore} from '../lib/journey.ts';

const baseline=JSON.parse(readFileSync(new URL('./fixtures/suggestion-baseline.json',import.meta.url),'utf8'));
const persona=id=>personas.find(p=>p.id===id);
const withFitting=p=>({...p.lifeMap,fitting:p.fitting});
const at=(daysFromNow,hour=9)=>new Date(NOW.getTime()+daysFromNow*864e5+(hour-9)*36e5);
/** What Home shows as the best fit, as a commitment input. */
function adoptBest(p,{intent='usually',answers={}}={}){
 const map=withFitting(p),best=diversify(rank({lifeMap:map,feedback:p.feedback,moments:p.moments,now:NOW}),3)[0],copy=cardCopy(best);
 return fitCommitment({opportunityId:best.opportunity.id,matchedMoment:best.matchedMoment,lifeMap:map,intent,answers,now:NOW,id:'c-'+p.id,
  snapshot:{title:copy.title,description:copy.body,movementMinutes:copy.minutes,extraMinutes:copy.extraMinutes,imageReference:illustrationFor(best.opportunity.imageCategory,best.opportunity.imageVariant).src}});
}
const ctx=(c,extra={})=>({now:NOW,events:[],lifeMap:withFitting(persona('camera-off')),activeMinutes:0,...extra});
/** Replays check-ins for one commitment, a day apart, and returns the final parts. */
function replay(c,answers,start=-answers.length){
 let parts={commitments:[c],events:[],moments:[]};
 answers.forEach((a,i)=>{const day=at(start+i,10);parts=recordCheckIn(parts,{commitmentId:c.id,kind:'accepted',source:'invitation'},day);parts=recordCheckIn(parts,{commitmentId:c.id,source:'check-in',...a},new Date(day.getTime()+36e5));});
 return parts;
}

// ── Phase 7: the suggestion system has not changed ─────────────────────────
test('every persona gets exactly the recorded suggestions, with or without the new Life Map answers',()=>{
 for(const p of personas){
  assert.deepEqual(suggestionSnapshot(p),baseline[p.id],`${p.id}: suggestions changed`);
  assert.deepEqual(suggestionSnapshot(p,{withFitting:true}),baseline[p.id],`${p.id}: goal-fitting answers changed the suggestions`);
 }
});
test('"Depends on the day" gives the engine the same input as "A few minutes"',()=>{
 const p=persona('camera-off'),few={...p.lifeMap,extraTime:'few'},varies={...few,fitting:{extraTimeVaries:true}};
 assert.deepEqual(rank({lifeMap:varies,now:NOW}).map(r=>[r.opportunity.id,r.score,r.minutes]),rank({lifeMap:few,now:NOW}).map(r=>[r.opportunity.id,r.score,r.minutes]));
});
test('"I\'d do that" and the first check-in write the same suggestion records as before',()=>{
 const p=persona('camera-off'),best=diversify(rank({lifeMap:p.lifeMap,now:NOW}),3)[0];
 // Before: accept, then "It happened" with the minutes.
 const feedback=recordFeedback([],{opportunityId:best.opportunity.id,response:'accept',surface:'home',lifeMap:p.lifeMap,now:NOW});
 const planned=planMoment([],best.opportunity.id,best.minutes,NOW);
 const before=resolveMoment(planned,planned[0].id,true,12,at(0,13));
 // After: the same accept, a fitted commitment, then "Did it · 10 min" in the new check-in (12 typed as a custom amount here).
 const c={...adoptBest(p,{answers:{'camera-off':'yes'}}),plannedMomentId:planned[0].id};
 let parts=recordCheckIn({commitments:[c],events:[],moments:planned},{commitmentId:c.id,kind:'accepted',source:'fitting'},NOW);
 parts=recordCheckIn(parts,{commitmentId:c.id,kind:'did-it',minutes:12,source:'check-in'},at(0,13));
 assert.deepEqual(parts.moments,before);
 assert.equal(parts.events.at(-1).momentId,planned[0].id,'counted once, against the planned moment');
 // A later "Did it" leaves the suggestion records alone.
 const later=recordCheckIn(parts,{commitmentId:c.id,kind:'did-it',minutes:15,source:'check-in'},at(1,13));
 assert.deepEqual(later.moments,before);
 // And "Not today" on a fresh adoption settles it exactly like "Not this time".
 const skipped=recordCheckIn({commitments:[c],events:[],moments:planned},{commitmentId:c.id,kind:'not-today',source:'check-in'},at(0,13));
 assert.deepEqual(skipped.moments,resolveMoment(planned,planned[0].id,false));
 assert.equal(feedback.length,1);
});

// ── Core acceptance: Camera off, feet on ────────────────────────────────────
test('core acceptance: Camera off, feet on, from best fit to an adaptive usual',()=>{
 const p=persona('camera-off'),b=baseline['camera-off'].bestFit;
 assert.deepEqual([b.id,b.title,b.minutes,b.extraMinutes,b.image],['call-meeting-walk','Camera off, feet on',15,0,'/illustrations/welcome-call.webp']);
 const o=opportunityById('call-meeting-walk'),map=withFitting(p);
 assert.equal(fittingQuestion(o,map,'once'),null,'Just today asks nothing');
 const q=fittingQuestion(o,map,'usually');assert.equal(q.id,'camera-off');
 const answered=answerFittingQuestion(map,{},q.id,'yes');
 assert.deepEqual(answered.map.profiling,map.profiling,'never written into the engine’s profiling answers');
 assert.equal(fittingQuestion(o,answered.map,'usually',answered.answers),null,'asked once');
 const c=adoptBest(p,{answers:answered.answers});
 assert.equal(c.originalSuggestionSnapshot.title,'Camera off, feet on');
 assert.deepEqual([c.minimumVersion.minutes,c.usualVersion.minutes,c.optionalExpansion.description],[5,15,'Take the longer loop.']);
 assert.deepEqual(confirmationLines(c).map(l=>`${l.label}: ${l.text}`),['On a full-on day: Five minutes is enough.','Usually: Around 15 minutes.','If it feels good: Take the longer loop.']);
 assert.equal(confirmationNote(c),'We’ll only bring this up when it looks like a decent fit.');
 assert.ok(commitmentSchema.safeParse(c).success);
 // Context appropriate (a weekday, nothing logged yet): the usual.
 const ok=decideInvitation(c,ctx(c));assert.equal(ok.decision,'usual');
 assert.equal(invitationCopy(c,'usual').heading,'Camera off, feet on?');
 // Overloaded: five minutes would be plenty.
 const busy=decideInvitation(c,ctx(c,{dayLoad:{day:'2026-10-26',load:'full-on'}}));assert.equal(busy.decision,'minimum');
 assert.match(invitationCopy(c,'minimum').body,/^Five minutes would be plenty/);
 // Inappropriate: a Saturday for a weekday meeting, or already moved enough.
 assert.equal(decideInvitation(c,ctx(c,{now:new Date('2026-10-31T09:00:00Z')})).decision,'stay_quiet');
 assert.equal(decideInvitation(c,ctx(c,{activeMinutes:35})).decision,'stay_quiet');
 // Repeatedly 8–10 minutes: the usual comes down to match.
 const parts=replay(c,[{kind:'did-it',minutes:8},{kind:'did-it',minutes:10},{kind:'did-it',minutes:9}]);
 const adapted=parts.commitments[0];
 assert.equal(adapted.usualVersion.minutes,9);assert.equal(adapted.usualVersion.description,'Around 8–10 minutes.');
 assert.equal(adapted.status,'active');
 assert.equal(adapted.originalSuggestionSnapshot.movementMinutes,15,'the original suggestion is never rewritten');
 assert.deepEqual(suggestionSnapshot(p),baseline['camera-off'],'and the suggestion itself is unchanged');
});
test('a camera that has to stay on narrows the idea instead of dropping it',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'no'}});
 assert.equal(c.frequencyIntent,'sometimes');
 assert.ok(c.feasibilityConditions.includes('Only the meetings where the camera can be off'));
 assert.equal(decideInvitation(c,ctx(c)).decision,'alternative');
 assert.match(invitationCopy(c,'alternative').body,/^Stand and pace|^Walk to the end/);
});

// ── Personas ────────────────────────────────────────────────────────────────
test('1. busy working parent: zero-extra idea keeps its usual, small version ready',()=>{
 const p=persona('busy-parent'),c=adoptBest(p);
 assert.equal(baseline['busy-parent'].bestFit.title,'Lap the ground');
 assert.equal(c.usualVersion.minutes,15,'no extra time, so nothing to cut');
 assert.equal(c.minimumVersion.minutes,5);
 assert.equal(fittingQuestion(opportunityById(c.originalSuggestionId),withFitting(p),'usually'),null,'laps of the ground never leave the venue: nothing material to ask');
 assert.equal(fittingQuestion(opportunityById('kids-lesson-block'),withFitting(p),'usually')?.id,'kids-leave','an idea that leaves the venue asks whether they can step away');
 const tired=replay(c,[{kind:'not-today',reason:'too-busy'},{kind:'not-today',reason:'too-busy'}]);
 assert.equal(decideInvitation(tired.commitments[0],{now:at(0),events:tired.events,lifeMap:withFitting(p),activeMinutes:0}).decision,'minimum');
});
test('2. high demand sensitivity: gentle words, quick to back off, no penalty for no',()=>{
 const p=persona('demand-sensitive'),c=adoptBest(p);
 assert.equal(demandSensitivity(withFitting(p)),'high');assert.equal(c.demandSensitivity,'high');
 const copy=invitationCopy(c,'usual');
 assert.match(copy.heading,/if you feel like it/);assert.match(copy.body,/only if you fancy it/);
 assert.deepEqual([copy.yes,copy.no],['Yep','Not today']);
 const no=replay(c,[{kind:'not-today'},{kind:'not-today'},{kind:'not-today'},{kind:'not-today'}]);
 assert.equal(decideInvitation(no.commitments[0],{now:at(0),events:no.events,lifeMap:withFitting(p),activeMinutes:0}).decision,'stay_quiet');
 assert.equal(no.commitments[0].usualVersion.minutes,c.usualVersion.minutes,'declining never changes the plan as a penalty');
});
test('3. low-energy user: tiny usual, a minute counts',()=>{
 const c=adoptBest(persona('low-energy'));
 assert.ok(c.usualVersion.minutes<=5);assert.ok(c.minimumVersion.minutes<=2);
 assert.match(c.minimumVersion.description,/minute/);
});
test('4. physical constraints: shorter usual, no stretch version, gentle fallback',()=>{
 const p=persona('physical'),c=adoptBest(p),suggested=c.originalSuggestionSnapshot.movementMinutes;
 assert.ok(c.usualVersion.minutes<suggested,`usual ${c.usualVersion.minutes} below ${suggested}`);
 assert.equal(c.optionalExpansion,undefined);
 assert.ok(c.fallbackOptions.some(f=>/change position/.test(f)));
 assert.ok(c.abortConditions.some(a=>/sore/.test(a)));
});
test('5. financially constrained: nothing that costs money',()=>{
 const c=adoptBest(persona('cost-constrained'));
 const words=JSON.stringify([c.fallbackOptions,c.feasibilityConditions,c.optionalExpansion,confirmationLines(c),invitationCopy(c,'usual'),invitationCopy(c,'alternative')]);
 assert.doesNotMatch(words,/\b(buy|pay|paid|membership|class|gym|\$)/i);
 assert.equal(demandSensitivity(withFitting(persona('cost-constrained'))),'low');
});
test('6. shift worker: weekday moments can happen any day',()=>{
 const desk={...adoptBest(persona('camera-off')),anchor:{type:'long-desk',description:'Long stretches at your desk'}};
 const sunday=new Date('2026-11-01T09:00:00Z');
 assert.equal(decideInvitation(desk,{now:sunday,events:[],lifeMap:withFitting(persona('camera-off')),activeMinutes:0}).decision,'stay_quiet');
 assert.notEqual(decideInvitation(desk,{now:sunday,events:[],lifeMap:withFitting(persona('shift-worker')),activeMinutes:0}).decision,'stay_quiet');
});
test('7. already active today: Enough stays quiet',()=>{
 const p=persona('already-active'),c=adoptBest(p);
 const moments=[{id:'m',opportunityId:'call-meeting-walk',status:'done',plannedAt:at(0,7).toISOString(),doneAt:at(0,8).toISOString(),minutes:20,extraMinutes:0}];
 const events=[{id:'e',commitmentId:'other',kind:'something-else',at:at(0,8).toISOString(),day:'2026-10-26',source:'check-in',minutes:15,other:'walk'}];
 const active=activeMinutesToday(moments,events,NOW);assert.equal(active,35);
 assert.deepEqual(decideInvitation(c,{now:NOW,events:[],lifeMap:withFitting(p),activeMinutes:active}),{decision:'stay_quiet',reason:'already-active'});
 assert.equal(todaysInvitation([c],{now:NOW,events:[],lifeMap:withFitting(p),activeMinutes:active}),null);
});
test('8. repeatedly shorter: the usual adapts down, the small version stays smaller',()=>{
 const c=adoptBest(persona('shorter'),{answers:{'camera-off':'yes'}});
 const parts=replay(c,[{kind:'did-it',minutes:5},{kind:'did-it',minutes:10},{kind:'did-it',minutes:5},{kind:'did-it',minutes:10}]);
 const a=parts.commitments[0];
 assert.ok(a.usualVersion.minutes<15&&a.usualVersion.minutes>=5);
 assert.ok(a.minimumVersion.minutes<a.usualVersion.minutes||a.usualVersion.minutes<=2);
 assert.equal(a.adaptations.at(-1).kind,'usual-down');
 assert.match(learnedFacts(parts.commitments,parts.events)[0],/^Camera off, feet on: your usual is more like/);
});
test('9. consistently declining: spacing, then quiet, then "Still worth suggesting?"',()=>{
 const p=persona('declining'),c=adoptBest(p,{answers:{'camera-off':'yes'}});
 const three=replay(c,[{kind:'not-today'},{kind:'not-today'},{kind:'not-today'}],-1);
 // After three no's, a gap of a few days before asking again.
 assert.equal(decideInvitation(three.commitments[0],{now:at(2,9),events:three.events,lifeMap:withFitting(p),activeMinutes:0}).reason,'spacing');
 const five=replay(c,[{kind:'not-today'},{kind:'not-today'},{kind:'not-today'},{kind:'not-today'},{kind:'not-today'}]);
 assert.equal(decideInvitation(five.commitments[0],{now:at(0),events:five.events,lifeMap:withFitting(p),activeMinutes:0}).reason,'backing-off');
 assert.equal(reviewDue(five.commitments[0],five.events,at(0)),true);
 const less=recordReview(five,c.id,'less',at(0));
 assert.equal(less.commitments[0].invite,'rarely');
 assert.equal(reviewDue(less.commitments[0],less.events,at(1)),false,'not asked again for a fortnight');
 const stop=recordReview(five,c.id,'stop',at(0));assert.equal(stop.commitments[0].status,'paused');
 assert.equal(decideInvitation(stop.commitments[0],{now:at(1),events:stop.events,lifeMap:withFitting(p),activeMinutes:0}).decision,'stay_quiet');
});
test('10. enjoys going longer: an offer, never a silent increase',()=>{
 const c=adoptBest(persona('extender'),{answers:{'camera-off':'yes'}});
 const parts=replay(c,[{kind:'did-it',minutes:25},{kind:'did-it',minutes:30},{kind:'did-it',minutes:25}]);
 assert.equal(parts.commitments[0].usualVersion.minutes,15,'not raised on its own');
 const offer=longerOffer(parts.commitments[0],parts.events);assert.equal(offer,25);
 const yes=recordReview(parts,c.id,'take-longer',at(0),offer);assert.equal(yes.commitments[0].usualVersion.minutes,25);
 const keep=recordReview(parts,c.id,'keep-usual',at(0));
 assert.equal(keep.commitments[0].usualVersion.minutes,15);assert.equal(longerOffer(keep.commitments[0],keep.events),null,'not asked again straight away');
});

// ── Follow-through mechanics ────────────────────────────────────────────────
test('no obligation rolls forward: yesterday’s no doesn’t make today bigger, and old check-ins vanish',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'yes'}});
 const no=replay(c,[{kind:'not-today'}],-1);
 assert.equal(decideInvitation(no.commitments[0],{now:at(0),events:no.events,lifeMap:withFitting(persona('camera-off')),activeMinutes:0}).decision,'usual');
 const accepted=recordCheckIn({commitments:[c],events:[],moments:[]},{commitmentId:c.id,kind:'accepted',source:'invitation'},at(-1));
 assert.equal(pendingCheckIns(accepted.commitments,accepted.events,at(0)).length,1,'still there the next day');
 assert.equal(pendingCheckIns(accepted.commitments,accepted.events,at(2)).length,0,'then quietly gone');
});
test('check-ins get lighter as Enough learns',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'yes'}});
 assert.equal(checkInMode(c,[]),'full');
 const parts=replay(c,[{kind:'did-it',minutes:15},{kind:'did-it',minutes:15},{kind:'did-it',minutes:14},{kind:'did-it',minutes:15}]);
 assert.equal(checkInMode(parts.commitments[0],parts.events),'light');
});
test('at most one invitation a day, and nothing for "Just today", paused or never',()=>{
 const p=persona('camera-off'),a=adoptBest(p,{answers:{'camera-off':'yes'}}),b={...adoptBest(persona('busy-parent')),id:'b'};
 const pick=todaysInvitation([a,b],ctx(a));assert.ok(pick);
 assert.equal(decideInvitation({...a,invite:'never'},ctx(a)).decision,'stay_quiet');
 assert.equal(decideInvitation({...a,status:'paused'},ctx(a)).decision,'stay_quiet');
 assert.equal(decideInvitation({...a,frequencyIntent:'once'},ctx(a)).decision,'stay_quiet');
 const sometimes={...a,frequencyIntent:'sometimes'},yesterday=recordCheckIn({commitments:[sometimes],events:[],moments:[]},{commitmentId:a.id,kind:'accepted',source:'invitation'},at(-1));
 assert.equal(decideInvitation(sometimes,{...ctx(a),events:yesterday.events}).reason,'spacing','"Sometimes" is offered every other day at most');
});
test('changes are the person’s own and learning respects them',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'yes'}});
 const changed=changeCommitment(c,{usual:20,invite:'rarely'},at(-5));
 assert.deepEqual([changed.usualVersion.minutes,changed.invite,changed.adaptations.at(-1).kind],[20,'rarely','person-changed']);
 const parts=replay(changed,[{kind:'did-it',minutes:20},{kind:'did-it',minutes:18}]);
 assert.equal(parts.commitments[0].usualVersion.minutes,20);
});
test('My Wins: movement, extra time and opportunities used, each counted once',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'yes'}});
 const planned=planMoment([],'call-meeting-walk',15,at(-2));
 let parts={commitments:[{...c,plannedMomentId:planned[0].id}],events:[],moments:planned};
 parts=recordCheckIn(parts,{commitmentId:c.id,kind:'did-it',minutes:15,source:'check-in'},at(-2,12));
 parts=recordCheckIn(parts,{commitmentId:c.id,kind:'did-it',minutes:12,source:'check-in'},at(-1,12));
 parts=recordCheckIn(parts,{commitmentId:c.id,kind:'something-else',minutes:10,other:'walk',source:'check-in'},at(0,8));
 const w=winsLedger({...parts,since:new Date('2026-10-19T00:00:00Z'),now:NOW});
 assert.deepEqual(w.lines.map(l=>[l.title,l.minutes,l.times]),[['Camera off, feet on',27,2],['A walk',10,1]]);
 assert.deepEqual([w.movement,w.extra,w.used,w.insideExisting],[37,0,3,37]);
});

// ── Words ───────────────────────────────────────────────────────────────────
test('follow-through words carry no pressure: no streaks, debts, goals or catch-up',()=>{
 const pressure=/\b(streak|behind|overdue|goal|target|missed|failed?|complete your|time for your|don.?t break|make up|catch up|owe|deadline|workout|must|should have)\b/i;
 const texts=[];
 for(const p of personas){
  const c=adoptBest(p,{answers:{'camera-off':'yes'}});
  for(const d of ['usual','minimum','alternative'])for(const s of ['low','medium','high']){const x=invitationCopy({...c,demandSensitivity:s},d);texts.push(x.heading,x.body,x.yes,x.no);}
  texts.push(...confirmationLines(c).map(l=>l.label+' '+l.text),confirmationNote(c),...(c.fallbackOptions||[]),...(c.feasibilityConditions||[]),...(c.abortConditions||[]));
 }
 texts.push(...Object.values(notTodayLabels),...Object.values(otherKindLabels));
 for(const t of texts)assert.doesNotMatch(t,pressure,t);
 const component=readFileSync(new URL('../components/life-map/follow-through.tsx',import.meta.url),'utf8')+readFileSync(new URL('../components/life-map/goal-fitting-flow.tsx',import.meta.url),'utf8');
 for(const quoted of component.match(/>([^<>{}]{4,})</g)||[])assert.doesNotMatch(quoted,pressure,quoted);
});

// ── Persistence and the flag ────────────────────────────────────────────────
test('new state is validated on the server and in the browser, and old state still loads',()=>{
 const c=adoptBest(persona('camera-off'),{answers:{'camera-off':'yes'}});
 const parts=replay(c,[{kind:'did-it',minutes:12},{kind:'something-else',minutes:10,other:'walk'}]);
 const s={...emptyState(),lifeMap:withFitting(persona('camera-off')),commitments:parts.commitments,followThrough:parts.events,dayLoad:{day:'2026-10-26',load:'full-on'}};
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))).commitments,parts.commitments);
 assert.deepEqual(restore(JSON.stringify(s)).followThrough,parts.events);
 assert.ok(lifeMapSchema.safeParse(s.lifeMap).success);
 assert.throws(()=>validateState({...s,commitments:[{...c,originalSuggestionId:'made-up'}]}));
 assert.throws(()=>validateState({...s,followThrough:[{...parts.events[0],minutes:999}]}));
 assert.throws(()=>validateState({...s,lifeMap:{...s.lifeMap,fitting:{goalFeel:'furious'}}}));
 const old={...emptyState(),lifeMap:persona('camera-off').lifeMap};
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(old))).lifeMap,old.lifeMap);
});
test('adaptiveGoalFittingV1 is on by default, off by environment, and overridable per browser',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(adaptiveGoalFittingV1(undefined),true);
 assert.equal(adaptiveGoalFittingV1('off'),false);
 assert.equal(adaptiveGoalFittingV1(undefined,'?adaptiveGoalFittingV1=off',storage),false);
 assert.equal(adaptiveGoalFittingV1(undefined,'',storage),false,'remembered');
 assert.equal(adaptiveGoalFittingV1('off','?adaptiveGoalFittingV1=on',storage),true);
});
