import {addDays} from '../domain/dates.ts';
import type {Capabilities,LoadGraph,LoadMap,LoadNode,WaitingState} from './types.ts';
import {stepActive} from './action.ts';

// The Waiting Engine. Waiting is a first-class, successful state: Bear holds the open loop.
// Without an integration that can watch for the reply, Bear resurfaces it on a date instead
// of pretending to monitor anything.
const windowDays=(node:LoadNode,map?:LoadMap|null)=>{
 const t=`${node.title} ${node.steps.map(s=>s.waitingFor||'').join(' ')}`.toLowerCase();
 if(/refund/.test(t))return 10;if(/deliver/.test(t))return 7;if(/outcome|application/.test(t))return 21;
 if(node.pattern==='REPAIR_PROBLEM')return map?.learned?.followUpDays??2;
 return map?.learned?.followUpDays??5;
};
export function waitingFor(node:LoadNode,graph:LoadGraph,today:string,caps:Capabilities,map?:LoadMap|null):WaitingState|null{
 const step=node.steps.find(s=>s.owner==='external_system'&&stepActive(s,node,graph));if(!step)return null;
 const started=[...node.evidence.map(e=>e.at.slice(0,10)),graph.createdAt.slice(0,10)].sort().pop()||today;
 const expectedBy=step.dueAt||addDays(started,windowDays(node,map));
 const integrated=/deliver/.test(step.label.toLowerCase())?caps.orderTracking:/debit|renew/.test(step.label.toLowerCase())?caps.payments:caps.email;
 const nextCheckAt=expectedBy<today?today:expectedBy;
 return {waitingFor:step.waitingFor||'them',startedAt:started,expectedBy,monitoringMethod:integrated?'integration':'time_based',nextCheckAt,escalationAt:addDays(nextCheckAt,2)};
}
