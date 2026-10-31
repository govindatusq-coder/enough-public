import {patterns} from './patterns.ts';
import type {LoadGraph,LoadNode} from './types.ts';

// The Closure Engine. Every pattern defines what "actually closed" means. A dismissed reminder,
// a sent email, a booked appointment or a placed order never closes anything on its own.
export function evidenceKeys(node:LoadNode,graph:LoadGraph,today:string){
 const keys=new Set(node.evidence.map(e=>e.key));
 const last=node.entities.eventEndDate||node.entities.eventDate;
 // Time is deterministic evidence that a dated event has happened (not that it went well).
 if(last&&last<today&&['SCHOOL_EVENT','INVITATION_EVENT'].includes(node.pattern))keys.add('event_occurred');
 const children=graph.nodes.filter(n=>n.parentId===node.id);
 if(children.every(c=>c.state==='resolved'))keys.add('children_resolved');
 return keys;
}
export function isClosed(node:LoadNode,graph:LoadGraph,today:string){
 const keys=evidenceKeys(node,graph,today);
 if(keys.has('user_resolved'))return true;
 if(node.gate&&node.gate.notNeededIf.some(k=>parentHas(graph,node,k)))return true;
 const c=patterns[node.pattern].closure;return (c.conditionsFor?c.conditionsFor(node.entities):c.conditions).some(set=>set.every(k=>keys.has(k)));
}
export function parentHas(graph:LoadGraph,node:LoadNode,key:string){const p=graph.nodes.find(n=>n.id===node.parentId);return !!p?.evidence.some(e=>e.key===key);}
