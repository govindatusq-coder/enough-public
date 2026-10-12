import {createAiConsent} from '../lib/ai-consent.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,restore} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {aiContext} from '../lib/ai-ideas.ts';
import {accountSnapshot,mergeIdeas,historyPage,freshFirst} from '../lib/suggestion-history.ts';
import {generateFreshCandidates,SuggestionBusy,withSuggestionRequest} from '../lib/suggestion-service.ts';

const now=new Date(2026,9,11,12);
const idea=n=>({id:1000+n,key:'ai-'+n,title:'Useful moment '+n,category:'chores',usual:'Leave the small task until later.',body:'Sort the family cards at a comfortable seated table.',minutes:10,extraMin:0,moneyCents:0,moneySource:'none',enjoy:['Learning'],outdoor:false,effort:'gentle',exclude:[],safety:'Stay within your comfort.',social:false,output:'Cards sorted',family:'family cards',mechanism:'combine',movementMode:'seated',source:'ai',brief:'Enjoy a useful pause. Feel ready. A tidy table.'});
const candidate=n=>({intensity:'light',breaksSitting:false,title:'Fresh useful moment '+n,hook:'A useful pause.',category:'chores',lifeAnchor:'routine',mechanism:'combine',family:'family cards',counterfactual:'Leave the small task until later.',suggestion:'Reach your arms comfortably across the table for one minute during the familiar pause.',movementMode:'seated',movementAction:'Reach your arms comfortably across the table for one minute during the familiar pause.',activityMinutes:10,socialConfiguration:'alone',outdoor:false,effort:'gentle',movementMinutes:1,extraMinutes:0,money:0,moneySource:'none',output:'Cards sorted',whyThisFits:'A useful seated moment.',fitLabel:'A gentle option',safety:'Stay within your comfort.',fitScore:8,feasibilityScore:8,discoveryScore:8,predictedWorthIt:8,enjoy:['Learning'],brief:{experienceBeingSold:'A useful moment',desiredEmotion:'Ready',reward:'A tidy table',rewardShown:'The cards sorted on a table',activity:'Sorting cards',socialContext:'Alone',setting:'Home',timeOfDay:'Day'}});
function profile(){const s=emptyState();s.aiConsent=createAiConsent('full');Object.assign(s.profile,{preferences:['Indoors'],interests:['Audiobooks'],needs:['Physical comfort / accessibility'],strengths:['I enjoy learning'],activity:'Mostly seated',rhythms:['Family'],window:'It varies'});return s;}

