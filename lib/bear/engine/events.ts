import {todayISO} from '../domain/dates.ts';
import type {Task} from '../domain/types.ts';
import {flags} from '../flags.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {summariseExecution} from './execution-summary.ts';
import {checkTransition,stateOf,verificationOf} from './state.ts';
import type {ResponsibilityEvent,ResponsibilityState} from './types.ts';

// The append-only history. Services call syncState after anything meaningful happens; the engine derives
// the real state, validates the transition and appends one event. An impossible jump is recorded as a
// conflict for review, never silently forced.
// The history is a record, never a dependency: if its table isn't there yet (migration not applied) or a
// write fails, the person's action still goes through; the history simply has nothing for that moment.
export async function history(store:BearStore,responsibilityId:string):Promise<ResponsibilityEvent[]>{
 try{return await store.list('responsibility_events',{where:[{column:'responsibility_id',value:responsibilityId}],orderBy:{column:'created_at',ascending:true}});}catch{return [];}
}
export async function lastState(store:BearStore,id:string):Promise<ResponsibilityState|null>{
 const h=(await history(store,id)).filter(e=>e.nextState);return h.length?h[h.length-1].nextState!:null;
}
export async function appendEvent(store:BearStore,e:Omit<ResponsibilityEvent,'id'|'userId'|'createdAt'|'updatedAt'|'at'>&{at?:string}):Promise<ResponsibilityEvent|null>{
 try{return await store.insert('responsibility_events',stamp<ResponsibilityEvent>(store.userId,{...e,at:e.at||new Date().toISOString()}));}catch{return null;}
}
export async function syncState(store:BearStore,taskOrId:Task|string,actor:ResponsibilityEvent['actor']='system',now=new Date()):Promise<ResponsibilityState|null>{
 if(!flags.responsibilityEngine())return null;
 const task=typeof taskOrId==='string'?await store.get('tasks',taskOrId):taskOrId;if(!task)return null;
 const completions=task.status==='done'?await store.list('completions',{where:[{column:'task_id',value:task.id}],orderBy:{column:'completed_at',ascending:false},limit:1}):[];
 const profile=(await store.list('profiles',{limit:1}))[0];
 const exec=flags.executionLayer()?summariseExecution(await history(store,task.id),now):null;
 const next=stateOf(task,completions[0]||null,todayISO(profile?.lifeRhythm?.timezone||'Australia/Sydney',now),exec);
 const prev=await lastState(store,task.id);if(prev===next)return next;
 const verification=next==='verified'?verificationOf(completions[0]):null;
 const check=checkTransition(prev,next,verification);
 await appendEvent(store,{responsibilityId:task.id,eventType:check.ok?(next==='verified'?'verified':'state_changed'):'state_conflict',previousState:prev,nextState:check.ok?next:prev,actor,at:now.toISOString(),
  metadata:{...(verification?{verification}:{}),...(check.ok?{}:{wanted:next,reason:check.reason||null})}});
 return check.ok?next:prev;
}
