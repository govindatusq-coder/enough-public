import {createHmac} from 'node:crypto';
import type {BearStore} from '../store/store.ts';
import {responsibilityReport} from '../coverage/instrumentation.ts';

// Study-ready, privacy-preserving export. Only for people who opted in to research (profile.research
// consent). Pseudonymous participant id (HMAC of the user id with a study secret, not reversible without
// it). Counts and categories only: no titles, notes, names, children, amounts, dates of events, documents,
// health details or free text. See docs/research/DATA_DICTIONARY.md.
export interface ResearchRow{
 participant:string;studyDay:string;
 responsibilitiesSubmitted:number;interpretedAutomatically:number;needingClarification:number;userCorrections:number;
 remindersDelivered:number;remindersUnwanted:number;actionsPrepared:number;completed:number;verifiedOutcomes:number;
 capturesByMethod:Record<string,number>;operationsBearCarried:Record<string,number>;unresolvedPastDue:number;
}
export const pseudonym=(userId:string,secret:string)=>createHmac('sha256',secret).update(userId).digest('hex').slice(0,16);
export async function researchExport(store:BearStore,secret:string,today:string):Promise<ResearchRow|null>{
 if(!secret||secret.length<16)throw new Error('study_secret_required');
 const profile=(await store.list('profiles',{limit:1}))[0];if(!profile?.research?.consent)return null;
 const r=await responsibilityReport(store,today);
 const tasks=(await store.list('tasks')).filter(t=>t.load&&!t.isDemo);const ext=await store.list('extractions',{limit:2000});
 const events=await store.list('responsibility_events',{limit:5000});
 return {participant:pseudonym(store.userId,secret),studyDay:today,
  responsibilitiesSubmitted:Object.values(r.captures).reduce((a,b)=>a+b,0),interpretedAutomatically:ext.filter(x=>x.status==='verified').length,
  needingClarification:events.filter(e=>e.nextState==='needs_clarification').length,userCorrections:Math.round(r.correctionsPerCapture*Object.values(r.captures).reduce((a,b)=>a+b,0)),
  remindersDelivered:r.remindersDelivered,remindersUnwanted:r.remindersUnwanted,actionsPrepared:events.filter(e=>e.eventType==='action_prepared').length,
  completed:tasks.filter(t=>t.status==='done').length,verifiedOutcomes:(r.confirmations.confirmed||0)+(r.confirmations.user_confirmed||0),
  capturesByMethod:r.captures,operationsBearCarried:r.operationsByBear,unresolvedPastDue:r.unresolvedPastDue};
}
