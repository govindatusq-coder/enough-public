import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../lib/ideas.ts';
import {emptyState} from '../lib/journey.ts';
import {eligible} from '../lib/recommendations.ts';
import {isFreeMove} from '../lib/discovery.ts';
import {movesIdeas,defaultMoveOptions,moveCollections,favouriteCollections,moveFeedback,moveFilters} from '../lib/moves.ts';

const now=new Date(2026,9,8,9),idea=key=>catalogue.find(i=>i.key===key);
const profile=()=>{const s=emptyState();Object.assign(s.profile,{preferences:['Outside'],interests:['Podcasts','Nature'],needs:['Nothing to add'],strengths:['I like exploring'],activity:'Every day is different',rhythms:['Calls'],window:'It varies'});return s;};
test('My Moves filters intersect duration, setting, category and extra time, preserving the supplied eligible pool',()=>{
 const s=profile();s.profile.needs=['Physical comfort / accessibility'];const pool=catalogue.filter(i=>eligible(i,s,now));
 for(const f of moveFilters)assert.ok(movesIdeas(pool,f,s,defaultMoveOptions).every(i=>i.key==='break-stretch'));
 assert.equal(movesIdeas(pool,'Near me',s,defaultMoveOptions).length,0);
 const options={...defaultMoveOptions,maxMinutes:15,setting:'indoors',category:'listen',noExtra:true};
 assert.deepEqual(movesIdeas(catalogue,'For you',profile(),options).map(i=>i.key),['audiobook-chores']);
 assert.equal(movesIdeas(catalogue,'For you',profile(),{...options,query:'audiobook tidy'}).length,1);
 assert.equal(movesIdeas(catalogue,'For you',profile(),{...options,query:'audiobook call'}).length,0);
 assert.ok(movesIdeas(catalogue,'Low energy',profile(),defaultMoveOptions).every(i=>i.effort==='gentle'&&i.minutes<=15));
});
test('nearby and surprise discovery use only known free movement ideas and nature requires relevant context',()=>{
 const s=profile();for(const f of ['Near me','Surprise me'])assert.ok(movesIdeas(catalogue,f,s,defaultMoveOptions).every(isFreeMove));
 assert.ok(movesIdeas(catalogue,'Near me',s,defaultMoveOptions).every(i=>i.outdoor));
 const nature=movesIdeas(catalogue,'Nature',s,defaultMoveOptions);assert.ok(nature.length>0);assert.ok(nature.every(i=>i.outdoor&&i.enjoy.some(t=>['Nature','Exploring','Gardening','Photography','Animals'].includes(t))));
});
test('savings filtering follows the current currency, including user-entered costs',()=>{
 const s=profile(),stretch=idea('break-stretch');s.costs=[{ideaId:stretch.id,currency:'USD',usualCents:500,moveCents:0}];
 assert.equal(movesIdeas([stretch],'Save money',s,defaultMoveOptions).length,0);s.profile.currency='USD';
 assert.deepEqual(movesIdeas([stretch],'Save money',s,defaultMoveOptions).map(i=>i.id),[stretch.id]);
});
test('personal collections derive their reasons from PINS or actual worthwhile outcomes in the eligible pool',()=>{
 const s=profile(),collections=moveCollections(catalogue,s,now),listen=collections.find(t=>t.key==='listen');assert.match(listen.reason,/podcasts/);assert.equal(listen.personal,true);
 const tasks=collections.find(t=>t.key==='tasks');assert.equal(tasks.personal,false);
 s.entries=[{ideaId:idea('laundry-stairs').id,status:'completed',completedAt:new Date(2026,9,7).toISOString(),worthwhile:true},{ideaId:idea('wait-laundry').id,status:'completed',completedAt:new Date(2026,9,9).toISOString(),worthwhile:true}];
 assert.match(moveCollections(catalogue,s,now).find(t=>t.key==='tasks').reason,/found worthwhile/);
 assert.equal(moveCollections(catalogue,s,now).find(t=>t.key==='pauses').personal,false);
 const pool=[idea('break-stretch')];assert.ok(moveCollections(pool,s,now).every(t=>t.ideas.every(i=>i.key==='break-stretch')));
 assert.deepEqual(moveCollections([],s,now),[]);
});
test('favourite counts include saved ideas within current needs, and exclude unavailable or unsaved ideas',()=>{
 const s=profile();s.saved=[idea('podcast-outside').id,idea('laundry-stairs').id];
 const favourites=favouriteCollections([idea('podcast-outside'),idea('break-stretch')],s);
 assert.ok(favourites.length>0);for(const t of favourites)assert.deepEqual(t.ideas.map(i=>i.id),[idea('podcast-outside').id]);
 assert.deepEqual(favouriteCollections([idea('break-stretch')],s),[]);assert.deepEqual(favouriteCollections([],s),[]);
});
test('card feedback counts confirmed tries only and cannot infer a rating from a plan or future outcome',()=>{
 const s=profile(),id=idea('call-family-walk').id;s.entries=[{ideaId:id,status:'completed',completedAt:new Date(2026,9,7).toISOString(),worthwhile:true},{ideaId:id,status:'completed',completedAt:new Date(2026,9,7,11).toISOString(),worthwhile:false},{ideaId:id,status:'accepted',worthwhile:true},{ideaId:id,status:'completed',completedAt:new Date(2026,9,9).toISOString(),worthwhile:true}];
 assert.deepEqual(moveFeedback(id,s,now),{tries:2,worthwhile:1});assert.deepEqual(moveFeedback(idea('podcast-outside').id,s,now),{tries:0,worthwhile:0});
});
