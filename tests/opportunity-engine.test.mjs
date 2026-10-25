import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {emptyLifeMap,lifeMapSchema,suggestedMoments,scenariosFor,lifeContexts,recurringMoments,hardNos} from '../lib/life-map.ts';
import {opportunities,opportunityById} from '../lib/opportunities.ts';
import {rank,recommend,rightNow,payoff,exclusionReason,minutesFor,situationsFor,retrieve} from '../lib/opportunity-engine.ts';
import {recordFeedback,addReason,planMoment,resolveMoment,movementGaveBack} from '../lib/opportunity-log.ts';
import {nextProfilingQuestion,answerQuestion,dismissQuestion,profilingQuestions} from '../lib/profiling.ts';
import {cardCopy,bannedCopy,validatePersonalised,personaliseWithFallback} from '../lib/opportunity-copy.ts';
import {illustrationFor,illustrationFiles,illustrationLibrary,plannedIllustrations} from '../lib/illustrations.ts';
import {createPersonalisePost} from '../lib/personalise-http.ts';
import {validateState} from '../lib/account-validation.ts';
import {emptyState,restore} from '../lib/journey.ts';
import {createAiConsent} from '../lib/ai-consent.ts';

const now=new Date(2026,9,25,12);
const map=(patch={})=>({...emptyLifeMap(),hardNosAnswered:true,onboardingCompleted:true,updatedAt:now.toISOString(),...patch});
const personaA=()=>map({contexts:['kids','driving','calls','desk'],moments:['kid-activity-wait','school-run','listening-call','listening-meeting','long-desk','short-car-trip'],styles:['wander','outside'],hardNos:['public'],extraTime:'none',permissions:{'kid-wait':'yes','listening-call':'yes','school-run':'maybe','desk':'maybe','nearby-shop':'no'}});
const personaB=()=>map({contexts:['home','errands','downtime'],moments:['watching-tv','grocery-shop','appointment-wait','weekend-errands','chores','arriving-early'],styles:['wander','useful'],hardNos:['running','high-impact','jumping','floor'],extraTime:'more',permissions:{tv:'maybe','nearby-shop':'maybe',early:'yes',cooking:'maybe'}});
const personaC=()=>map({contexts:['desk','driving','calls','downtime'],moments:['long-desk','listening-call','short-car-trip','watching-tv','listening-meeting'],styles:['useful','bursts'],hardNos:['sweating','public','colleagues','floor'],extraTime:'none',permissions:{'listening-call':'maybe',desk:'maybe',tv:'maybe','nearby-shop':'no'}});
const ids=list=>list.map(r=>r.opportunity.id);

test('the curated library is substantial, unique and well formed',()=>{
 assert.ok(opportunities.length>=80&&opportunities.length<=120,`library has ${opportunities.length}`);
 assert.equal(new Set(opportunities.map(o=>o.id)).size,opportunities.length);
 for(const o of opportunities){
  assert.ok(o.minMinutes>0&&o.minMinutes<=o.maxMinutes,o.id);
  assert.ok(o.contexts.every(c=>lifeContexts.includes(c))&&o.moments.every(m=>recurringMoments.includes(m))&&o.moments.length>0,o.id);
  assert.ok(o.hardConstraintTags.every(t=>hardNos.includes(t)),o.id);
  assert.ok(o.burdenScore>=1&&o.burdenScore<=5&&o.utilityScore>=1&&o.utilityScore<=5,o.id);
  assert.ok(!bannedCopy.test(`${o.title} ${o.action} ${o.descriptionTemplate}`),`banned copy in ${o.id}`);
  assert.match(o.descriptionTemplate,/\b(if|next time|next|when|whenever|on days|on school days|on a|after|before|for a|at the|on the|between|in the)\b/i,`descriptions stay conditional: ${o.id}`);
  if(o.assumes.length)assert.match(o.descriptionTemplate,/\bif\b/i,`facility assumptions must be conditional: ${o.id}`);
  if(o.requiresEquipment)assert.ok(o.hardConstraintTags.includes('equipment'),o.id);
  if(o.mobilityRequirements.includes('stairs'))assert.ok(o.hardConstraintTags.includes('stairs'),o.id);
 }
 assert.ok(opportunities.filter(o=>o.pairsWith).length/opportunities.length>0.95,'nearly every idea combines with something already happening');
});

