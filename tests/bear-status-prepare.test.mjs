// The status card model can never say more than is true; the prepared calendar file is valid and safe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {statusCardModel} from '../lib/bear/engine/status.ts';
import {calendarEventIcs} from '../lib/bear/engine/prepare.ts';
import {responsibilityStates} from '../lib/bear/engine/types.ts';
const base={title:'Year 5 camp',prepared:[{label:'Consent',value:'Sign and return · by 10 Nov',done:false},{label:'Payment',value:'$180 · by 12 Nov',done:true}],bearHandling:['Year 5 camp 18 Nov','Payment $180 due 12 Nov']};

test('every state gets an honest presentation; “All sorted” only for verified or closed WITH evidence',()=>{
 const ev={level:'user_confirmed',method:'user_confirmation'};
 for(const state of responsibilityStates){
  const m=statusCardModel({...base,state,verification:state==='verified'||state==='closed'?ev:null});
  if(state==='cancelled'){assert.equal(m,null);continue;}
  assert.equal(m.kind==='all_sorted',state==='verified'||state==='closed',state);
 }
 assert.notEqual(statusCardModel({...base,state:'verified',verification:null}).kind,'all_sorted','verified without evidence is never “all sorted”');
 for(const state of ['completed_unverified','awaiting_confirmation','executing','planned','waiting','in_progress','identified'])assert.equal(statusCardModel({...base,state}).kind,'on_it',state);
 for(const state of ['ready','awaiting_approval','failed','needs_clarification','blocked'])assert.equal(statusCardModel({...base,state,nextAction:{label:'Consent is due 10 Nov'}}).kind,'need_you',state);
});
test('wording: plain, one clear action, evidence named, no internal words',()=>{
 const need=statusCardModel({...base,state:'awaiting_approval'});assert.equal(need.heading,'Just need you');assert.equal(need.action.label,'Review & approve');
 assert.deepEqual(need.lines,['Consent: Sign and return · by 10 Nov'],'only what is still to do, not what is done');
 const failed=statusCardModel({...base,state:'failed'});assert.deepEqual(failed.lines,['That didn’t go through. Nothing was done.']);assert.equal(failed.action.label,'See what happened');
 const done=statusCardModel({...base,state:'verified',verification:{level:'confirmed',method:'forwarded_email'}});assert.equal(done.heading,'All sorted');assert.match(done.evidence,/email you forwarded/);assert.equal(done.action,null);
 for(const m of [need,failed,done])assert.doesNotMatch(JSON.stringify(m),/awaiting_|_unverified|state/);
});
test('calendar file: valid all-day event, escaped, folded, no invitations',()=>{
 const ics=calendarEventIcs({uid:'ab12-cd',title:'Camp, "Year 5"; bring: sleeping bag',date:'2026-11-18',description:'Line one\nLine two '+'x'.repeat(200),stamp:new Date('2026-11-03T00:00:00Z')});
 assert.match(ics,/^BEGIN:VCALENDAR\r\n/);assert.match(ics,/END:VCALENDAR\r\n$/);assert.match(ics,/DTSTART;VALUE=DATE:20261118\r\n/);assert.match(ics,/DTEND;VALUE=DATE:20261119\r\n/);
 assert.match(ics,/SUMMARY:Camp\\, "Year 5"\; bring: sleeping bag/);assert.match(ics,/DESCRIPTION:Line one\\nLine two/);
 for(const line of ics.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75,'folded: '+line.length);
 assert.ok(!/ATTENDEE|ORGANIZER|METHOD:REQUEST/.test(ics));
 assert.match(calendarEventIcs({uid:'u',title:'Camp',date:'2026-11-18',endDate:'2026-11-20'}),/DTEND;VALUE=DATE:20261121/,'multi-day ends the day after the last day');
 assert.throws(()=>calendarEventIcs({uid:'u',title:'x',date:'18 November'}),/invalid_date/);
 assert.ok(!/uid:.*[<>"]/i.test(calendarEventIcs({uid:'a"<b>',title:'x',date:'2026-11-18'})),'uid can’t inject');
});
