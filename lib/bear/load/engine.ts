import {addDays,addMonths} from '../domain/dates.ts';
import {minimumHumanAction,stepActive,humanCandidates} from './action.ts';
import {isClosed,evidenceKeys} from './closure.ts';
import {extractEntities,normaliseText} from './extract.ts';
import {buildGraph,buildNode} from './graph.ts';
import {applyOwnership} from './ownership.ts';
import {recognise,type Recognition} from './recognise.ts';
import type {Capabilities,LoadEntities,LoadGraph,LoadMap,LoadNode,LoadState,LoadStep,PatternId} from './types.ts';
import {waitingFor} from './waiting.ts';
import {usualProvider} from './loadmap.ts';

// The Load Pattern Engine, end to end:
// input → extraction → recognition → composite detection → decomposition → Load Map
// personalisation → ownership → minimum human action → state. Deterministic throughout;
// an AI reading, when there is one, only contributes entities and a kind hint.
export interface UnderstandInput{text:string;today:string;title?:string|null;kindHint?:string|null;entities?:LoadEntities|null;caps:Capabilities;loadMap?:LoadMap|null;forcePattern?:PatternId|null;
 // A line from a list the person wrote themselves: if it is not a known pattern it is simply a to-do.
 asTodo?:boolean}
export interface Understood{graph:LoadGraph;recognition:Recognition}

