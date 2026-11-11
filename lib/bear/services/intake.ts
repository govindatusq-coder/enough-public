import {todayISO} from '../domain/dates.ts';
import {decide} from '../engine/decide.ts';
import {applyConfirmationDetailed} from '../inbound/process.ts';
import {findAmounts,findDates} from '../load/extract.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';

// What to do with something the person just gave Bear, BEFORE it becomes a to-do. Four honest answers:
//  confirmed: it is a receipt/confirmation for something Bear is tracking, so it resolves that (with the receipt as evidence);
//  info:      a received message that asks nothing of them (thanks, news): Bear says so and offers "keep it anyway", so nothing is lost silently;
//  unclear:   too little to act on ("see attached"): Bear says so instead of inventing a task;
//  proceed:   everything else, as before.
// The "info" rule is deliberately narrow (it needs an information marker as well as the decision layer's IGNORE) so a person's own
// note ("buy milk", "call the plumber") is never dismissed.
export type Intake={kind:'proceed'}|{kind:'confirmed';taskId:string;title:string;evidence:string}|{kind:'info';receipt:boolean}|{kind:'unclear'};
const INFO_MARKER=/\b(thank(?:s| you)|congratulations|well done|newsletter|we hope|hope you|enjoy|happy (?:birthday|new year|easter|diwali|eid)|wonderful|fantastic|great (?:start|day|job)|photos? (?:are|is|from)|just a (?:quick )?(?:note|update) to say)\b/i;
const ACTION=/\b(please|need|needs|must|should|remember|don'?t forget|due|deadline|return|bring|pay|book|sign|submit|buy|call|send|order|renew|collect|pick up|rsvp|reply|register)\b/i;
// An actual request, for the receipt check ("thank you for your order" is not one).
const ASKS=/\b(please|need to|must|should|don'?t forget|remember to|due by|deadline)\b/i;
const THIN=/^(?:(?:re|fw|fwd):|(?:see|pls see|please see|fyi|forwarded|attached|look at|check this)\b|\.\.\.)/i;
export async function intake(store:BearStore,text:string|null,hasFile:boolean,now=new Date()):Promise<Intake>{
 const t=(text||'').replace(/\s+/g,' ').trim();if(!t)return {kind:'proceed'};
 const done=await applyConfirmationDetailed(store,t,now,'receipt');if(done)return {kind:'confirmed',...done};
 if(hasFile)return {kind:'proceed'};
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const words=t.split(' ').filter(Boolean).length;const hasFacts=findDates(t,today).length>0||findAmounts(t).length>0;
 // Too thin: pointers like "see attached", or nothing readable at all. A short note of the person's own ("buy milk") is NOT thin.
 if(!/[A-Za-z0-9]/.test(t)||(!hasFacts&&words<=6&&THIN.test(t)))return {kind:'unclear'};
 const d=decide(t);
 if(!hasFacts&&t.length>=40&&d.decision==='IGNORE'&&INFO_MARKER.test(t)&&!ACTION.test(t))return {kind:'info',receipt:false};
 // A receipt for something Bear isn't tracking: say so instead of making a to-do out of it.
 if(d.decision==='CLOSE'&&!/cancel/i.test(t)&&!ASKS.test(t))return {kind:'info',receipt:true};
 return {kind:'proceed'};
}
