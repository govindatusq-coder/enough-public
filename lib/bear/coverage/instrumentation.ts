import type {BearStore} from '../store/store.ts';
import {responsibilityOf} from './responsibility.ts';

// Responsibility Transferred: an INTERNAL research measure, never a score shown to anyone. For each
// obligation it counts the cognitive operations Bear genuinely performed, backed by real system events
// (extraction, sequencing, reminders held, evidence-backed closure). Delivered reminders don't count as
// monitoring, drafts don't count as sending, and inferred completion doesn't count as closing.
export interface ResponsibilityReport{
 obligations:number;operationsByBear:Record<string,number>;humanOperations:Record<string,number>;
 captures:Record<string,number>;correctionsPerCapture:number;confirmations:Record<string,number>;
 remindersDelivered:number;remindersUnwanted:number;unresolvedPastDue:number;inboundEmails:number;mergedNotices:number;
}
export async function responsibilityReport(store:BearStore,today:string):Promise<ResponsibilityReport>{
 const [tasks,completions,events,captures,corrections,interactions]=await Promise.all([store.list('tasks'),store.list('completions',{limit:1000}),store.list('behaviour_events',{limit:2000}),store.list('captures',{limit:1000}),store.list('user_corrections',{limit:1000}),store.list('reminder_interactions',{limit:2000})]);
 const byBear:Record<string,number>={},human:Record<string,number>={};let obligations=0;
 for(const t of tasks.filter(t=>t.load&&!t.load.migrated&&!t.isDemo)){obligations++;for(const r of responsibilityOf(t.load!)){if(r.performedByBear)byBear[r.operation]=(byBear[r.operation]||0)+1;if(r.humanRequired)human[r.operation]=(human[r.operation]||0)+1;}}
 const capturesBy:Record<string,number>={};for(const c of captures.filter(c=>!c.isDemo))capturesBy[c.method]=(capturesBy[c.method]||0)+1;
 const confirmations:Record<string,number>={};for(const c of completions)confirmations[c.evidence?.level||'unrecorded']=(confirmations[c.evidence?.level||'unrecorded']||0)+1;
 const delivered=events.filter(e=>e.type==='reminder_delivered').length;
 const unwanted=interactions.filter(i=>i.action==='not_important'||i.action==='dismissed').length;
 const unresolved=tasks.filter(t=>t.status==='open'&&!t.isDemo&&t.dueAt&&t.dueAt<today&&t.timing!=='flexible').length;
 const n=Object.values(capturesBy).reduce((a,b)=>a+b,0);
 return {obligations,operationsByBear:byBear,humanOperations:human,captures:capturesBy,correctionsPerCapture:n?Math.round(corrections.length/n*100)/100:0,confirmations,remindersDelivered:delivered,remindersUnwanted:unwanted,unresolvedPastDue:unresolved,
  inboundEmails:events.filter(e=>e.type==='research_signal'&&e.detail.signal==='inbound_email').length,mergedNotices:events.filter(e=>e.type==='coverage_merged').length};
}
