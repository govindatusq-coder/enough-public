import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../lib/ideas.ts';
import {emptyState,receipt,restore} from '../lib/journey.ts';
import {isFreeMove,filterIdeas,placeSearch,recentMoments,dashboardIdeas,dashboardGreeting,surpriseIdeaId} from '../lib/discovery.ts';
import {eligible,recommend} from '../lib/recommendations.ts';
import {validateState} from '../lib/account-validation.ts';

test('free discovery excludes purchase and paid transport swaps and does not assume AI ideas are free',()=>{
 const free=catalogue.filter(isFreeMove);
 assert.ok(free.length>10);
 for(const i of free){assert.equal(i.moneyCents,0);assert.equal(i.moneySource,'none');}
 for(const key of ['coffee-walk-further','collect-dinner','market-explore','park-and-walk','bike-commute-sometimes'])assert.equal(isFreeMove(catalogue.find(i=>i.key===key)),false);
 assert.equal(isFreeMove({...free[0],source:'ai'}),false);
});
test('discovery filters narrow eligible ideas, preserving accessibility and all search terms',()=>{
 const s=emptyState();s.profile.needs=['Physical comfort / accessibility'];
 const safe=catalogue.filter(i=>eligible(i,s,new Date('2026-10-06T12:00:00')));
 const free=filterIdeas(safe,'Free','',s);
 assert.equal(free.length,1);assert.equal(free[0].key,'break-stretch');
 assert.deepEqual(filterIdeas(catalogue,'For you','family call',s).map(i=>i.key),['call-family-walk','video-call-overseas']);
 assert.ok(filterIdeas(catalogue,'Quick wins','',s).every(i=>i.minutes<=10));
 assert.equal(filterIdeas(catalogue,'Save money','call',s).length,0);
});
test('written needs persist and pause unchecked recommendations instead of being silently ignored',()=>{
 const s=emptyState();Object.assign(s.profile,{preferences:['Outside'],interests:['Nature'],needs:['Something else: I cannot use stairs'],strengths:['I like exploring'],activity:'Mostly seated',rhythms:['Calls'],window:'It varies'});
 const saved=restore(JSON.stringify(validateState(s)));
 assert.equal(saved.profile.needs[0],s.profile.needs[0]);assert.equal(saved.profile.complete,true);
 assert.deepEqual(recommend(saved),[]);
});
test('monthly and all-time returns use actual outcomes, omit future entries and keep currencies separate',()=>{
 const base={status:'completed',minutes:10,moneyCents:500,outside:true,connecting:false,worthwhile:true};
 const entries=[{...base,currency:'AUD',completedAt:'2026-09-30T12:00:00'},{...base,currency:'AUD',completedAt:'2026-10-01T00:00:00'},{...base,currency:'SGD',completedAt:'2026-10-05T12:00:00'},{...base,currency:'AUD',completedAt:'2026-10-09T12:00:00'}];
 const now=new Date('2026-10-06T12:00:00');
 const month=receipt(entries,'This month','AUD',now);assert.equal(month.rows.length,2);assert.equal(month.money,500);
 assert.equal(receipt(entries,'All time','AUD',now).money,1000);
 assert.equal(receipt(entries,'This month','SGD',now).money,500);
});
test('nearby links need a town and encode the user input as a search rather than claiming a verified venue',()=>{
 assert.equal(placeSearch('public parks','  '),null);
 const url=new URL(placeSearch('public parks','Ipswich & surrounds'));
 assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('query'),'public parks in Ipswich & surrounds');
});

test('recent moments follow confirmation date, not acceptance order, without mutating history',()=>{
 const entries=[{id:'older-plan',status:'completed',completedAt:'2026-10-06T10:00:00Z'},{id:'later-plan',status:'completed',completedAt:'2026-10-05T10:00:00Z'},{id:'future',status:'completed',completedAt:'2026-10-07T10:00:00Z'},{id:'intent',status:'accepted'}];
 assert.deepEqual(recentMoments(entries,3,new Date('2026-10-06T12:00:00Z')).map(e=>e.id),['older-plan','later-plan']);
 assert.deepEqual(entries.map(e=>e.id),['older-plan','later-plan','future','intent']);
});

const dashboardOptions={query:'',maxMinutes:0,setting:'any',gentle:false};
test('dashboard filters intersect free eligible ideas, duration, setting and effort without loosening PINS',()=>{
 const s=emptyState();s.profile.needs=['Physical comfort / accessibility'];
 const eligibleIdeas=catalogue.filter(i=>eligible(i,s,new Date(2026,9,7,12)));
 for(const filter of ['For you','Nearby','Save money','With family','Quick wins','Low energy','Surprise me']){
   assert.ok(dashboardIdeas(eligibleIdeas,filter,s,dashboardOptions).every(i=>i.key==='break-stretch'));
 }
 const options={...dashboardOptions,maxMinutes:10,setting:'indoors',gentle:true};
 const matches=dashboardIdeas(catalogue,'For you',s,options);
 assert.ok(matches.length>0);
 assert.ok(matches.every(i=>isFreeMove(i)&&i.minutes<=10&&!i.outdoor&&i.effort==='gentle'));
 assert.ok(dashboardIdeas(catalogue,'With family',s,dashboardOptions).every(i=>i.category==='family'&&isFreeMove(i)));
 assert.deepEqual(dashboardIdeas(catalogue,'For you',s,{...options,query:'fountain'}).map(i=>i.key),['water-refill-far']);
});
test('dashboard savings use the selected currency and user records, and never bring paid activities into free discovery',()=>{
 const s=emptyState(),idea=catalogue.find(i=>i.key==='break-stretch');
 assert.equal(dashboardIdeas(catalogue,'Save money',s,dashboardOptions).length,0);
 s.entries=[{ideaId:idea.id,status:'completed',currency:'USD',moneyCents:500}];
 assert.equal(dashboardIdeas(catalogue,'Save money',s,dashboardOptions).length,0);
 s.costs=[{ideaId:idea.id,currency:'AUD',usualCents:600,moveCents:100}];
 assert.deepEqual(dashboardIdeas(catalogue,'Save money',s,dashboardOptions).map(i=>i.id),[idea.id]);
 s.profile.currency='USD';
 assert.deepEqual(dashboardIdeas(catalogue,'Save money',s,dashboardOptions).map(i=>i.id),[idea.id]);
});
test('surprise rotates within the current pool and handles zero or one safe option',()=>{
 const pool=catalogue.filter(isFreeMove).slice(0,4),first=pool[0].id;
 assert.equal(surpriseIdeaId([],null,0),null);
 assert.equal(surpriseIdeaId([pool[0]],first,0),first);
 for(const seed of [0,.2,.8,1]){const id=surpriseIdeaId(pool,first,seed);assert.notEqual(id,first);assert.ok(pool.some(i=>i.id===id));}
});
test('dashboard greeting follows local morning, afternoon and evening boundaries',()=>{
 for(const [hour,expected] of [[0,'Good morning'],[11,'Good morning'],[12,'Good afternoon'],[16,'Good afternoon'],[17,'Good evening'],[23,'Good evening']])assert.equal(dashboardGreeting(new Date(2026,9,7,hour)),expected);
});