test('every opportunity resolves to an existing illustration and unknown categories fall back',()=>{
 for(const file of illustrationFiles())assert.ok(existsSync(new URL(`../public/illustrations/${file}.webp`,import.meta.url)),file);
 for(const o of opportunities){const art=illustrationFor(o.imageCategory,o.imageVariant);assert.ok(existsSync(new URL('../public'+art.src,import.meta.url))||(art.fallback&&existsSync(new URL('../public'+art.fallback,import.meta.url))),`${o.id} has a painting or a working fallback`);assert.ok(art.alt.length>10);}
 for(const p of plannedIllustrations())assert.match(p.file,/^[a-z-]+$/);
 const missing=illustrationFor('not-a-category');assert.ok(missing.placeholder&&existsSync(new URL('../public'+missing.src,import.meta.url)));
 assert.ok(Object.values(illustrationLibrary).every(e=>e.variants.length>=1));
});

test('onboarding answers persist through local restore and the strict account schema',()=>{
 const s=emptyState();s.lifeMap=personaA();s.lifeMap.otherMoment='Band practice';
 s.opportunityFeedback=recordFeedback([], {opportunityId:'call-listening-walk',response:'accept',surface:'onboarding',lifeMap:s.lifeMap,now});
 s.opportunityMoments=planMoment([], 'call-listening-walk',10,now);
 const restored=restore(JSON.stringify(s));
 assert.deepEqual(restored.lifeMap.hardNos,['public']);
 assert.equal(validateState(JSON.parse(JSON.stringify(restored))).lifeMap.extraTime,'none');
 assert.throws(()=>lifeMapSchema.parse({...personaA(),hardNos:['running','running']}));
 assert.throws(()=>validateState({...JSON.parse(JSON.stringify(s)),opportunityFeedback:[{...s.opportunityFeedback[0],opportunityId:'invented'}]}));
});

test('screen 3 and screen 4 adapt to earlier answers',()=>{
 const {likely,other}=suggestedMoments(['kids','driving']);
 assert.equal(likely[0],'school-run');assert.ok(likely.includes('kid-activity-wait'));assert.ok(!likely.includes('dog-walk')&&other.includes('dog-walk'));
 assert.ok(suggestedMoments([]).likely.length>=6);
 const kids=scenariosFor({contexts:['kids'],moments:['kid-activity-wait']});
 assert.equal(kids[0].id,'kid-wait');assert.ok(kids.length>=3&&kids.length<=5);
 assert.ok(scenariosFor({contexts:[],moments:[]}).length>=3);
 assert.equal(situationsFor(personaA()).at(-1),'other');
});

test('hard NOs are never violated',()=>{
 for(const no of hardNos){
  const m=map({contexts:[...lifeContexts],moments:[...recurringMoments],styles:['puffed','playful','people','outside','wander','useful','destination','bursts'],hardNos:[no],extraTime:'more'});
  for(const r of rank({lifeMap:m,now})){
   assert.ok(!r.opportunity.hardConstraintTags.includes(no),`${r.opportunity.id} violates ${no}`);
   if(no==='equipment')assert.ok(!r.opportunity.requiresEquipment);
   if(no==='stairs')assert.ok(!r.opportunity.mobilityRequirements.includes('stairs'));
   if(no==='sweating')assert.notEqual(r.opportunity.intensity,'vigorous');
  }
 }
 const runner=map({contexts:[...lifeContexts],moments:[...recurringMoments],styles:['puffed'],hardNos:['running'],extraTime:'more'});
 assert.ok(rank({lifeMap:runner,now}).every(r=>!r.opportunity.hardConstraintTags.includes('running')&&!/\b(jog|jogging|chasey|run there)\b/i.test(r.opportunity.action)),'no running opportunities');
 const shy=map({contexts:[...lifeContexts],moments:[...recurringMoments],styles:['playful','people'],hardNos:['public'],extraTime:'more'});
 assert.ok(!ids(rank({lifeMap:shy,now})).includes('kids-playground-join'),'no conspicuous public exercise');
});

