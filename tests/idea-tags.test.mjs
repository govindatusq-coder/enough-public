import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../lib/ideas.ts';
import {emptyState,restore} from '../lib/journey.ts';
import {validateState} from '../lib/account-validation.ts';
import {ideaSchema} from '../lib/idea-validation.ts';
import {intensities,libraryMovementTags,ideaTagLabels} from '../lib/idea-tags.ts';
import {movesIdeas,defaultMoveOptions} from '../lib/moves.ts';

test('all original library ideas have explicit intensity and sitting-break tags without changing their IDs',()=>{
 assert.equal(catalogue.length,44);assert.deepEqual(catalogue.map(i=>i.id),[1,3,4,5,6,7,8,9,10,11,12,0,...Array.from({length:32},(_,n)=>n+14)]);
 for(const idea of catalogue){assert.ok(libraryMovementTags[idea.key]);assert.ok(intensities.includes(idea.intensity));assert.equal(typeof idea.breaksSitting,'boolean');}
 assert.equal(catalogue.find(i=>i.key==='break-stretch').breaksSitting,false);assert.equal(catalogue.find(i=>i.key==='bank-bike').breaksSitting,false);
});
test('untagged legacy AI ideas restore and validate as light movement with no sitting-break claim',()=>{
 const original={...catalogue.find(i=>i.key==='break-stretch'),id:1001,key:'ai-1001',source:'ai',brief:'A familiar seated shoulder pause.'};delete original.intensity;delete original.breaksSitting;
 const parsed=ideaSchema.parse(original);assert.equal(parsed.intensity,'light');assert.equal(parsed.breaksSitting,false);
 const state=emptyState();state.generated=[original];state.saved=[1001];
 const restored=restore(JSON.stringify(validateState(state)));assert.equal(restored.generated[0].intensity,'light');assert.equal(restored.generated[0].breaksSitting,false);assert.deepEqual(restored.saved,[1001]);
 assert.equal(original.intensity,undefined);
});
test('new tag validation rejects false seated breaks, unknown intensities and nonboolean claims',()=>{
 const original={...catalogue.find(i=>i.key==='break-stretch'),id:1001,key:'ai-1001',source:'ai',brief:'A familiar seated shoulder pause.'};
 for(const patch of [{intensity:'extreme'},{breaksSitting:'yes'},{breaksSitting:true},{intensity:null}])assert.throws(()=>ideaSchema.parse({...original,...patch}));
 assert.deepEqual(ideaTagLabels(original),['Light movement']);
});
test('discovery tag filters intersect all other filters and never admit an idea outside the eligible input',()=>{
 const state=emptyState();const walk=catalogue.find(i=>i.key==='call-family-walk'),seated=catalogue.find(i=>i.key==='break-stretch');
 const strength={...walk,id:1001,intensity:'strength',breaksSitting:true},brisk={...walk,id:1002,intensity:'vigorous-burst',breaksSitting:true};
 const pool=[walk,seated,strength,brisk];
 assert.deepEqual(movesIdeas(pool,'Strength',state,defaultMoveOptions),[strength]);assert.deepEqual(movesIdeas(pool,'Brisk burst',state,defaultMoveOptions),[brisk]);
 assert.ok(movesIdeas(pool,'Breaks up sitting',state,defaultMoveOptions).every(i=>i.breaksSitting));
 assert.deepEqual(movesIdeas([seated],'Strength',state,defaultMoveOptions),[]);
 assert.deepEqual(movesIdeas(pool,'Strength',state,{...defaultMoveOptions,setting:'indoors'}),[]);
 assert.deepEqual(movesIdeas(pool,'For you',state,{...defaultMoveOptions,breaksSitting:true,intensity:'strength'}),[strength]);
});
