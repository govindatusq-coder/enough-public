import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../lib/ideas.ts';
import {confirmedWins,filterMoments,monthCollection,collectionMonths,winMilestones,topWorthwhileMoments,recentWinMonths} from '../lib/wins.ts';

const idea=key=>catalogue.find(i=>i.key===key);
const entry=(id,key,date,overrides={})=>({id,ideaId:idea(key).id,status:'completed',acceptedAt:date.toISOString(),completedAt:date.toISOString(),minutes:10,moneyCents:0,currency:'AUD',outside:false,connecting:false,worthwhile:true,...overrides});
const now=new Date(2026,9,7,12);

test('Wins history includes past confirmations in date order without counting plans, skips or future outcomes',()=>{
 const rows=[entry('older','break-stretch',new Date(2026,9,6)),entry('today','call-family-walk',new Date(2026,9,7,9)),entry('future','break-stretch',new Date(2026,9,7,13)),entry('plan','break-stretch',new Date(2026,9,7,10),{status:'accepted'}),entry('skip','break-stretch',new Date(2026,9,7,8),{status:'not-today'})];
 assert.deepEqual(confirmedWins(rows,now).map(e=>e.id),['today','older']);assert.deepEqual(rows.map(e=>e.id),['older','today','future','plan','skip']);
});

test('moment filters use reported outside and connection, known activity types and explicit worthwhile feedback',()=>{
 const rows=[entry('stretch','break-stretch',new Date(2026,9,7,8),{worthwhile:false}),entry('call','call-family-walk',new Date(2026,9,7,9),{outside:false,connecting:true}),entry('family','playground-laps',new Date(2026,9,6,9),{outside:true}),entry('task','laundry-stairs',new Date(2026,9,7,10),{gave:['task_completed']})];
 const ids=f=>filterMoments(rows,f,'',[],null,now).map(e=>e.id);
 assert.deepEqual(ids('Outside'),['family']);assert.deepEqual(ids('Together'),['call']);assert.deepEqual(ids('With family'),['family']);assert.deepEqual(ids('Everyday tasks'),['task']);assert.deepEqual(ids('Work day'),['stretch']);assert.deepEqual(ids('Worthwhile'),['task','call','family']);
 // An outdoor suggestion is not evidence that the person actually went outside.
 assert.equal(filterMoments(rows,'Outside','call',[],null,now).length,0);
});

test('moment search requires every term and intersects a local calendar day with other filters',()=>{
 const rows=[entry('call','call-family-walk',new Date(2026,9,7,9),{connecting:true,companions:[{id:'mum',name:'Mum',source:'manual',metAt:new Date(2026,9,7,9).toISOString()}]}),entry('podcast','podcast-outside',new Date(2026,9,6,9))];
 assert.deepEqual(filterMoments(rows,'Together','mum world',[],'2026-10-07',now).map(e=>e.id),['call']);
 assert.equal(filterMoments(rows,'All','mum podcast',[],null,now).length,0);assert.equal(filterMoments(rows,'All','mum',[],'2026-10-06',now).length,0);
});

test('calendar collections use local dates, exact month lengths and distinct activity days',()=>{
 const rows=[entry('leap1','break-stretch',new Date(2024,1,29,0)),entry('leap2','break-stretch',new Date(2024,1,29,23,59)),entry('next','break-stretch',new Date(2024,2,1))];
 const month=monthCollection(rows,'2024-02',new Date(2024,2,7,12));assert.equal(month.days.length,29);assert.equal(month.offset,3);assert.equal(month.total,2);assert.equal(month.activeDays,1);assert.equal(month.days[28].count,2);
 const current=monthCollection([entry('today','break-stretch',new Date(2026,9,7,9)),entry('tomorrow','break-stretch',new Date(2026,9,8,9))],'2026-10',now);
 assert.equal(current.days.length,31);assert.equal(current.days[6].today,true);assert.equal(current.days[7].future,true);assert.equal(current.days[7].count,0);
 assert.deepEqual(collectionMonths(rows,new Date(2024,2,7,12)),['2024-03','2024-02']);assert.throws(()=>monthCollection([],'2026-13',now));
});

test('milestones require the first actual qualifying outcome and never create progress from intention',()=>{
 const first=entry('first','break-stretch',new Date(2026,9,1),{worthwhile:false});
 const later=entry('later','call-family-walk',new Date(2026,9,2),{connecting:true,timeCombined:5,moneyCents:800,currency:'USD'});
 const fake=entry('future','call-family-walk',new Date(2026,9,8),{connecting:true,timeCombined:10,moneyCents:1000});
 const milestones=winMilestones([later,first,fake],now);assert.equal(milestones[0].earnedAt,first.completedAt);for(const m of milestones.slice(1))assert.equal(m.earnedAt,later.completedAt);
 assert.ok(winMilestones([{...later,status:'accepted'}],now).every(m=>!m.earnedAt));
 assert.ok(winMilestones([],now).every(m=>!m.earnedAt));
});

test('top moments rank private worthwhile tries, preserve separate currencies and omit negative or future feedback',()=>{
 const rows=[entry('old','call-family-walk',new Date(2026,9,1),{moneyCents:300}),entry('new','call-family-walk',new Date(2026,9,7,9),{moneyCents:900,currency:'USD'}),entry('negative','call-family-walk',new Date(2026,9,7,10),{worthwhile:false,moneyCents:5000}),entry('other','break-stretch',new Date(2026,9,7,11)),entry('future','break-stretch',new Date(2026,9,8))];
 const top=topWorthwhileMoments(rows,now);assert.equal(top[0].worthwhile,2);assert.equal(top[0].entryId,'new');assert.equal(top[0].minutes,20);assert.deepEqual(top[0].money,{USD:900,AUD:300});assert.equal(top[1].worthwhile,1);assert.deepEqual(topWorthwhileMoments([],now),[]);
});

test('monthly history is chronological across years with real zero months and no future counts',()=>{
 const date=new Date(2027,0,5,12),rows=[entry('old','break-stretch',new Date(2026,8,1)),entry('dec','break-stretch',new Date(2026,11,31)),entry('future','break-stretch',new Date(2027,0,6))];
 const history=recentWinMonths(rows,date);assert.deepEqual(history.map(m=>m.key),['2026-09','2026-10','2026-11','2026-12','2027-01']);assert.deepEqual(history.map(m=>m.count),[1,0,0,1,0]);assert.equal(history[4].current,true);
});