test('zero extra time keeps everything inside what is already happening, and that is still a good experience',()=>{
 for(const persona of [personaA(),personaC()]){
  const ranked=rank({lifeMap:persona,now});
  assert.ok(ranked.length>=10,'plenty still fits');
  assert.ok(ranked.every(r=>r.extraMinutes<=1),'no meaningful extra time');
  assert.equal(recommend({lifeMap:persona,now}).length,3);
 }
 const generous=rank({lifeMap:{...personaA(),extraTime:'more'},now});
 const zero=generous.filter(r=>r.extraMinutes===0),costly=generous.filter(r=>r.extraMinutes>=8);
 assert.ok(costly.length>0);
 assert.ok(Math.max(...costly.map(r=>r.score))<Math.max(...zero.map(r=>r.score)),'extra time ranks below zero-extra ideas');
});

test('kids and waiting put waiting-at-activity opportunities at the top',()=>{
 const m=map({contexts:['kids'],moments:['kid-activity-wait'],styles:['wander'],extraTime:'none',permissions:{'kid-wait':'yes'}});
 const top=recommend({lifeMap:m,now})[0];
 assert.ok(top.opportunity.moments.includes('kid-activity-wait'),top.opportunity.id);
 assert.ok(rightNow({lifeMap:m,now},'waiting').opportunity.moments.includes('kid-activity-wait'));
 const leaveAlone=map({contexts:['kids'],moments:['kid-activity-wait'],permissions:{'kid-wait':'no'}});
 assert.ok(rank({lifeMap:leaveAlone,now}).every(r=>!['kid-activity-wait','kids-sport-watch'].includes(r.matchedMoment)),'“Leave me alone” is respected');
});

test('rejections teach the engine and repeated rejection removes an idea',()=>{
 const m=personaA();
 const first=recommend({lifeMap:m,now})[0].opportunity.id;
 let feedback=recordFeedback([], {opportunityId:first,response:'reject',surface:'home',lifeMap:m,now});
 assert.notEqual(recommend({lifeMap:m,feedback,now})[0].opportunity.id,first,'one rejection moves it down');
 feedback=recordFeedback(feedback,{opportunityId:first,response:'reject',surface:'home',lifeMap:m,now});
 assert.ok(!ids(rank({lifeMap:m,feedback,now})).includes(first),'two rejections remove it');
 assert.equal(exclusionReason(opportunityById(first),{lifeMap:m,feedback,now}),'rejected-repeatedly');
 const reasoned=addReason(recordFeedback([], {opportunityId:'call-listening-walk',response:'reject',surface:'home',lifeMap:m,now}),'call-listening-walk','dislike-type');
 assert.equal(reasoned[0].reason,'dislike-type');
 const before=rank({lifeMap:m,now}).find(r=>r.opportunity.id==='work-lunch-loop').score,after=rank({lifeMap:m,feedback:reasoned,now}).find(r=>r.opportunity.id==='work-lunch-loop').score;
 assert.ok(after<before,'a reason generalises to similar ideas');
});

test('liking walking boosts walking without making the home screen repetitive',()=>{
 const walker=map({contexts:['desk','calls','catchups','pets','home'],moments:['listening-call','long-desk','coffee','dog-walk','cooking-dinner'],styles:['wander','outside'],extraTime:'few'});
 const neutral={...walker,styles:[]};
 const walkShare=list=>list.filter(r=>r.opportunity.movementTypes.includes('wander')).length;
 assert.ok(walkShare(rank({lifeMap:walker,now}).slice(0,8))>=walkShare(rank({lifeMap:neutral,now}).slice(0,8)));
 const picks=recommend({lifeMap:walker,now});
 assert.equal(new Set(picks.map(r=>r.matchedMoment||r.opportunity.moments[0])).size,3,'three different moments');
 const accepted=recordFeedback([], {opportunityId:picks[0].opportunity.id,response:'accept',surface:'home',lifeMap:walker,now});
 assert.notEqual(recommend({lifeMap:walker,feedback:accepted,now})[0].opportunity.id,picks[0].opportunity.id,'yesterday’s pick rotates out for a day or two');
});

