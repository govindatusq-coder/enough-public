import {capabilityTable} from '../coverage/capabilities.ts';
import type {CapabilityKey} from '../coverage/types.ts';

// ACT: the action capability registry. Before Bear proposes or performs anything, it checks here.
// Category A (safe, internal) may run automatically; B needs the person's permission and a connected
// integration; C (money, legal, sensitive, third parties) needs explicit confirmation AND safeguards, and
// none are implemented today. Results say exactly what happened: "ready to review" is never "sent".
export type CapabilityState='AVAILABLE'|'REQUIRES_CONFIGURATION'|'REQUIRES_INTEGRATION'|'NOT_SUPPORTED'|'FAILED';
export type ActionType='classify'|'detect_duplicates'|'plan'|'organise'|'prioritise'|'draft_message'|'set_reminder'|'create_calendar_event'|'send_message'|'share_information'|'assign_member'|'make_payment'|'make_purchase'|'submit_form'|'book_appointment'|'contact_provider';
export interface ActionCapability{actionType:ActionType;category:'A'|'B'|'C';available:boolean;state:CapabilityState;integrationRequired:boolean;requiresUserApproval:boolean;riskLevel:'low'|'medium'|'high';supportsVerification:boolean;needs:CapabilityKey}
const DEFS:{t:ActionType;c:'A'|'B'|'C';needs:CapabilityKey;integration:boolean;risk:'low'|'medium'|'high';verify:boolean}[]=[
 {t:'classify',c:'A',needs:'extract',integration:false,risk:'low',verify:false},{t:'detect_duplicates',c:'A',needs:'extract',integration:false,risk:'low',verify:false},
 {t:'plan',c:'A',needs:'decompose',integration:false,risk:'low',verify:false},{t:'organise',c:'A',needs:'store',integration:false,risk:'low',verify:false},
 {t:'prioritise',c:'A',needs:'prioritise',integration:false,risk:'low',verify:false},{t:'draft_message',c:'A',needs:'draft',integration:false,risk:'low',verify:false},
 {t:'set_reminder',c:'A',needs:'remind',integration:false,risk:'low',verify:false},
 {t:'create_calendar_event',c:'B',needs:'calendar',integration:true,risk:'medium',verify:true},{t:'send_message',c:'B',needs:'contact_external',integration:true,risk:'medium',verify:true},
 {t:'share_information',c:'B',needs:'contact_external',integration:true,risk:'medium',verify:true},{t:'assign_member',c:'B',needs:'store',integration:false,risk:'medium',verify:true},
 {t:'make_payment',c:'C',needs:'pay',integration:true,risk:'high',verify:true},{t:'make_purchase',c:'C',needs:'pay',integration:true,risk:'high',verify:true},
 {t:'submit_form',c:'C',needs:'submit_forms',integration:true,risk:'high',verify:true},{t:'book_appointment',c:'B',needs:'book',integration:true,risk:'medium',verify:true},
 {t:'contact_provider',c:'C',needs:'contact_external',integration:true,risk:'high',verify:true},
];
// Integrations the person connected (none exist today) and any whose permission they withdrew.
export interface IntegrationGrants{connected:string[];withdrawn:string[];householdEnabled?:boolean}
export function registry(env:Record<string,string|undefined>=process.env,grants:IntegrationGrants={connected:[],withdrawn:[]}):ActionCapability[]{
 const caps=capabilityTable(env);
 return DEFS.map(d=>{const cap=caps.find(c=>c.key===d.needs);const implemented=!!cap?.implemented;const enabled=!!cap?.enabled;
  const granted=!d.integration||(grants.connected.includes(d.needs)&&!grants.withdrawn.includes(d.needs));
  const householdOk=d.t!=='assign_member'||!!grants.householdEnabled;
  const state:CapabilityState=!implemented||!householdOk?'NOT_SUPPORTED':!enabled?'REQUIRES_CONFIGURATION':!granted?'REQUIRES_INTEGRATION':'AVAILABLE';
  return {actionType:d.t,category:d.c,available:state==='AVAILABLE',state,integrationRequired:d.integration,requiresUserApproval:d.c!=='A',riskLevel:d.risk,supportsVerification:d.verify,needs:d.needs};});
}
export const capability=(t:ActionType,env?:Record<string,string|undefined>,grants?:IntegrationGrants)=>registry(env,grants).find(c=>c.actionType===t)!;

