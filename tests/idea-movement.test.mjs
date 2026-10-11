import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,restore} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {validateCandidates,generatorPrompt} from '../lib/ai-ideas.ts';
import {eligible,recommend} from '../lib/recommendations.ts';
import {describesMovement,hasMovement} from '../lib/idea-movement.ts';

const now=new Date(2026,9,11,12);
function profile(){const s=emptyState();Object.assign(s.profile,{preferences:['Indoors'],interests:['Podcasts','Creativity'],needs:['Physical comfort / accessibility'],strengths:['I enjoy learning'],activity:'Mostly sitting',rhythms:['Work'],window:'It varies'});return s;}
const action='Roll your shoulders comfortably for one minute during the existing podcast pause.';
const candidate={title:'A pause in the story',hook:'Keep listening to your podcast.',category:'listen',lifeAnchor:'Podcast',mechanism:'combine',family:'listening pause',counterfactual:'Listen while sitting still.',suggestion:action,movementMode:'seated',movementAction:action,activityMinutes:20,socialConfiguration:'alone',outdoor:false,effort:'gentle',movementMinutes:1,extraMinutes:0,money:0,moneySource:'none',output:'',whyThisFits:'A familiar movement within comfort.',fitLabel:'Fits a seated pause',safety:'Use a familiar comfortable movement; leave it out if unsuitable.',fitScore:8,feasibilityScore:8,discoveryScore:8,predictedWorthIt:8,enjoy:['Podcasts'],brief:{experienceBeingSold:'Enjoy the story',desiredEmotion:'At ease',reward:'A pleasant pause',rewardShown:'A comfortable pause',activity:action,socialContext:'Alone',setting:'Home',timeOfDay:'Day'}};
const legacy={id:1001,key:'ai-1001',title:'Cushion Craft Swap',category:'other',usual:'Listen to a podcast while seated.',body:'Make a cushion cover while listening to a 20-minute podcast, seated with simple hand-sewing.',minutes:25,extraMin:10,moneyCents:0,moneySource:'none',enjoy:['Creativity','Podcasts'],outdoor:false,effort:'gentle',exclude:[],safety:'Work within comfort.',social:false,output:'Cushion cover',family:'craft',mechanism:'combine',movementMode:'seated',source:'ai',brief:'A cushion cover on a comfortable table.'};

test('stationary hobbies and finger tasks cannot pass with a seated label and invented minutes',()=>{
 const nonMovement=['Read a chapter.','Listen to a podcast.','Sort the family cards at a seated table.','Sew a cushion cover.','Knit a scarf.','Type a journal entry.','Move your fingers while drawing.','Stand still while watching TV.'];
 for(const movementAction of nonMovement)assert.deepEqual(validateCandidates({candidates:[{...candidate,movementAction,suggestion:movementAction}]},profile(),now),[],movementAction);
 assert.equal(hasMovement(legacy),false);
});
test('a short explicit mobility pause counts its moving minute, not the entire podcast',()=>{
 const [idea]=validateCandidates({candidates:[candidate]},profile(),now);
 assert.equal(idea.minutes,1);assert.equal(idea.movement.activityMinutes,20);
 assert.equal(idea.movement.action,action);assert.ok(idea.body.includes(action));
 assert.equal(eligible(idea,profile(),now),true);
 const state=profile();state.generated=[idea];assert.equal(restore(JSON.stringify(validateState(state))).generated[0].movement.action,action);
 assert.match(generatorPrompt,/has 1 movement minute, not 20/);
});
test('zero, negative, fractional, exaggerated and impossible movement durations are rejected instead of clamped into a claim',()=>{
 for(const movementMinutes of [0,-2,0.5,61,999,21])assert.deepEqual(validateCandidates({candidates:[{...candidate,movementMinutes}]},profile(),now),[],String(movementMinutes));
});
test('movement instructions remain visible and cannot be replaced by a generic label or topic',()=>{
 const [idea]=validateCandidates({candidates:[{...candidate,suggestion:'Enjoy the story in your usual chair.'}]},profile(),now);
 assert.ok(idea.body.includes(action));
 assert.equal(describesMovement('seated','Read about shoulder stretches.'),false);
 assert.equal(describesMovement('walk','Watch a film about walking.'),false);
 assert.equal(describesMovement('seated','Seated hand activity.'),false);
 assert.equal(describesMovement('unknown',action),false);
 assert.equal(describesMovement('walk','Do not walk; read your book instead.',true),false);
});
test('new movement quality checks never relax accessibility, fatigue, weather or time boundaries',()=>{
 const s=profile();s.profile.needs.push('Weather / heat','Low energy / tired','Not enough time');
 for(const patch of [{movementMode:'walk',movementAction:'Walk around the block for one minute.',outdoor:true},{effort:'moderate'},{movementMinutes:21,activityMinutes:30},{extraMinutes:10}])assert.deepEqual(validateCandidates({candidates:[{...candidate,...patch}]},s,now),[]);
});
test('earlier non-movement ideas leave recommendations while bookmarks and confirmed history still restore',()=>{
 const s=profile();s.generated=[legacy];s.saved=[legacy.id];s.entries=[{id:'old-outcome',ideaId:legacy.id,status:'completed',acceptedAt:now.toISOString(),completedAt:now.toISOString(),minutes:0,outside:false,connecting:false,worthwhile:true,moneyCents:0,currency:'AUD'}];
 assert.equal(eligible(legacy,s,now),false);assert.ok(recommend(s,now).every(r=>r.idea.id!==legacy.id));
 const restored=restore(JSON.stringify(validateState(s)));assert.equal(restored.saved[0],legacy.id);assert.equal(restored.generated[0].body,legacy.body);assert.equal(restored.entries[0].minutes,0);
 const walking={...legacy,movementMode:'walk',body:'Walk to the post office on a familiar route instead of driving.',outdoor:true};
 const unrestricted=profile();unrestricted.profile.needs=['Nothing to add'];
 assert.equal(eligible(walking,unrestricted,now),true);
});
