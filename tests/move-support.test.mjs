import test from 'node:test';
import assert from 'node:assert/strict';
import {newPlan,planError,calendarEvent} from '../lib/move-support.ts';
import {emptyState,restore} from '../lib/journey.ts';
test('open goals do not impose a SMART target',()=>{assert.equal(planError(newPlan(0)),'');});
test('SMART goals require measurable, meaningful, achievable and dated fields',()=>{let p={...newPlan(1),goalType:'smart'};assert.ok(planError(p));Object.assign(p,{target:'One five-minute call',reason:'Connect with family',deadline:'2099-01-01T09:00',confidence:'This feels manageable'});assert.equal(planError(p),'');});
test('reminders need a future time and calendar preserves escaped text and UTC timing',()=>{let p={...newPlan(0),reminder:'calendar',remindAt:'2000-01-01T09:00'};assert.ok(planError(p));p.remindAt='2099-01-01T09:00';p.goal='A call, a walk; then\na rest';assert.equal(planError(p),'');const ics=calendarEvent(p,'My move','test-id');assert.ok(ics.includes('BEGIN:VALARM'));assert.ok(ics.includes('A call\\, a walk\\; then\\na rest'));assert.ok(ics.includes('DTSTART:'+new Date(p.remindAt).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')));});
test('old profiles and per-move plans both restore',()=>{let s=emptyState();assert.deepEqual(restore(JSON.stringify(s)),s);s.entries=[{id:'one',ideaId:0,status:'accepted',acceptedAt:new Date().toISOString(),currency:'AUD',support:newPlan(0)}];assert.deepEqual(restore(JSON.stringify(s)).entries[0].support,newPlan(0));});
