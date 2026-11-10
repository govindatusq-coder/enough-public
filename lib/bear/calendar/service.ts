import type {BearStore} from '../store/store.ts';
import {executeAction,requestApproval,decideApproval,type ActionRequest,type ExecAdapter} from '../engine/execution.ts';
import {eventForTask} from '../engine/calendar-event.ts';
import {isConnected,loadTokens,saveTokens} from './accounts.ts';
import {SCOPES,type CalendarConfig} from './config.ts';
import {exchangeCode,GraphCalendarAdapter,refreshTokens,type Fetch} from './graph.ts';

export interface Deps{cfg:CalendarConfig;f:Fetch;env?:Record<string,string|undefined>;now?:Date}
// A valid access token, refreshing when it is about to expire (or after Graph said 401). Throws if not connected.
export function tokenGetter(store:BearStore,d:Deps){
 return async(force:boolean)=>{
  const now=d.now||new Date();const t=await loadTokens(store,d.cfg.tokenKey!);if(!t)throw new Error('not_connected');
  if(!force&&new Date(t.expiresAt).getTime()-now.getTime()>120000)return t.accessToken;
  if(!t.refreshToken)throw new Error('reconnect_needed');
  const next=await refreshTokens(d.cfg,t.refreshToken,d.f,now).catch(()=>{throw new Error('reconnect_needed');});
  await saveTokens(store,{...next,refreshToken:next.refreshToken||t.refreshToken},d.cfg.tokenKey!,[...SCOPES],now);return next.accessToken;
 };
}
export async function completeConnection(store:BearStore,d:Deps,o:{code:string;redirectUri:string;verifier:string}){
 const t=await exchangeCode(d.cfg,o,d.f,d.now);await saveTokens(store,t,d.cfg.tokenKey!,[...SCOPES],d.now);
}

// What Bear would add. Derived from the saved task EVERY time, never from anything the browser sends.
export function calendarRequestFor(task:Parameters<typeof eventForTask>[0]):{request:ActionRequest;summary:{title:string;when:string;where:string}}|{unsupported:'no_event'|'timed'}{
 const ev=eventForTask(task);if(!ev)return {unsupported:'no_event'};
 if(ev.time)return {unsupported:'timed'};
 const details={title:ev.title,date:ev.date,endDate:ev.endDate||null,location:ev.location||null,description:ev.description||null};
 const when=ev.endDate&&ev.endDate!==ev.date?`${ev.date} to ${ev.endDate}, all day`:`${ev.date}, all day`;
 return {request:{responsibilityId:task.id,actionType:'create_calendar_event',details},summary:{title:ev.title,when,where:'Your Outlook calendar'}};
}
export type CalendarResult=
 |{status:'needs_connection'}|{status:'no_event'}|{status:'timed_not_supported';message:string}
 |{status:'needs_approval';summary:{title:string;when:string;where:string}}
 |{status:'done'|'accepted'|'already_done';message:string}
 |{status:'failed'|'unknown'|'not_available';message:string};
export async function requestCalendarAdd(store:BearStore,taskId:string,d:Deps):Promise<CalendarResult>{
 const task=await store.get('tasks',taskId);if(!task)return {status:'no_event'};
 const r=calendarRequestFor(task);
 if('unsupported' in r)return r.unsupported==='timed'?{status:'timed_not_supported',message:'This one has a time, so I can’t add it for you yet. Use Add to calendar and your calendar will set the time.'}:{status:'no_event'};
 if(!(await isConnected(store)))return {status:'needs_connection'};
 await requestApproval(store,r.request,d.now);return {status:'needs_approval',summary:r.summary};
}
export async function approveCalendarAdd(store:BearStore,taskId:string,d:Deps):Promise<CalendarResult>{
 const task=await store.get('tasks',taskId);if(!task)return {status:'no_event'};
 const r=calendarRequestFor(task);if('unsupported' in r)return {status:'no_event'};
 if(!(await isConnected(store)))return {status:'needs_connection'};
 const g=await decideApproval(store,r.request,'grant',d.now);
 // Not asked for these exact details (they changed since): ask again, never act.
 if(!g.ok&&g.reason!=='already_decided')return {status:'needs_approval',summary:r.summary};
 const adapter:ExecAdapter=new GraphCalendarAdapter(d.cfg,tokenGetter(store,d),d.f);
 const out=await executeAction(store,r.request,{adapter,env:d.env,grants:{connected:['calendar'],withdrawn:[]},now:d.now});
 switch(out.status){
  case 'done':return {status:'done',message:'Added to your Outlook calendar. I checked it’s there.'};
  case 'accepted':return {status:'accepted',message:'Sent to your Outlook calendar. I couldn’t check it yet.'};
  case 'already_done':return {status:'already_done',message:'That’s already in your calendar. I haven’t added it twice.'};
  case 'not_available':return {status:'not_available',message:'Calendar isn’t switched on yet.'};
  case 'needs_approval':return {status:'needs_approval',summary:r.summary};
  case 'unknown_outcome':return {status:'unknown',message:out.userMessage};
  default:return {status:'failed',message:'That didn’t go through. Nothing was added. Reconnect your calendar in Settings and try again.'};
 }
}
