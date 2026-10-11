import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue,byId} from '../lib/ideas.ts';
import {sittingBreakIdeas} from '../lib/sitting-break-ideas.ts';
import {validSittingBreak} from '../lib/idea-tags.ts';
import {describesMovement} from '../lib/idea-movement.ts';
import {emptyState,accept,finish,restore,receipt} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {eligible,recommend} from '../lib/recommendations.ts';
import {moveCollections} from '../lib/moves.ts';
const now=new Date(2026,9,5,12);
function configured(){const s=emptyState();Object.assign(s.profile,{preferences:['Indoors'],interests:['Music'],needs:['Nothing to add'],strengths:['I’m willing to try small changes'],activity:'Mostly seated',rhythms:['Calls'],window:'Daytime'});s.demo=true;return s;}

test('15 stable short sitting breaks describe movement, alternatives and safe versions',()=>{
 assert.equal(sittingBreakIdeas.length,15);assert.deepEqual(sittingBreakIdeas.map(i=>i.id),Array.from({length:15},(_,n)=>46+n));
 assert.ok(sittingBreakIdeas.filter(i=>i.intensity==='strength').length>=3);assert.ok(sittingBreakIdeas.filter(i=>i.intensity==='vigorous-burst').length>=3);
 for(const i of sittingBreakIdeas){assert.ok(i.minutes>=1&&i.minutes<=3);assert.ok(i.usual&&i.safety);assert.ok(validSittingBreak(i.movementMode,i.movement.action));assert.ok(describesMovement(i.movementMode,i.movement.action));assert.equal(byId(i.id),i);}
 assert.equal(new Set(catalogue.map(i=>i.id)).size,catalogue.length);
});
test('landing examples exist as genuine library alternatives',()=>{
 for(const key of ['call-family-walk','water-refill-far','library-easy-run','ad-break-wall-pushups'])assert.ok(catalogue.find(i=>i.key===key));
 assert.equal(catalogue.find(i=>i.key==='water-refill-far').movementMode,'stairs');
});
test('sitting-break collection narrows the eligible pool; restricted needs block intense library and disguised AI variants',()=>{
 const s=configured(),pool=recommend(s,now).map(r=>r.idea),collection=moveCollections(pool,s,now).find(c=>c.key==='break-the-sit');assert.ok(collection.ideas.length);assert.ok(collection.ideas.every(i=>pool.includes(i)&&i.breaksSitting&&i.minutes<=3));
 for(const need of ['Pain / discomfort','Physical comfort / accessibility','Need recovery','Low energy / tired']){s.profile.needs=[need];for(const intensity of ['strength','vigorous-burst'])assert.equal(eligible({...sittingBreakIdeas[0],source:'ai',exclude:[],effort:'gentle',intensity},s,now),false);assert.ok(recommend(s,now).every(r=>!['strength','vigorous-burst'].includes(r.idea.intensity)));}
});
test('optional sitting-break answers survive save, restore and export; only explicit yes counts',()=>{
 let s=configured();s=accept(s,46);const id=s.entries[0].id;
 for(const answer of [undefined,'yes','no','unsure']){const result=finish(s,id,{minutes:2,outside:false,connecting:false,worthwhile:true,moneyCents:0,brokeSitting:answer});const restored=restore(JSON.stringify(validateState(result)));assert.equal(restored.entries[0].brokeSitting,answer);const rows=receipt(restored.entries,'All time','AUD').rows;assert.equal(rows.filter(e=>e.brokeSitting==='yes').length,answer==='yes'?1:0);}
 assert.throws(()=>finish(s,id,{minutes:2,moneyCents:0,brokeSitting:'maybe'}));s.entries[0].brokeSitting='maybe';assert.throws(()=>validateState(s));assert.throws(()=>restore(JSON.stringify(s)));
});
