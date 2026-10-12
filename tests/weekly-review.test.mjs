import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,accept,finish,restore} from '../lib/journey.ts';
import {newPlan} from '../lib/move-support.ts';
import {validateState} from '../lib/account-validation.ts';
import {localWeek,activePlans,saveWeeklyReview} from '../lib/weekly-review.ts';
import {aiContext} from '../lib/ai-ideas.ts';
import {createAiConsent} from '../lib/ai-consent.ts';
function configured(){const s=emptyState();Object.assign(s.profile,{preferences:['Indoors'],interests:['Music'],needs:['Nothing to add'],strengths:['I keep routines'],activity:'Mostly seated',rhythms:['Calls'],window:'Daytime'});s.demo=true;return s;}
const now=new Date(2026,9,7,12);
function planned(){let s=configured();s=accept(s,1);s.entries[0].support={...newPlan(1),routineAnchor:'Calls'};return s;}
test('weeks follow device-local Monday across midnight and daylight-saving boundaries',()=>{
 const previous=process.env.TZ;try{process.env.TZ='America/New_York';assert.equal(localWeek(new Date('2026-11-02T04:30:00Z')),'2026-10-26');assert.equal(localWeek(new Date('2026-11-02T05:30:00Z')),'2026-11-02');process.env.TZ='Australia/Sydney';assert.equal(localWeek(new Date('2026-10-11T13:30:00Z')),'2026-10-12');}finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('optional routine links and plan-moment reflections preserve legacy outcomes and round-trip',()=>{
 const s=planned(),id=s.entries[0].id;for(const planMoment of [undefined,'yes','different-time','no']){const result=finish(s,id,{minutes:2,moneyCents:0,outside:false,connecting:false,worthwhile:true,planMoment});const restored=restore(JSON.stringify(validateState(result)));assert.equal(restored.entries[0].planMoment,planMoment);assert.equal(restored.entries[0].support.routineAnchor,'Calls');}
 assert.throws(()=>finish(s,id,{minutes:2,moneyCents:0,planMoment:'late'}));s.entries[0].support.routineAnchor=500;assert.throws(()=>validateState(s));assert.throws(()=>restore(JSON.stringify(s)));
});
test('keep and change preserve plans; pause retains intent and silences the in-app reminder',()=>{
 for(const choice of ['keep','change','pause']){const s=planned(),id=s.entries[0].id;s.entries[0].support.reminder='in-app';s.entries[0].support.remindAt='2026-10-01T12:00';const reviewed=saveWeeklyReview(s,{worked:'A call',barrier:'Busy',smallFix:'A shorter call',plans:[{entryId:id,choice}]},now);assert.equal(reviewed.entries[0].status,'accepted');assert.equal(activePlans(reviewed).length,choice==='pause'?0:1);assert.equal(reviewed.entries[0].support.reminderDismissed,choice==='pause'?true:undefined);assert.equal(reviewed.weeklyReviews[0].plans[0].choice,choice);assert.equal(s.weeklyReviews,undefined);}
});
test('one optional review per local week is exported and validated without missed-week records',()=>{
 const s=planned(),id=s.entries[0].id,input={worked:'PRIVATE_REVIEW',barrier:'',smallFix:'',plans:[{entryId:id,choice:'keep'}]};let reviewed=saveWeeklyReview(s,input,now);reviewed=saveWeeklyReview(reviewed,{...input,worked:'Updated'},now);assert.equal(reviewed.weeklyReviews.length,1);reviewed=saveWeeklyReview(reviewed,input,new Date(2026,9,28,12));assert.equal(reviewed.weeklyReviews.length,2);assert.equal(restore(JSON.stringify(validateState(reviewed))).weeklyReviews[1].worked,'PRIVATE_REVIEW');
 reviewed.aiConsent=createAiConsent('full');assert.equal(JSON.stringify(aiContext(reviewed,now)).includes('PRIVATE_REVIEW'),false);assert.equal(emptyState().weeklyReviews,undefined);
});
test('review validation rejects oversized notes, duplicate weeks, invalid choices and stale or forged plan references',()=>{
 const s=planned(),id=s.entries[0].id,input={worked:'',barrier:'',smallFix:'',plans:[{entryId:id,choice:'keep'}]};for(const patch of [{worked:'x'.repeat(241)},{plans:[{entryId:id,choice:'remove'}]},{plans:[{entryId:'unknown',choice:'pause'}]},{plans:[...input.plans,...input.plans]}])assert.throws(()=>saveWeeklyReview(s,{...input,...patch},now));
 const reviewed=saveWeeklyReview(s,input,now);assert.throws(()=>validateState({...reviewed,weeklyReviews:[...reviewed.weeklyReviews,...reviewed.weeklyReviews]}));assert.throws(()=>validateState({...reviewed,weeklyReviews:[{...reviewed.weeklyReviews[0],plans:[{entryId:'unknown',choice:'keep'}]}]}));s.entries[0].status='completed';assert.throws(()=>saveWeeklyReview(s,input,now));
});