const PLAIN_TODO=/^(?:i need to |need to |must |have to |remember to |don'?t forget to )?(return|call|ring|phone|email|text|message|send|post|drop off|pick up|collect|clean|tidy|wash|book|cancel|organise|organize|sort out|ask|tell|take|bring|fix|write|finish|print|sign|change|move|update|check)\b/i;
const DATE_KEYS=new Set<keyof LoadEntities>(['dueDate','eventDate','eventEndDate','rsvpDate','expiryDate']);
export function mergeEntities(base:LoadEntities,extra?:LoadEntities|null):LoadEntities{
 if(!extra)return base;const out:LoadEntities={...base};
 for(const [k,v] of Object.entries(extra) as [keyof LoadEntities,unknown][]){if(v===null||v===undefined||(Array.isArray(v)&&!v.length))continue;
  // Dates the words state explicitly ("due Friday", "17–19 November") beat the reader's single summary date.
  if(DATE_KEYS.has(k)&&base[k])continue;
  if(k==='flags')out.flags=[...new Set([...(base.flags||[]),...(v as string[])])];else (out as Record<string,unknown>)[k]=v;}
 return out;
}

// Each pattern reads an unlabelled date its own way: a bill's date is when it's due, a renewal's
// is when it expires, an appointment's is when it happens.
export function normaliseEntities(pattern:PatternId,e:LoadEntities):LoadEntities{
 const one=e.dueDate||e.eventDate||e.expiryDate||e.rsvpDate||null;
 switch(pattern){
  case 'BILL_PAYMENT':case 'FORM_APPLICATION':case 'PURCHASE_REQUIRED':case 'REPLENISHMENT':case 'WAITING_FOR_RESPONSE':return {...e,dueDate:e.dueDate||(pattern==='BILL_PAYMENT'||pattern==='WAITING_FOR_RESPONSE'?one:e.dueDate||null)};
  case 'RENEWAL':return {...e,expiryDate:e.expiryDate||one};
  case 'APPOINTMENT':case 'SCHOOL_EVENT':case 'INVITATION_EVENT':return {...e,eventDate:e.eventDate||(e.dueDate&&!e.rsvpDate&&pattern!=='SCHOOL_EVENT'?e.dueDate:e.eventDate||null)};
  default:return e;
 }
}
export function understand(input:UnderstandInput):Understood{
 const text=normaliseText(input.text);
 let entities=mergeEntities(extractEntities(text,input.today),input.entities);
 let recognition=recognise(text,entities,input.kindHint);
 if(input.forcePattern)recognition={...recognition,primary:input.forcePattern,confidence:Math.max(recognition.confidence,0.9)};
 entities=normaliseEntities(recognition.primary,entities);
 // Learned: the tradie or clinic they keep using becomes the default suggestion.
 const usual=usualProvider(input.loadMap,recognition.primary);if(usual&&!entities.provider)entities={...entities,provider:usual};
 let graph=buildGraph(recognition,entities,{text,today:input.today,title:input.title,loadMap:input.loadMap});
 // A plain to-do ("Return the library books by Friday") is already clear: it is something to get
 // done. Asking "what would make this feel sorted?" would only add friction.
 if(recognition.primary==='UNKNOWN_LOAD'&&(input.asTodo||PLAIN_TODO.test(text.trim()))){const p=graph.nodes[0];graph=applyAction(recompute(graph,input.today,input.caps,input.loadMap),{stepId:`${p.id}:clarify`,evidence:'clarified:Get something done'},input.today,input.caps,input.loadMap).graph;}
 return {graph:recompute(graph,input.today,input.caps,input.loadMap),recognition};
}

function nodeState(node:LoadNode,graph:LoadGraph,today:string):LoadState{
 if(isClosed(node,graph,today))return 'resolved';
 if(node.clarification&&!node.evidence.some(e=>e.key==='clarified'))return 'captured';
 const active=node.steps.filter(s=>stepActive(s,node,graph));
 if(active.some(s=>s.key.startsWith('need_')))return 'captured';
 if(active.some(s=>s.owner==='human'&&(!s.surfaceFrom||s.surfaceFrom<=today)))return 'needs_user';
 if(active.some(s=>s.owner==='external_system'))return 'waiting';
 return 'covered';
}

export function recompute(graph:LoadGraph,today:string,caps:Capabilities,map?:LoadMap|null):LoadGraph{
 const g:LoadGraph={...graph,nodes:graph.nodes.map(n=>applyOwnership(n,caps,map))};
 // Children first: a parent's closure can depend on them.
 const order=[...g.nodes].sort((a,b)=>(a.role==='attached'?0:1)-(b.role==='attached'?0:1));
 for(const n of order){
  const ev=new Set(n.evidence.map(e=>e.key));
  n.steps=n.steps.map(s=>s.status==='pending'&&s.skipIf.some(k=>ev.has(k))?{...s,status:'skipped'}:s);
  const keys=evidenceKeys(n,g,today);
  if(keys.has('event_occurred'))n.steps=n.steps.map(s=>s.key==='happen'&&s.status==='pending'?{...s,status:'done'}:s);
  n.state=nodeState(n,g,today);
  n.resolvedAt=n.state==='resolved'?(n.resolvedAt||new Date().toISOString()):null;
  n.waiting=n.state==='waiting'?waitingFor(n,g,today,caps,map):null;
 }
 return {...g,updatedAt:new Date().toISOString()};
}

export function graphState(graph:LoadGraph):LoadState{
 const primary=graph.nodes.find(n=>n.id===graph.primaryId)!;
 if(primary.state==='resolved')return 'resolved';
 const states=graph.nodes.filter(n=>n.state!=='resolved').map(n=>n.state);
 if(states.includes('captured')&&primary.state==='captured')return 'captured';
 if(states.includes('needs_user')||states.includes('captured'))return 'needs_user';
 if(states.includes('waiting'))return 'waiting';
 return 'covered';
}

// ---------- Acting on a load ----------
export interface ActionInput{stepId:string;evidence?:string|null}
export interface ActionResult{graph:LoadGraph;said:string;unknownChoice?:string|null}
const spawnable:Record<string,{pattern:PatternId;flags:string[];title:(t:string)=>string;parentEvidence?:string}>={
 follow_up_needed:{pattern:'APPOINTMENT',flags:['needs_booking'],title:t=>`Follow-up for ${t.toLowerCase()}`,parentEvidence:'outcome_captured'},
 needs_return:{pattern:'PURCHASE_REQUIRED',flags:['return'],title:t=>`Return ${t.toLowerCase()}`},
 query_raised:{pattern:'WAITING_FOR_RESPONSE',flags:[],title:()=>'Reply about the bill'},
 plan_requested:{pattern:'WAITING_FOR_RESPONSE',flags:[],title:()=>'Payment plan reply'},
};

export function applyAction(graph:LoadGraph,input:ActionInput,today:string,caps:Capabilities,map?:LoadMap|null):ActionResult{
 const g:LoadGraph=structuredClone(graph);const at=new Date().toISOString();
 // The one clarification for an unknown load.
 if(input.stepId.endsWith(':clarify')){
  const node=g.nodes.find(n=>input.stepId.startsWith(n.id))!;const choice=(input.evidence||'').replace(/^clarified:/,'');
  node.evidence.push({key:'clarified',at,source:'user'});
  const add=(key:string,label:string,owner:LoadStep['owner'],human:LoadStep['human'],cta:string|null,evidence:string|null,extra:Partial<LoadStep>={})=>node.steps.push({id:`${node.id}:${key}`,key,label,cta,operation:owner==='external_system'?'monitor':'decide',owner,human,dependsOn:[],status:'pending',dueAt:node.entities.dueDate||null,surfaceFrom:null,waitingFor:null,evidence,degraded:null,choices:null,doneText:'All sorted. Off your mind.',requiresEvidence:null,skipIf:[],labelIf:[],...extra});
  const t=node.title.charAt(0).toLowerCase()+node.title.slice(1);
  if(choice==='Make a decision')add('decide',`Decide about ${t}`,'human','decision','Decided','user_resolved');
  else if(choice==='Arrange something')add('arrange',`Arrange ${t}`,'human','physical','Arranged','user_resolved');
  else if(choice==='Get something done')add('do',node.title,'human','physical','Done','user_resolved');
  else if(choice==='Wait for someone'){add('wait','Waiting to hear back','external_system',null,null,null,{waitingFor:'them',dueAt:node.entities.dueDate||addDays(today,5)});add('heard',`Heard back about ${t}?`,'human','confirmation','Yes, it’s sorted','user_resolved',{surfaceFrom:node.entities.dueDate||addDays(today,5)});}
  return {graph:recompute(g,today,caps,map),said:choice==='Something else'?'Got it. Bear will hold onto it.':'Got it. Bear has the shape of it now.',unknownChoice:choice};
 }
 const node=g.nodes.find(n=>n.steps.some(s=>s.id===input.stepId));if(!node)throw new Error('step_not_found');
 const step=node.steps.find(s=>s.id===input.stepId)!;
 const chosen=input.evidence&&step.choices?.some(c=>c.evidence===input.evidence)?input.evidence:null;
 const key=chosen||step.evidence;
 if(chosen==='still_waiting'){step.surfaceFrom=addDays(today,map?.learned?.followUpDays??5);node.evidence.push({key:'still_waiting',at,source:'user'});return {graph:recompute(g,today,caps,map),said:`No problem. Bear will check again ${step.surfaceFrom}.`};}
 step.status='done';
 if(key)node.evidence.push({key,at,source:'user'});
 if(key==='resubmit_needed'||key==='resubmitting'){const sub=node.steps.find(s=>s.key==='submit');if(sub)sub.status='pending';}
 if(key==='switch_provider'){const c=node.steps.find(s=>s.key==='contact');if(c)c.status='pending';}
 if(key==='renewal_confirmed'){const exp=node.entities.expiryDate||node.entities.dueDate;if(exp){node.entities={...node.entities,expiryDate:addMonths(exp,12)};node.evidence.push({key:'next_expiry_recorded',at,source:'system'});}
  else node.steps.push({id:`${node.id}:next_expiry`,key:'next_expiry',label:'When does it next expire?',cta:'Add it',operation:'remember',owner:'human',human:'information',dependsOn:[],status:'pending',dueAt:null,surfaceFrom:null,waitingFor:null,evidence:'next_expiry_recorded',degraded:null,choices:null,doneText:'Noted. Bear will bring it back next time.',requiresEvidence:null,skipIf:[],labelIf:[]});}
 if(key==='supply_restored'&&node.pattern==='REPLENISHMENT'){const days=node.entities.flags?.includes('medication')?28:node.entities.flags?.includes('bulk')?60:14;node.entities={...node.entities,dueDate:addDays(today,days)};}
 const spawn=key?spawnable[key]:undefined;
 if(spawn){if(spawn.parentEvidence)node.evidence.push({key:spawn.parentEvidence,at,source:'user'});
  const child=buildNode(spawn.pattern,{flags:spawn.flags,provider:node.entities.provider,person:node.entities.person,items:node.entities.items},{title:spawn.title(node.title),text:'',today,role:'attached',parentId:node.id,confidence:1,loadMap:map});
  g.nodes.push(child);}
 const said=step.doneText||'Done.';
 return {graph:recompute(g,today,caps,map),said};
}

export function markResolved(graph:LoadGraph,today:string,caps:Capabilities,map?:LoadMap|null):LoadGraph{
 const g:LoadGraph=structuredClone(graph);const at=new Date().toISOString();
 for(const n of g.nodes)if(n.state!=='resolved')n.evidence.push({key:'user_resolved',at,source:'user'});
 return recompute(g,today,caps,map);
}
export {minimumHumanAction,humanCandidates};

// New facts (a date the person added, a corrected amount): rebuild the node's plan from its
// pattern with the new entities, keeping everything already done and every piece of evidence.
export function withEntities(graph:LoadGraph,nodeId:string,patch:LoadEntities,today:string,caps:Capabilities,map?:LoadMap|null,title?:string):LoadGraph{
 const g:LoadGraph=structuredClone(graph);const i=g.nodes.findIndex(n=>n.id===nodeId);if(i<0)return graph;const old=g.nodes[i];
 const fresh=buildNode(old.pattern,{...old.entities,...patch},{title:title??old.title,text:'',today,role:old.role,parentId:old.parentId,confidence:old.confidence,loadMap:map,gate:old.gate,id:old.id});
 fresh.steps=fresh.steps.map(s=>{const prev=old.steps.find(o=>o.key===s.key);return prev?{...s,status:prev.status,surfaceFrom:prev.status==='pending'&&prev.surfaceFrom&&prev.surfaceFrom>(s.surfaceFrom||'')&&prev.key==='heard'?prev.surfaceFrom:s.surfaceFrom}:s;});
 // Extra steps added along the way (a follow-up, the next expiry) carry over too.
 // Their dates follow the load's date when they were tied to it.
 for(const s of old.steps)if(!fresh.steps.some(f=>f.key===s.key)&&!s.key.startsWith('need_'))fresh.steps.push(s.dueAt===(old.entities.dueDate??null)&&patch.dueDate!==undefined?{...s,dueAt:patch.dueDate??null}:s);
 g.nodes[i]={...fresh,evidence:old.evidence,clarification:old.clarification,resolvedAt:old.resolvedAt};
 return recompute(g,today,caps,map);
}
// Which date a node is missing, or naturally means, when the person sets "the date".
export function dateEntityFor(node:LoadNode):keyof LoadEntities{
 const need=node.steps.find(s=>s.status==='pending'&&s.key.startsWith('need_'));if(need)return need.key.slice(5) as keyof LoadEntities;
 return node.pattern==='RENEWAL'?'expiryDate':['APPOINTMENT','SCHOOL_EVENT','INVITATION_EVENT'].includes(node.pattern)?'eventDate':'dueDate';
}