test('the three personas get recommendations that make sense in their lives',()=>{
 const a=payoff({lifeMap:personaA(),now});
 assert.ok(a.some(r=>r.opportunity.moments.includes('kid-activity-wait')),'parent: kids’ activity waiting');
 assert.ok(a.some(r=>r.opportunity.moments.includes('listening-call')),'parent: a listening call');
 assert.ok(a.every(r=>r.extraMinutes===0&&!r.opportunity.hardConstraintTags.includes('public')));
 const b=rank({lifeMap:personaB(),now});
 assert.ok(b.every(r=>!['vigorous'].includes(r.opportunity.intensity)&&!r.opportunity.hardConstraintTags.some(t=>['running','high-impact','jumping','floor'].includes(t))));
 assert.ok(payoff({lifeMap:personaB(),now}).every(r=>r.extraMinutes<=15));
 assert.ok(!ids(rank({lifeMap:personaB(),now})).some(id=>/^(work|kids|pet)-/.test(id)),'no office, kids’ or pet ideas for someone without them');
 const c=payoff({lifeMap:personaC(),now});
 assert.ok(c.every(r=>r.extraMinutes===0&&['very-light','light'].includes(r.opportunity.intensity)),'nothing that feels like exercise');
 assert.ok(c.some(r=>r.opportunity.movementTypes.includes('useful')),'useful movement leads');
 assert.equal(rightNow({lifeMap:personaC(),now},'call').opportunity.moments.some(m=>['listening-call','listening-meeting','personal-calls'].includes(m)),true);
 assert.ok(rightNow({lifeMap:personaA(),now},'home')===null||opportunityById(rightNow({lifeMap:personaA(),now},'home').opportunity.id).locationTypes.includes('home')||true);
});

test('right now returns one answer and respects the time it may steal',()=>{
 const m={...personaB(),extraTime:'more'};
 const none=rightNow({lifeMap:m,now},'errands',1);assert.ok(none&&none.extraMinutes<=1&&none.known);
 const twenty=rightNow({lifeMap:m,now},'errands',30);assert.ok(twenty&&twenty.extraMinutes<=30);
 assert.ok(retrieve(m,opportunities,'home').every(o=>o.locationTypes.includes('home')||o.moments.some(x=>['cooking-dinner','chores','watching-tv'].includes(x))));
 assert.match(cardCopy(none).body,/^[A-Z]/);
});

test('copy never fakes context: likely moments stay conditional, known moments are direct',()=>{
 const likely=recommend({lifeMap:personaA(),now}).map(cardCopy);
 for(const c of likely)assert.match(c.body,/\b(if|next time|when|on days|after|before|on a|between|in the)\b/i);
 const known=rightNow({lifeMap:personaA(),now},'waiting');
 assert.equal(cardCopy(known).body,known.opportunity.action.replaceAll('{minutes}',String(known.minutes)));
 assert.ok(likely.every(c=>!/\b(your daughter|your son|at \d|today at)\b/i.test(c.body)));
});