// What an integration adapter reports. Only `ok:true` with a reference counts as success.
export interface IntegrationResult{ok:boolean;reference?:string|null;error?:string|null;retrySafe?:boolean}  // retrySafe: the failure is known to have happened BEFORE anything was sent
export interface IntegrationAdapter{perform(t:ActionType,input:Record<string,unknown>):Promise<IntegrationResult>}
export type ActionOutcome=
 |{status:'done';userMessage:string;reference:string|null;verified:boolean}        // happened, with evidence when verified
 |{status:'prepared';userMessage:string;draft?:string|null}                         // ready for the person; nothing sent
 |{status:'needs_approval';userMessage:string}
 |{status:'not_available';userMessage:string;state:CapabilityState;alternative:string|null}
 |{status:'failed';userMessage:string;error:string};
const ALTERNATIVE:Partial<Record<ActionType,string>>={make_payment:'I can show the amount, reference and payment link so you can pay in a minute.',make_purchase:'I can make the list and price it so you can order it.',submit_form:'I can list what the form needs and remind you before it is due.',send_message:'I can get the message ready for you to send.',book_appointment:'I can get the booking details ready and remind you to book.',create_calendar_event:'I can hold the date and remind you.',contact_provider:'I can draft the message for you to send.',share_information:'I can get it ready for you to share.'};
const UNAVAILABLE:Record<CapabilityState,string>={AVAILABLE:'',FAILED:'',REQUIRES_CONFIGURATION:'That isn’t set up yet.',REQUIRES_INTEGRATION:'I’d need you to connect that first.',NOT_SUPPORTED:'I can’t do that.'};
const DONE_WORDS:Partial<Record<ActionType,string>>={set_reminder:'I’ll remind you.',draft_message:'Message ready to review.',plan:'Plan ready.',organise:'Sorted into place.'};

// Execute (or prepare) an action. Approval is enforced here, not in the UI. An adapter that throws or
// says ok:false is recorded as a failure, never as completion, even if a model "thought" it worked.
export async function performAction(t:ActionType,input:Record<string,unknown>,o:{approved?:boolean;adapter?:IntegrationAdapter|null;env?:Record<string,string|undefined>;grants?:IntegrationGrants}={}):Promise<ActionOutcome>{
 const c=capability(t,o.env,o.grants);
 if(!c.available)return {status:'not_available',state:c.state,userMessage:`${UNAVAILABLE[c.state]}${ALTERNATIVE[t]?' '+ALTERNATIVE[t]:''}`.trim(),alternative:ALTERNATIVE[t]||null};
 if(c.requiresUserApproval&&!o.approved)return {status:'needs_approval',userMessage:'Want me to go ahead?'};
 if(c.category==='A'){
  if(t==='draft_message')return {status:'prepared',userMessage:DONE_WORDS.draft_message!,draft:typeof input.draft==='string'?input.draft:null};
  return {status:'done',userMessage:DONE_WORDS[t]||'Done.',reference:null,verified:false};
 }
 if(!o.adapter)return {status:'failed',userMessage:'That didn’t go through. Nothing was sent.',error:'no_adapter'};
 try{const r=await o.adapter.perform(t,input);
  if(!r.ok)return {status:'failed',userMessage:'That didn’t go through. Nothing was done.',error:r.error||'integration_error'};
  return {status:'done',userMessage:'Done. I’ve got a confirmation.',reference:r.reference||null,verified:!!r.reference&&c.supportsVerification};
 }catch(e){return {status:'failed',userMessage:'That didn’t go through. Nothing was done.',error:(e as Error).message||'integration_error'};}
}
