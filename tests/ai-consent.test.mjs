import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,restore,localDate} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {AI_CONSENT_VERSION,createAiConsent,requireAiConsent,hasAiConsent,AiConsentRequired} from '../lib/ai-consent.ts';
import {aiContext,validateCandidates} from '../lib/ai-ideas.ts';
import {generateFreshCandidates,withSuggestionRequest} from '../lib/suggestion-service.ts';
import {createIdeasPost} from '../lib/ideas-http.ts';
import {catalogue} from '../lib/ideas.ts';
import {ideaImagePrompt} from '../lib/idea-image-spec.ts';

const now=new Date(2026,9,11,12);
function profile(choice='full'){
 const state=emptyState();
 Object.assign(state.profile,{preferences:['Indoors'],interests:['Podcasts'],needs:['Nothing to add'],strengths:['I enjoy learning'],activity:'Mostly seated',rhythms:['Calls'],window:'It varies'});
 if(choice)state.aiConsent=createAiConsent(choice,now);
 return state;
}
const action='Roll your shoulders comfortably for one minute during an existing podcast pause.';
function candidate(title='A familiar podcast pause',patch={}){return {title,hook:'Keep listening.',category:'listen',lifeAnchor:'Podcast',mechanism:'combine',family:'listening pause',counterfactual:'Listen while sitting still.',suggestion:action,movementMode:'seated',movementAction:action,activityMinutes:10,socialConfiguration:'alone',outdoor:false,effort:'gentle',movementMinutes:1,extraMinutes:0,money:0,moneySource:'none',output:'',whyThisFits:'A familiar pause.',fitLabel:'A gentle option',safety:'Use familiar comfortable movements.',fitScore:8,feasibilityScore:8,discoveryScore:8,predictedWorthIt:8,enjoy:['Podcasts'],brief:{experienceBeingSold:'Enjoy the story',desiredEmotion:'At ease',reward:'A pleasant pause',rewardShown:'A familiar chair and podcast',activity:action,socialContext:'Alone',setting:'Home',timeOfDay:'Day'},...patch};}
const request=(body={},origin='https://enough.example')=>new Request('https://enough.example/api/ideas',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
function harness(state,patch={}){
 const calls={requests:0,ended:0,history:0,generated:[],kept:[],pictures:[]};let active=false;
 const deps={authenticated:true,available:true,readAccount:async()=>({state_json:state,revision:7}),readConsent:async()=>state.aiConsent,
  recentIdeas:async()=>{calls.history++;return state.generated||[];},now:()=>now,
  withRequest:work=>withSuggestionRequest(async()=>{calls.requests++;if(active)return false;active=true;return true;},async()=>{active=false;calls.ended++;},work),
  generate:async context=>{calls.generated.push(context);return {candidates:[candidate()]};},
  keep:async ideas=>{calls.kept.push(...ideas);return ideas;},
  pictures:async(ideas,previous,checkConsent)=>{await checkConsent();calls.pictures.push({ideas,previous});return {ready:ideas.length+previous.length,errors:[]};},
  ...patch};
 return {post:createIdeasPost(deps),calls,deps};
}

test('legacy account and preview data remain intact and acquire no AI permission',()=>{
 const state=profile(null);state.saved=[0];
 assert.deepEqual(validateState(state),{...state,profile:{...state.profile,complete:true}});
 const restored=restore(JSON.stringify(state));assert.deepEqual(restored.saved,[0]);assert.equal(restored.aiConsent,undefined);assert.equal(hasAiConsent(restored.aiConsent),false);
});
test('all three decisions survive cloud validation, preview restore and JSON export with version and timestamp',()=>{
 for(const choice of ['full','without-health','declined']){
  const state=profile(choice),restored=restore(JSON.stringify(validateState(state)));
  assert.deepEqual(restored.aiConsent,{choice,version:AI_CONSENT_VERSION,decidedAt:now.toISOString()});
  assert.equal(hasAiConsent(restored.aiConsent),choice!=='declined');
 }
});
test('malformed decisions fail validation and stale versions never authorise a provider request',()=>{
 const valid=createAiConsent('full',now);
 for(const bad of [null,true,{}, {...valid,choice:'yes'},{...valid,version:0},{...valid,version:1.5},{...valid,decidedAt:'yesterday'},{...valid,decidedAt:''},{...valid,extra:true}]){
  assert.throws(()=>validateState({...profile(),aiConsent:bad}));
  assert.throws(()=>restore(JSON.stringify({...profile(),aiConsent:bad})));
  assert.throws(()=>requireAiConsent(bad),AiConsentRequired);
 }
 const future={...valid,version:AI_CONSENT_VERSION+1};assert.deepEqual(validateState({...profile(),aiConsent:future}).aiConsent,future);assert.equal(hasAiConsent(future),false);
});
test('the HTTP and generation boundaries refuse missing, declined or stale consent before any reservation or provider call',async()=>{
 for(const consent of [undefined,createAiConsent('declined',now),{...createAiConsent('full',now),version:AI_CONSENT_VERSION+1}]){
  const state=profile(null);if(consent)state.aiConsent=consent;
  const {post,calls}=harness(state);const response=await post(request({aiConsent:createAiConsent('full',now)}));
  assert.equal(response.status,409);assert.equal((await response.json()).consentRequired,true);
  assert.equal(calls.requests,0);assert.equal(calls.history,0);assert.equal(calls.generated.length,0);assert.equal(calls.pictures.length,0);assert.equal(calls.kept.length,0);
  assert.throws(()=>aiContext(state,now),AiConsentRequired);
  await assert.rejects(generateFreshCandidates(state,now,async()=>{assert.fail('Unconsented generation');},async ideas=>ideas),AiConsentRequired);
 }
});
test('sign-in and same-origin protections precede account and consent access',async()=>{
 for(const [authenticated,origin,status] of [[false,'https://enough.example',401],[true,'https://other.example',403]]){
  const {post}=harness(profile(),{authenticated,readAccount:async()=>{assert.fail('Unauthorised account lookup');}});
  assert.equal((await post(request({},origin))).status,status);
 }
 assert.equal((await harness(profile(),{readAccount:async()=>null}).post(request())).status,409);
});
test('reduced context carries only approved non-health data, with no health-derived limits or free text',()=>{
 const state=profile('without-health');state.profile.name='PRIVATE_NAME';state.profile.visual=['PRIVATE_VISUAL'];
 state.profile.needs=['Not enough time','Safety matters','Weather / heat','Pain / discomfort','Physical comfort / accessibility','Low energy / tired','Need recovery','Sleep matters','Already active at work','Something else: PRIVATE_DIAGNOSIS','Unknown PRIVATE_HEALTH'];
 state.profile.preferences.push('Something else: PRIVATE_PREFERENCE');state.profile.interests.push('PRIVATE_INTEREST');state.profile.strengths.push('PRIVATE_STRENGTH');state.profile.rhythms.push('PRIVATE_ROUTINE');state.profile.window='PRIVATE_WINDOW';state.profile.activity='Very physical';
 state.today={date:localDate(now),context:'PRIVATE_TODAY'};state.entries=[{status:'completed',id:'x',ideaId:0,worthwhile:true,minutes:90,companions:[{name:'PRIVATE_COMPANION'}],movementEvidence:{source:'PRIVATE_READING'}}];
 state.generated=[{...catalogue[0],id:1001,title:'PRIVATE_HEALTH_HISTORY',source:'ai'}];
 const context=aiContext(state,now),raw=JSON.stringify(context);
 assert.deepEqual(context.needs,['Not enough time','Safety matters','Weather / heat']);
 assert.deepEqual(context.preferences,['Indoors']);assert.deepEqual(context.rhythm,['Calls']);assert.equal(context.activity,'');assert.equal(context.window,'');assert.deepEqual(context.confirmed,[]);assert.equal(context.today.context,'');
 assert.equal(context.hardLimits.movementModes,null);assert.equal(context.hardLimits.effort,'gentle or moderate');assert.equal(context.hardLimits.maxMovementMinutes,60);assert.equal(context.hardLimits.maxExtraMinutes,5);assert.equal(context.hardLimits.allowOutdoors,false);
 assert.equal(raw.includes('PRIVATE_'),false);
 for(const health of ['Pain / discomfort','Physical comfort / accessibility','Low energy / tired','Need recovery','Sleep matters','Already active at work'])assert.equal(raw.includes(health),false);
 state.today={date:'PRIVATE_DATE',context:'Lower energy'};assert.deepEqual(aiContext(state,now).today,{date:'',context:''});
});
test('the reduced endpoint checks all original needs and sends only accepted new ideas to pictures',async()=>{
 const state=profile('without-health');state.profile.needs=['Pain / discomfort','Physical comfort / accessibility','Low energy / tired','Need recovery','Weather / heat','Not enough time'];
 state.generated=[{...catalogue.find(i=>i.key==='break-stretch'),id:1001,key:'ai-1001',source:'ai',title:'PRIVATE_OLD_HEALTH',brief:'PRIVATE_OLD_HEALTH'}];
 const unsafe=[candidate('Outdoor walking',{movementMode:'walk',movementAction:'Walk around the block for one minute.',outdoor:true}),candidate('Moderate effort',{effort:'moderate'}),candidate('Long movement',{movementMinutes:25,activityMinutes:30}),candidate('Extra time',{extraMinutes:10})];
 const h=harness(state,{generate:async context=>{h.calls.generated.push(context);return {candidates:[...unsafe,candidate()]};}});
 const response=await h.post(request({aiConsent:createAiConsent('full',now)}));assert.equal(response.status,200);
 const result=await response.json();assert.equal(result.ideas.length,1);assert.equal(result.ideas[0].movementMode,'seated');assert.equal(result.ideas[0].effort,'gentle');
 assert.equal(h.calls.generated[0].needs.length,2);assert.equal(h.calls.pictures.length,1);assert.deepEqual(h.calls.pictures[0].previous,[]);assert.deepEqual(h.calls.pictures[0].ideas,result.ideas);
 const sent=JSON.stringify(h.calls.generated)+ideaImagePrompt(result.ideas[0]);assert.equal(sent.includes('PRIVATE_OLD_HEALTH'),false);assert.equal(sent.includes('Pain / discomfort'),false);
 assert.equal(state.profile.needs.includes('Pain / discomfort'),true);
});
test('full permission retains useful health limits and older picture backfill',async()=>{
 const state=profile();state.profile.needs=['Physical comfort / accessibility','Low energy / tired'];
 state.generated=[{...catalogue.find(i=>i.key==='break-stretch'),id:1001,key:'ai-1001',source:'ai',title:'Earlier shoulder pause',brief:'A familiar shoulder pause at home.'}];
 const {post,calls}=harness(state);assert.equal((await post(request())).status,200);
 assert.deepEqual(calls.generated[0].hardLimits.movementModes,['seated']);assert.equal(calls.generated[0].hardLimits.maxMovementMinutes,20);assert.equal(calls.pictures[0].previous.length,1);assert.equal(calls.ended,1);
});
test('revocation or a changed choice before generation prevents the call and releases the request reservation',async()=>{
 for(const next of [createAiConsent('declined',now),createAiConsent('without-health',now),createAiConsent('full',new Date(now.getTime()+1000))]){
  const state=profile();let reads=0;
  const {post,calls}=harness(state,{readConsent:async()=>++reads===1?state.aiConsent:next});
  const response=await post(request());assert.equal(response.status,409);assert.equal((await response.json()).consentRequired,true);assert.equal(calls.generated.length,0);assert.equal(calls.pictures.length,0);assert.equal(calls.ended,1);
 }
});
test('revoking after the idea call prevents pictures and returning that batch',async()=>{
 const state=profile();let generated=0;
 const {post,calls}=harness(state,{generate:async()=>{generated++;state.aiConsent=createAiConsent('declined',now);return {candidates:[candidate()]};}});
 const response=await post(request());assert.equal(response.status,409);assert.equal(generated,1);assert.equal(calls.pictures.length,0);assert.equal(calls.ended,1);
});
test('reduced permission does not weaken any supported health boundary during local candidate validation',()=>{
 for(const needs of [['Pain / discomfort'],['Physical comfort / accessibility'],['Low energy / tired'],['Need recovery'],['Sleep matters']]){
  const full=profile('full');full.profile.needs=needs;const reduced={...full,aiConsent:createAiConsent('without-health',now)};
  const rows={candidates:[candidate('Seated pause'),candidate('Brisk alternative',{movementMode:'walk',movementAction:'Walk briskly around the room for ten minutes.',effort:'moderate',movementMinutes:10}),candidate('Long alternative',{movementMinutes:25,activityMinutes:30})]};
  assert.deepEqual(validateCandidates(rows,reduced,now),validateCandidates(rows,full,now),needs.join(', '));
 }
});
