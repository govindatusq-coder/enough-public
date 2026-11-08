import type {BearStore} from '../store/store.ts';
import {relayLoadDate} from '../services/load.ts';
import {appendEvent,syncState} from './events.ts';

// A newer document proposed a change to something the person set themselves: their call, either way.
export async function resolveProposal(store:BearStore,taskId:string,accept:boolean,now=new Date()){
 const t=await store.get('tasks',taskId);if(!t)throw new Error('not_found');const p=t.pendingUpdate;if(!p)return t;
 let next=t;
 if(accept&&p.field==='dueAt'){const graph=t.load?await relayLoadDate(store,t,p.to,now):t.load;next=await store.update('tasks',t.id,{dueAt:p.to,load:graph||null,pendingUpdate:null});}
 else next=await store.update('tasks',t.id,{pendingUpdate:null});
 await appendEvent(store,{responsibilityId:t.id,eventType:accept?'update_applied':'state_changed',actor:'user',metadata:{field:p.field,accepted:accept}});
 await syncState(store,t.id,'user',now).catch(()=>null);return next;
}
