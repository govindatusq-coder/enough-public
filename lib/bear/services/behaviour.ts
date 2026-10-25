import {localParts} from '../domain/dates.ts';
import type {BehaviourEvent,BehaviourType} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';

// BehaviourLearningService. Records what the user actually does and derives a few
// probabilistic signals. It optimises for completion and fewer interruptions, never
// for engagement.
export async function recordBehaviour(store:BearStore,type:BehaviourType,detail:Record<string,unknown>={},at=new Date()){
 // Local hour in the person's own zone, so learned reminder timing matches their day.
 const tz=(await store.list('profiles',{limit:1}))[0]?.lifeRhythm?.timezone||undefined;
 const {hour,weekday}=localParts(at,tz);
 return store.insert('behaviour_events',stamp<BehaviourEvent>(store.userId,{type,at:at.toISOString(),hourLocal:hour,weekday,detail}));
}
export interface BehaviourSignals{
 // Per local hour 0–23: a score in [-1,1] where positive means reminders at that hour get acted on.
 hourResponsiveness:number[];
 postponeCountByTask:Record<string,number>;
 rejectedSuggestionKinds:Record<string,number>;
 acceptedSuggestionKinds:Record<string,number>;
 medianMinutesReminderToCompletion:number|null;
 preferredCaptureMethods:Record<string,number>;
 corrections:Record<string,number>;
 sampleSize:number;
}
export async function behaviourSignals(store:BearStore,events?:BehaviourEvent[]):Promise<BehaviourSignals>{
 const rows=events||await store.list('behaviour_events',{orderBy:{column:'at',ascending:false},limit:500});
 const acted=new Array(24).fill(0),ignored=new Array(24).fill(0);
 const postpone:Record<string,number>={},rejected:Record<string,number>={},accepted:Record<string,number>={},capture:Record<string,number>={},corrections:Record<string,number>={};
 const latencies:number[]=[];
 for(const e of rows){
  if(e.type==='reminder_opened'||e.type==='assist_used'||e.type==='task_completed')acted[e.hourLocal]++;
  if(e.type==='reminder_dismissed'||e.type==='reminder_snoozed')ignored[e.hourLocal]++;
  if(e.type==='reminder_snoozed'&&typeof e.detail.taskId==='string')postpone[e.detail.taskId]=(postpone[e.detail.taskId]||0)+1;
  if(e.type==='suggestion_rejected'&&typeof e.detail.kind==='string')rejected[e.detail.kind]=(rejected[e.detail.kind]||0)+1;
  if(e.type==='suggestion_accepted'&&typeof e.detail.kind==='string')accepted[e.detail.kind]=(accepted[e.detail.kind]||0)+1;
  if(e.type==='capture_created'&&typeof e.detail.method==='string')capture[e.detail.method]=(capture[e.detail.method]||0)+1;
  if(e.type==='field_corrected'&&typeof e.detail.field==='string')corrections[e.detail.field]=(corrections[e.detail.field]||0)+1;
  if(e.type==='task_completed'&&typeof e.detail.minutesSinceReminder==='number')latencies.push(e.detail.minutesSinceReminder);
 }
 const hourResponsiveness=acted.map((a,i)=>{const n=a+ignored[i];return n?(a-ignored[i])/n:0;});
 latencies.sort((a,b)=>a-b);
 return {hourResponsiveness,postponeCountByTask:postpone,rejectedSuggestionKinds:rejected,acceptedSuggestionKinds:accepted,medianMinutesReminderToCompletion:latencies.length?latencies[Math.floor(latencies.length/2)]:null,preferredCaptureMethods:capture,corrections,sampleSize:rows.length};
}
