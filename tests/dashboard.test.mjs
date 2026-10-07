import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {emptyState,localDate,receipt} from '../lib/journey.ts';
import {dashboardActivity,previousReturns,returnCurrencies,durationLabel,momentDateLabel} from '../lib/dashboard.ts';

function entry(date,overrides={}){
 const at=date.toISOString();
 return {id:at,ideaId:1,status:'completed',acceptedAt:at,completedAt:at,minutes:10,timeCombined:5,moneyCents:400,currency:'AUD',outside:true,connecting:false,worthwhile:true,...overrides};
}

test('dashboard counts actual confirmations in the local day and week, not plans, skipped moves or future entries',()=>{
 const state=emptyState(),now=new Date(2026,9,7,12),beforeMidnight=new Date(2026,9,6,23,59),midnight=new Date(2026,9,7);
 state.entries=[entry(beforeMidnight),entry(midnight),entry(new Date(2026,9,7,11),{minutes:0,worthwhile:false}),entry(new Date(2026,9,7,13)),entry(new Date(2026,9,6,10),{status:'accepted'}),entry(new Date(2026,9,8,10),{status:'accepted'}),entry(new Date(2026,9,7,10),{status:'not-today'})];
 const original=JSON.stringify(state),snapshot=dashboardActivity(state,now);
 assert.equal(snapshot.today,2);assert.equal(snapshot.todayMinutes,10);assert.equal(snapshot.planned,1);
 assert.equal(snapshot.month,3);assert.equal(snapshot.activeDays,2);assert.equal(snapshot.worthwhile,2);
 assert.equal(snapshot.days[0].label,'Mon');assert.equal(snapshot.days[0].date,localDate(new Date(2026,9,5)));
 assert.equal(snapshot.days[1].count,1);assert.equal(snapshot.days[2].count,2);assert.equal(snapshot.days[2].today,true);
 assert.ok(snapshot.days.slice(3).every(d=>d.future&&d.count===0));
 assert.equal(JSON.stringify(state),original);
});

test('PINS readiness counts neutral and written answers and accepts irregular life routines',()=>{
 const state=emptyState();
 Object.assign(state.profile,{preferences:['Nothing to add'],interests:['Something else: Craft'],needs:['Nothing to add'],strengths:['Nothing to add'],activity:'Every day is different',rhythms:['No regular routine'],window:'It varies'});
 const snapshot=dashboardActivity(state,new Date(2026,9,7,12));
 assert.equal(snapshot.pinsAnswered,4);assert.equal(snapshot.routinesAnswered,3);
 state.profile.strengths=[];state.profile.window='';
 assert.equal(dashboardActivity(state).pinsAnswered,3);assert.equal(dashboardActivity(state).routinesAnswered,2);
});

test('return currency options come from confirmed history and money stays separate from cross-currency activity',()=>{
 const state=emptyState(),now=new Date(2026,9,7,12);
 state.entries=[entry(new Date(2026,9,7,9)),entry(new Date(2026,9,7,10),{currency:'USD',moneyCents:800}),entry(new Date(2026,9,7,11),{currency:'NZD',status:'accepted'}),entry(new Date(2026,9,8,10),{currency:'GBP'})];
 assert.deepEqual(returnCurrencies(state,now),['AUD','USD']);
 assert.equal(receipt(state.entries,'This month','AUD',now).money,400);
 assert.equal(receipt(state.entries,'This month','USD',now).money,800);
 assert.equal(receipt(state.entries,'This month','AUD',now).rows.length,2);
});

test('previous returns use full labelled calendar periods across year, leap-month and Monday boundaries',()=>{
 const cases=[
   ['This month',new Date(2027,0,5,12),new Date(2026,11,1),new Date(2026,11,31,23,59),new Date(2027,0,1),'Last month'],
   ['This month',new Date(2024,2,31,12),new Date(2024,1,1),new Date(2024,1,29,23,59),new Date(2024,2,1),'Last month'],
   ['This week',new Date(2026,9,7,12),new Date(2026,8,28),new Date(2026,9,4,23,59),new Date(2026,9,5),'Last week'],
   ['Today',new Date(2026,9,7,12),new Date(2026,9,6),new Date(2026,9,6,23,59),new Date(2026,9,7),'Yesterday']
 ];
 for(const [period,now,start,last,end,label] of cases){
   const rows=[entry(start),entry(last),entry(end,{moneyCents:2000}),entry(start,{currency:'USD',moneyCents:3000}),entry(last,{status:'accepted'}),entry(new Date(start.getTime()-1),{moneyCents:1000})];
   assert.deepEqual(previousReturns(rows,period,'AUD',now),{label,money:800});
 }
 assert.equal(previousReturns([],'This month','AUD'),null);
 assert.equal(previousReturns([entry(new Date(2026,9,1))],'All time','AUD'),null);
});

test('relative moment labels count calendar days across daylight saving rather than elapsed 24-hour blocks',()=>{
 const moduleUrl=new URL('../lib/dashboard.ts',import.meta.url).href;
 const output=execFileSync(process.execPath,['--input-type=module','-e',`import {momentDateLabel} from ${JSON.stringify(moduleUrl)};process.stdout.write(momentDateLabel(new Date(2026,9,3,23,50).toISOString(),new Date(2026,9,5,0,10)));`],{env:{...process.env,TZ:'Australia/Sydney'},encoding:'utf8'});
 assert.equal(output,'2 days ago');
 assert.equal(momentDateLabel(new Date(2026,9,7,8).toISOString(),new Date(2026,9,7,12)),'Today');
 assert.equal(momentDateLabel(new Date(2026,9,6,23,59).toISOString(),new Date(2026,9,7,0,1)),'Yesterday');
});

test('reported movement duration shows hours without adding or rounding minutes',()=>{
 assert.equal(durationLabel(0),'0 min');assert.equal(durationLabel(59),'59 min');
 assert.equal(durationLabel(60),'1h');assert.equal(durationLabel(978),'16h 18m');
});