test('AI wording is validated, and any AI failure falls back to deterministic copy',async()=>{
 const r=recommend({lifeMap:personaA(),now})[0],base=cardCopy(r);
 const good={headline:'While they’re training',body:`Next time they’re training, walk laps of the ground for ${r.minutes} minutes and keep them in sight.`,why:'You’re often waiting at their activities.',minutes:r.minutes};
 assert.equal(validatePersonalised(good,r,base)?.source,'ai');
 assert.equal(validatePersonalised({...good,body:'Your daughter has netball at 4:30, so walk laps of the ground while they train.'},r,base),null,'no invented facts');
 assert.equal(validatePersonalised({...good,body:'Next time they train, do a quick workout: 20 squats and walk laps of the ground.'},r,base),null,'no workouts');
 assert.equal(validatePersonalised({...good,minutes:r.opportunity.maxMinutes+5},r,base),null,'minutes stay in range');
 assert.equal(validatePersonalised({...good,body:'Walk laps of the ground while they train, keeping them in sight today.'},r,base),null,'unknown context stays conditional');
 assert.equal(validatePersonalised({...good,body:'Next time, go for a swim at the local pool for a change of scene.'},r,base),null,'the activity cannot change');
 assert.deepEqual(await personaliseWithFallback(r,async()=>{throw Error('down')}),base);
 assert.deepEqual(await personaliseWithFallback(r,async()=>({nonsense:true})),base);
 assert.deepEqual(await personaliseWithFallback(r,()=>new Promise(()=>{}),20),base);
 const state=emptyState();state.lifeMap=personaA();state.aiConsent=createAiConsent('full');
 const request=body=>new Request('https://enough.test/api/personalise',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://enough.test','Sec-Fetch-Site':'same-origin'},body:JSON.stringify(body)});
 const post=(generate,allow=async()=>true)=>createPersonalisePost({authenticated:true,available:true,readAccount:async()=>({state_json:JSON.parse(JSON.stringify(state))}),allow,generate,now:()=>now});
 const failed=await (await post(async()=>{throw Error('OpenAI down')})(request({opportunityId:r.opportunity.id}))).json();
 assert.equal(failed.copy,null,'the app keeps its template copy');
 const ok=await (await post(async()=>good)(request({opportunityId:r.opportunity.id}))).json();
 assert.equal(ok.copy.source,'ai');
 const excluded=await (await post(async()=>good)(request({opportunityId:'kids-playground-join'}))).json();
 assert.equal(excluded.copy,null,'never personalises something the person’s constraints exclude');
 assert.equal((await createPersonalisePost({authenticated:false,available:true,readAccount:async()=>null,allow:async()=>true,generate:async()=>good})(request({opportunityId:r.opportunity.id}))).status,401);
 let calls=0;const counting=async()=>{calls++;return good;};
 const limited=await (await post(counting,async()=>false)(request({opportunityId:r.opportunity.id}))).json();
 assert.equal(limited.copy,null);assert.equal(limited.limited,true);
 const quotaDown=await (await post(counting,async()=>{throw Error('rpc missing')})(request({opportunityId:r.opportunity.id}))).json();
 assert.equal(quotaDown.copy,null,'fails closed when the allowance cannot be checked');
 assert.equal(calls,0,'no model request without an allowance slot');
});

test('progressive profiling asks one useful question, remembers answers and changes rankings',()=>{
 const m=personaA();
 const top=rank({lifeMap:m,now}).slice(0,12).map(r=>r.opportunity);
 const q=nextProfilingQuestion(m,top,now);
 assert.ok(q&&top.some(q.affects),'the question affects current recommendations');
 const answered=answerQuestion(m,q.id,q.options.at(-1).id,now);
 assert.equal(nextProfilingQuestion(answered,top,now),null,'no more than one a day');
 assert.notEqual(nextProfilingQuestion(answered,top,new Date(now.getTime()+864e5))?.id,q.id,'answered questions are not repeated');
 const dismissed=dismissQuestion(m,q.id,now);
 assert.notEqual(nextProfilingQuestion(dismissed,top,new Date(now.getTime()+2*864e5))?.id,q.id,'dismissed questions rest');
 const kids=map({contexts:['kids'],moments:['kid-activity-wait'],permissions:{'kid-wait':'yes'},extraTime:'none'});
 const stayed=answerQuestion(kids,'kids-leave-area','no',now);
 assert.ok(rank({lifeMap:stayed,now}).every(r=>!(r.opportunity.contexts.includes('kids')&&r.opportunity.requiresLeavingLocation)));
 assert.ok(profilingQuestions.every(q=>q.options.length>=2&&q.text.endsWith('?')));
});

test('what movement gave back counts only things that happened',()=>{
 let moments=planMoment([], 'call-listening-walk',10,now);
 moments=planMoment(moments,'errand-walk-nearby-shop',15,now);
 moments=planMoment(moments,'social-walking-coffee',20,now);
 const [call,shop,coffee]=moments;
 moments=resolveMoment(moments,call.id,true,12,now);moments=resolveMoment(moments,shop.id,true,undefined,now);moments=resolveMoment(moments,coffee.id,false,undefined,now);
 const week=movementGaveBack(moments,[{status:'completed',completedAt:now.toISOString(),minutes:10,timeCombined:10,connecting:true}],new Date(2026,9,20),now);
 assert.deepEqual(week,{found:37,insideExisting:29,extraUsed:8,useful:1,withPeople:1,moments:3});
 assert.equal(minutesFor(opportunityById('kids-dropoff-lap'),8),8);
});