test('more than 100 suggestions remain browsable while cloud snapshots preserve every referenced idea',()=>{
 const state=profile();state.generated=Array.from({length:350},(_,n)=>idea(n+1));state.saved=[1001];
 state.entries=[{id:'older-plan',ideaId:1002,status:'accepted',acceptedAt:now.toISOString(),currency:'AUD'}];
 state.costs=[{ideaId:1003,currency:'AUD',usualCents:300,moveCents:100,updatedAt:now.toISOString()}];
 const snapshot=accountSnapshot(state);
 assert.equal(state.generated.length,350);assert.equal(snapshot.generated.length,103);
 assert.deepEqual(snapshot.generated.slice(0,3).map(i=>i.id),[1001,1002,1003]);
 assert.deepEqual(snapshot.generated.slice(-100),state.generated.slice(-100));
 assert.equal(restore(JSON.stringify(validateState(snapshot))).entries[0].ideaId,1002);
 assert.equal(validateState(state).generated.length,350);
});
test('over 100 bookmarked ideas survive new batches and restore without orphaned references',()=>{
 const state=profile();state.generated=Array.from({length:350},(_,n)=>idea(n+1));state.saved=state.generated.slice(0,120).map(i=>i.id);
 const restored=restore(JSON.stringify(validateState(accountSnapshot(state))));
 assert.equal(restored.generated.length,220);assert.equal(restored.saved.length,120);
 assert.ok(restored.saved.every(id=>restored.generated.some(i=>i.id===id)));
});
test('loading old history neither drops newer suggestions nor expands an unchanged cloud snapshot',()=>{
 const state=profile();state.generated=Array.from({length:100},(_,n)=>idea(201+n));
 const older=Array.from({length:220},(_,n)=>idea(n+1));
 const merged={...state,generated:mergeIdeas(older,state.generated)};
 assert.equal(merged.generated.length,300);assert.deepEqual(accountSnapshot(merged),state);
});
test('cursor pages reconstruct all history in order without repeats or dropped page boundaries',()=>{
 const rows=Array.from({length:130},(_,n)=>({sequence:n+1,idea_json:idea(n+1)})).reverse();
 const first=historyPage(rows.slice(0,101),100);assert.equal(first.nextCursor,'31');assert.equal(first.hasMore,true);
 const next=historyPage(rows.filter(r=>r.sequence<Number(first.nextCursor)),32);
 assert.equal(next.hasMore,false);assert.equal(next.nextCursor,null);
 assert.deepEqual(mergeIdeas(next.ideas,first.ideas).map(i=>i.id),Array.from({length:130},(_,n)=>1001+n));
 assert.deepEqual(historyPage([],32),{ideas:[],hasMore:false,nextCursor:null});
});
test('new requested batches appear first while earlier cards remain available',()=>{
 const ideas=[idea(1),idea(2),idea(3),idea(4)];
 assert.deepEqual(freshFirst(ideas,[1004,1003]).map(i=>i.id),[1004,1003,1001,1002]);
 assert.deepEqual(ideas.map(i=>i.id),[1001,1002,1003,1004]);
});
test('six and later sequential requests keep returning distinct eligible suggestions on the same day',async()=>{
 const state=profile();let active=null,begins=0,ends=0;
 const begin=async id=>{if(active)return false;active=id;begins++;return true;};
 const end=async id=>{assert.equal(id,active);active=null;ends++;};
 for(let n=1;n<=12;n++){
  const ideas=await withSuggestionRequest(begin,end,()=>generateFreshCandidates(state,now,async()=>({candidates:[candidate(n)]}),async items=>items));
  assert.equal(ideas.length,1);assert.equal(ideas[0].movementMode,'seated');
  state.generated=mergeIdeas(state.generated||[],ideas);
 }
 assert.equal(state.generated.length,12);assert.equal(begins,12);assert.equal(ends,12);assert.equal(active,null);
});
test('overlapping requests cannot invoke generation; completion makes the next request available',async()=>{
 let active=null,release;const barrier=new Promise(resolve=>release=resolve);let calls=0;
 const begin=async id=>{if(active)return false;active=id;return true;};
 const end=async id=>{assert.equal(active,id);active=null;};
 const first=withSuggestionRequest(begin,end,async()=>{calls++;await barrier;return 'first';});
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(withSuggestionRequest(begin,end,async()=>{calls++;}),SuggestionBusy);
 assert.equal(calls,1);release();assert.equal(await first,'first');
 assert.equal(await withSuggestionRequest(begin,end,async()=>{calls++;return 'next';}),'next');assert.equal(calls,2);
});
test('a provider failure releases the request guard so the user can retry immediately',async()=>{
 let active=null;const begin=async id=>{if(active)return false;active=id;return true;};const end=async id=>{assert.equal(id,active);active=null;};
 await assert.rejects(withSuggestionRequest(begin,end,async()=>{throw Error('provider unavailable');}),/provider unavailable/);
 assert.equal(active,null);assert.equal(await withSuggestionRequest(begin,end,async()=>42),42);
});
test('an all-duplicate batch retries once with different directions, then preserves new unique ideas',async()=>{
 const state=profile();let calls=0,accepted=0;
 const ideas=await generateFreshCandidates(state,now,async context=>{calls++;assert.equal(context.attempt,calls);if(calls===2)assert.deepEqual(context.previousAttemptTitles,['Fresh useful moment 1']);return {candidates:[candidate(calls)]};},async items=>{accepted++;return accepted===1?[]:items;});
 assert.equal(calls,2);assert.equal(ideas.length,1);assert.equal(ideas[0].title,'Fresh useful moment 2');
});
test('retrying never weakens PINS and stops after two unsafe batches',async()=>{
 const state=profile();state.profile.needs.push('Weather / heat','Low energy / tired','Not enough time');let calls=0,kept=0;
 const ideas=await generateFreshCandidates(state,now,async()=>{calls++;return {candidates:[{...candidate(calls),movementMode:'walk',outdoor:true,effort:'moderate',extraMinutes:10}]};},async items=>{kept++;return items;});
 assert.deepEqual(ideas,[]);assert.equal(calls,2);assert.equal(kept,0);
});
test('the prompt receives precise current limits and a bounded novelty context',()=>{
 const state=profile();state.profile.needs.push('Safety matters','Need recovery','Family or caring','Not enough time');state.generated=Array.from({length:350},(_,n)=>idea(n+1));
 const context=aiContext(state,new Date(2026,9,11,21));
 assert.deepEqual(context.hardLimits,{movementModes:['seated'],allowOutdoors:false,avoidOutdoorWalkingAndCycling:false,effort:'gentle',maxMovementMinutes:20,maxExtraMinutes:0,familyOnlyIfAddingTime:true});
 assert.equal(context.alreadyShown.includes('Useful moment 1'),false);assert.equal(context.alreadyShown.includes('Useful moment 350'),true);assert.ok(context.alreadyShown.length<250);
});
