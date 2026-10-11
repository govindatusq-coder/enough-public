import test from 'node:test';
import assert from 'node:assert/strict';
import {reelItems,nextReelId,swipeDirection} from '../lib/suggestion-reels.ts';

test('reels retain the discovery selection and order when recommendation scores change',()=>{
 const items=[3,1,5,2,4].map(id=>({idea:{id}}));
 assert.deepEqual(reelItems(items,[1,2,3,2]).map(item=>item.idea.id),[1,2,3]);
 assert.deepEqual(reelItems(items,null),items);
});
test('reels immediately remove ideas that no longer clear current needs without admitting other filters',()=>{
 const items=[4,2,5].map(id=>({idea:{id}}));
 assert.deepEqual(reelItems(items,[1,2,3]).map(item=>item.idea.id),[2]);
 assert.deepEqual(reelItems(items,[]),[]);
});
test('next and previous suggestions never wrap to repeat the completed selection',()=>{
 assert.equal(nextReelId([1,2,3],2,1),3);
 assert.equal(nextReelId([1,2,3],2,-1),1);
 assert.equal(nextReelId([1,2,3],3,1),null);
 assert.equal(nextReelId([1,2,3],1,-1),null);
 assert.equal(nextReelId([],1,1),null);
});
test('only deliberate vertical swipes change suggestions, allowing horizontal and small movements',()=>{
 assert.equal(swipeDirection(10,-90),1);
 assert.equal(swipeDirection(0,90),-1);
 assert.equal(swipeDirection(100,-80),0);
 assert.equal(swipeDirection(5,20),0);
});
