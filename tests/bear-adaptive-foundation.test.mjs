// Adaptive Responsibility Engine, foundations: the temporal profile (deterministic, versioned, neutral when unanswered),
// responsibility attributes kept apart from lists, what Bear can actually do, list sets and learning from her choices.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload} from '../lib/bear/board/service.ts';
import {detailView} from '../lib/bear/rre/service.ts';
import {scoreProfile,dominant,explainProfile,PROFILE_VERSION,DIMENSIONS} from '../lib/bear/adaptive/profile.ts';
import {attributesOf,domainOf} from '../lib/bear/adaptive/attributes.ts';
import {capabilities,can} from '../lib/bear/adaptive/capabilities.ts';
import {LIST_SETS,listsForStyle,recommendStyle,ruleSuggestion} from '../lib/bear/adaptive/lists.ts';
import {learnCategory,learnedList,learnFeedback,isSuppressed,strategyPreference,learnStrategy,resetLearning,mayAskFeedback,emptyLearning,usualHours,learnTiming} from '../lib/bear/adaptive/learning.ts';

const MON=new Date('2026-11-23T10:00:00+11:00');
test('profile: the first two answers set autonomy and predictability; the blend follows; unanswered stays neutral with no confidence',()=>{
 const planner=scoreProfile({control:'plan_own',howDone:'in_advance'},MON);
 assert.equal(planner.version,PROFILE_VERSION);assert.equal(dominant(planner),'planner');assert.ok(planner.dims.autonomy>=.85&&planner.dims.planningPreference>=.8);
 assert.equal(dominant(scoreProfile({control:'fixed_routine',howDone:'routine'})),'juggler');
 assert.equal(dominant(scoreProfile({control:'flexible_changing',howDone:'grab_moment'})),'improviser');
 assert.equal(dominant(scoreProfile({control:'depends_others',howDone:'when_urgent'})),'oncall');
 const blank=scoreProfile({});
 for(const d of DIMENSIONS){assert.ok(blank.dims[d]>=.5&&blank.dims[d]<=.55,d);assert.equal(blank.confidence[d],0,d);}
 assert.equal(dominant(blank),null,'no answers: no profile is guessed');
 for(const p of [planner,blank,scoreProfile({control:'depends_day'})])assert.ok(Math.abs(Object.values(p.mix).reduce((a,b)=>a+b,0)-1)<.03);
 // Barriers and helpers adjust, never replace, the principal axes.
 const busy=scoreProfile({control:'depends_others',barriers:['interruptions','exhausted'],helpers:'regularly'});
 assert.ok(busy.dims.interruptionTolerance<.3&&busy.dims.cognitiveCapacity<.35&&busy.dims.delegationAccess>=.85);
 assert.equal(busy.dims.autonomy,.2);
 // The same answers always give the same profile.
 assert.deepEqual(scoreProfile({control:'fixed_routine',barriers:['competing']}).dims,scoreProfile({control:'fixed_routine',barriers:['competing']}).dims);
});
test('profile explanation: warm, specific to what she said, no labels',()=>{
 const t=explainProfile(scoreProfile({control:'depends_others',assist:['prepare','share'],helpers:'sometimes_if_organised'}));
 assert.match(t,/other people’s schedules/);assert.match(t,/prepare what I can/);assert.doesNotMatch(t,/planner|juggler|improviser|on-call|autonomy/i);
 assert.match(explainProfile(scoreProfile({control:'plan_own',howDone:'in_advance'})),/plan your own time/);
});
test('attributes: what a responsibility is, from the real plan; unknown stays unknown',async()=>{
 const s=new MemoryBackend().for('ad000000-0000-4000-8000-000000000001');await ensureProfile(s);await saveProfile(s,{name:'Sarah',onboardingComplete:true});
 const r=await unload(s,null,{text:'Call the dentist to book a check-up\nPay the school excursion levy by Friday\nPick up the dry cleaning on Thursday',via:'text'},MON);
 const by=async t=>{const id=r.added.find(a=>t.test(a.title)).id;const d=await detailView(s,id,MON);const task=await s.get('tasks',id);return attributesOf(task,task.rre,{status:d.status});};
 const call=await by(/dentist/i);assert.equal(call.requiresBusinessHours,true);assert.ok(call.contextTags.includes('business_hours'));assert.equal(call.interruptibility,'low');
 const levy=await by(/levy/i);assert.equal(levy.domain,'school_admin');assert.equal(levy.pattern,'bill');assert.ok(levy.contextTags.includes('needs_focus'));assert.equal(levy.dueAt,'2026-11-27');
 assert.ok(levy.latestUsefulActionAt&&levy.latestUsefulActionAt<='2026-11-27');assert.equal(levy.delegationEligible,false,'bills need her logins');
 const dry=await by(/dry cleaning/i);assert.equal(dry.delegationEligible,true);assert.ok(dry.humanMinutes>0);
 for(const a of [call,levy,dry]){assert.equal(a.labour.anticipation,'bear');assert.ok(['you','bear','someone_else','done','not_needed'].includes(a.labour.execution));}
 assert.equal(domainOf('Book the vet for the dog','appointment').domain,'pets');assert.equal(domainOf('xyz','general').confidence,.1);
});
test('capabilities: only what really exists is available; outside actions need approval; buying and paying never',()=>{
 const none=capabilities({env:{NEXT_PUBLIC_SUPABASE_URL:'x'}});
 assert.equal(can(none,'send_email'),false);assert.equal(can(none,'create_calendar_event'),false);assert.equal(can(none,'send_message'),false);
 assert.equal(can(none,'make_purchase'),false);assert.equal(can(none,'make_payment'),false);assert.equal(can(none,'draft_email'),true);
 const out=capabilities({outlookConnected:true,env:{NEXT_PUBLIC_SUPABASE_URL:'x',TWILIO_ACCOUNT_SID:'a',TWILIO_AUTH_TOKEN:'b',TWILIO_FROM:'c'}});
 assert.equal(can(out,'create_calendar_event'),true);assert.equal(can(out,'send_message'),true);
 for(const c of out)if(c.external)assert.equal(c.needsApproval||!c.available||c.id==='read_calendar',true,c.id);
 assert.ok(none.filter(c=>!c.available).every(c=>c.why.length>0));
});
test('lists: four suggested sets plus the originals, a recommendation from the profile, rules that use attributes not titles',()=>{
 assert.deepEqual(LIST_SETS.map(s=>s.style),['classic','areas','routine','windows','support']);
 assert.deepEqual(listsForStyle('support').map(l=>l.title),['Bear Can Prepare','Needs Arranging','Someone Else Can Do It','When I Have Capacity','Waiting on Others','Just for Me']);
 assert.equal(listsForStyle('routine').find(l=>l.id==='after').title,'After Work');assert.equal(listsForStyle('routine',{children:true}).find(l=>l.id==='after').title,'After Pickup');
 assert.equal(recommendStyle(scoreProfile({control:'plan_own',howDone:'in_advance'})),'areas');assert.equal(recommendStyle(scoreProfile({control:'fixed_routine'})),'routine');
 assert.equal(recommendStyle(scoreProfile({control:'flexible_changing',howDone:'grab_moment'})),'windows');assert.equal(recommendStyle(scoreProfile({control:'depends_others'})),'support');
 assert.equal(recommendStyle(scoreProfile({})),'classic');assert.equal(recommendStyle(null),'classic');
 const a={domain:'home_maintenance',pattern:'chore',contextTags:[],requiresBusinessHours:false,locationRequirements:[],humanMinutes:30,interruptibility:'medium',readiness:'ready',agentPreparationAvailable:false,delegationEligible:true,cognitiveEffort:'low'};
 assert.equal(ruleSuggestion(a,listsForStyle('support'),.8),'someone');assert.equal(ruleSuggestion(a,listsForStyle('support'),.1),'capacity','no one to hand it to');
 assert.equal(ruleSuggestion(a,listsForStyle('areas')),'home');assert.equal(ruleSuggestion({...a,requiresBusinessHours:true},listsForStyle('windows')),'open');
 assert.equal(ruleSuggestion(a,[{id:'mine',title:'My own list',icon:'⭐',order:0}]),null,'her own lists get no guess from rules');
});
test('learning: two explicit corrections teach a list; Bear’s own guesses never do; feedback, suppression and reset',()=>{
 const at='2026-11-23T10:00:00Z';const school={pattern:'form',domain:'school_admin',contextTags:['online']};const ids=new Set(['night','calls','week']);
 let l=learnCategory(null,school,'week','night',true,at);assert.equal(learnedList(l,school,ids),null,'once is not enough');
 l=learnCategory(l,school,'week','night',true,at);assert.equal(learnedList(l,school,ids).listId,'night');
 assert.equal(learnedList(l,{...school,pattern:'call'},ids).listId,'night','the same domain carries over');
 let g=learnCategory(null,school,null,'week',false,at);g=learnCategory(g,school,null,'week',false,at);g=learnCategory(g,school,null,'week',false,at);
 assert.equal(learnedList(g,school,ids),null,'Bear’s own filing teaches nothing');assert.equal(g.corrections.length,3,'but it is recorded');
 assert.equal(learnedList(l,school,new Set(['calls'])),null,'a deleted list is never suggested');
 let f=learnFeedback(null,'dont_suggest',{strategy:'match',pattern:'chore',domain:'cleaning_laundry'},at);assert.equal(isSuppressed(f,{pattern:'chore',domain:'cleaning_laundry'}),true);
 assert.equal(mayAskFeedback(f,new Date('2026-11-23T12:00:00Z')),false);assert.equal(mayAskFeedback(f,new Date('2026-11-24T12:00:00Z')),true);
 let st=emptyLearning();for(let i=0;i<3;i++)st=learnStrategy(st,'offload',true);assert.equal(strategyPreference(st,'offload'),1);assert.equal(strategyPreference(st,'allocate'),0);
 assert.deepEqual(resetLearning(l,'category').category,[]);assert.deepEqual(resetLearning(f,'all'),emptyLearning());
 let tm=emptyLearning();for(let i=0;i<6;i++)tm=learnTiming(tm,20);for(let i=0;i<3;i++)tm=learnTiming(tm,12);assert.deepEqual(usualHours(tm),[20,12]);
});
