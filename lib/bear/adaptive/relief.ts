// Adaptive Responsibility Engine: relief-based reinforcement. Bear recognises real outcomes (something finished, prepared,
// accepted by someone else, resolved, safely watched, progress kept, rest chosen), never activity (opening the app, days in
// a row, tasks captured). Each event says where it came from and whether it is verified. Feedback is gentle, truthful and not
// repeated; Bear never estimates time saved or load reduced without a basis for it.
import type {BearStore} from '../store/store.ts';
import {recordBehaviour} from '../services/behaviour.ts';
import {ensureProfile} from '../services/profile.ts';
import {learnTiming} from './learning.ts';
import {dominant,type TemporalProfile} from './profile.ts';

export const RELIEF_EVENTS=['responsibility_captured','information_prepared','decision_simplified','dependency_resolved','ownership_accepted',
 'responsibility_completed','monitoring_established','progress_preserved','recovery_chosen'] as const;
export type ReliefEvent=typeof RELIEF_EVENTS[number];
export type Verification='user_confirmed'|'recipient_confirmed'|'system_record'|'unverified';
export interface ReliefDetail{event:ReliefEvent;taskId:string|null;source:string;verified:Verification;visible:boolean;count?:number}

export async function recordRelief(store:BearStore,d:ReliefDetail,now=new Date()){
 try{
  await recordBehaviour(store,'relief',{...d},now);
  // Finishing something also teaches Bear when she tends to get things done (timing learning, her local hour).
  if(d.event==='responsibility_completed'){const p=await ensureProfile(store);const tz=p.lifeRhythm.timezone||'Australia/Sydney';
   const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:tz,hour:'numeric',hourCycle:'h23'}).format(now));
   await store.update('profiles',p.id,{adaptive:learnTiming(p.adaptive,hour)});}
 }catch{/* recognising relief never blocks the thing itself */}
}
// The words for a genuine state change, suited to how her days work. Only ever said when the event really happened.
export function reliefMessage(event:ReliefEvent,ctx:{profile?:TemporalProfile|null;who?:string|null;early?:boolean}={}):string{
 const d=dominant(ctx.profile);
 switch(event){
  case 'responsibility_completed':
   if(ctx.early&&d==='planner')return 'Sorted, ahead of time.';
   return d==='planner'?'That’s sorted.':d==='juggler'?'Done, and off your list.':d==='improviser'?'That’s one less thing to deal with.':d==='oncall'?'That’s one less thing to carry.':'One less thing on your mind.';
  case 'ownership_accepted':return `${ctx.who||'They'} said yes. You don’t need to organise it yourself.`;
  case 'information_prepared':return 'Bear has got this ready for you.';
  case 'monitoring_established':return 'Bear is keeping an eye on this, so you don’t have to.';
  case 'progress_preserved':return 'Your place is saved.';
  case 'dependency_resolved':return 'That’s no longer held up.';
  case 'recovery_chosen':return 'Enjoy it. Everything else can wait.';
  default:return 'Done.';
 }
}
// A plain summary for "What Bear has learned" and research (counts only, never her words).
export async function reliefSummary(store:BearStore,since:Date){
 const ev=(await store.list('behaviour_events',{where:[{column:'type',value:'relief'},{column:'at',op:'gte',value:since.toISOString()}],limit:2000}));
 const out:Record<string,number>={};for(const e of ev){const k=String((e.detail as {event?:string}).event||'');if(k)out[k]=(out[k]||0)+1;}return out;
}
