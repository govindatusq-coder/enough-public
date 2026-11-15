// Turns checked triage cards into tasks (one per card, deduplicated like everything else) with what Bear prepared attached.
import type {StructuredModelProvider} from '../ai/provider.ts';
import type {AIInference,AreaKey} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {classify,lightFor,suggestStart,type Light} from './sorter.ts';
import {placeSorted,type SortedItem} from './sort-service.ts';
import {anchorsFor,checkTriage,cleanEmailInput,triageJsonSchema,triageSystemPrompt,type CheckedCard,type FamilyMember} from './triage-core.ts';

export interface TriageInput{images:{mime:string;bytes:Uint8Array}[];documents:{mime:string;bytes:Uint8Array}[];text:string|null}
export interface TriageCardView{linkedFrom?:string|null;card_id:string;family_member:string|null;action_type:string;urgency:Light;hard_deadline:string|null;card_headline:string;ai_work_completed:string;execution_payload:CheckedCard['execution_payload'];confidence_score:number;missing_blocker:string|null;taskId:string|null;area:AreaKey;when:string;already:boolean}
export interface TriageResult{reasoning:string;summary:string;cards:TriageCardView[]}
export class TriageError extends Error{readonly code:string;readonly status:number;constructor(message:string,code:string,status=502){super(message);this.code=code;this.status=status;}}
export const DAILY_TRIAGE=40;

export async function familyOf(store:BearStore):Promise<{family:FamilyMember[];parentName:string;timeZone:string}>{
 const p=await ensureProfile(store);
 const fam:FamilyMember[]=p.family?.length?p.family:(p.people||[]).filter(x=>x.name&&(x.role==='child'||x.role==='partner')).map(x=>({name:x.name,relation:x.role==='partner'?'partner' as const:'child' as const,age:null,yearLevel:null,school:null,allergies:null,notes:null}));
 return {family:fam,parentName:(p.name||'').split(/\s+/)[0]||'',timeZone:p.lifeRhythm.timezone||'Australia/Sydney'};
}
export async function triage(store:BearStore,provider:StructuredModelProvider|null,input:TriageInput,now=new Date()):Promise<TriageResult>{
 if(!provider)throw new TriageError('Bear’s reading service isn’t connected (no AI key is set), so it can’t read photos, PDFs or emails yet.','missing_key',503);
 if(!input.images.length&&!input.documents.length&&!input.text?.trim())throw new TriageError('There was nothing to read.','empty',400);
 const since=now.getTime()-24*3600000;
 const used=(await store.list('ai_inferences',{where:[{column:'service',value:'Triage'}]})).filter(i=>Date.parse(i.createdAt)>=since).length;
 if(used>=DAILY_TRIAGE)throw new TriageError('That’s a lot of reading for one day. Bear will take more tomorrow.','limit',429);
 const {family,parentName,timeZone}=await familyOf(store);const a=anchorsFor(now,timeZone,family,parentName);
 const text=input.text?cleanEmailInput(input.text):null;const started=Date.now();
 let raw:unknown;
 try{
  const r=await provider.extract({schema:triageJsonSchema as unknown as Record<string,unknown>,system:triageSystemPrompt(a),text,images:input.images,documents:input.documents,maxOutputTokens:12000,thinkingSummary:true});
  raw=r.output;
  const checked=checkTriage(raw,a.isoDate,family.map(f=>f.name));
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Triage',provider:r.provider,model:r.model,promptHash:'triage-1',rawOutput:checked.ok?{cards:checked.cards.length,problems:checked.cards.flatMap(c=>c.problems).length}:null,latencyMs:r.latencyMs,ok:checked.ok,error:checked.ok?null:checked.error.slice(0,400),usage:usageFrom(r.raw)}));
  if(!checked.ok)throw new TriageError('Bear read it but its answer didn’t hold together. Try again, or send a clearer picture.','invalid_output',502);
  const cards:TriageCardView[]=[];
  for(const c of checked.cards)cards.push(await placeCard(store,c,a.isoDate,family,now));
  return {reasoning:r.thinking||'',summary:checked.output.source_summary,cards};
 }catch(e){
  if(e instanceof TriageError)throw e;
  const message=e instanceof Error?e.message:'The reading service had a problem.';
  await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:null,service:'Triage',provider:'anthropic',model:'',promptHash:'triage-1',rawOutput:null,latencyMs:Date.now()-started,ok:false,error:message.slice(0,400)})).catch(()=>null);
  throw new TriageError(message,'upstream',502);
 }
}
const usageFrom=(raw:unknown)=>{const u=(raw as {usage?:{input_tokens?:unknown;output_tokens?:unknown}}|null)?.usage;return u&&typeof u.input_tokens==='number'&&typeof u.output_tokens==='number'?{inputTokens:u.input_tokens,outputTokens:u.output_tokens}:null;};
// One card -> one task. The area comes from what the card is about and who it is for; the urgency the model gave is kept as
// the person-independent "urgency" signal, and the deadline (checked) drives the traffic light as it does everywhere.
async function placeCard(store:BearStore,c:CheckedCard,today:string,family:FamilyMember[],now:Date):Promise<TriageCardView>{
 const member=family.find(f=>f.name===c.family_member);
 const about=[c.card_headline,c.action_type==='payment'?'pay':'',member?.relation==='child'?'school child':''].join(' ');
 const {domain,secondary}=classify(about,family.filter(f=>f.relation==='child').map(f=>f.name));
 // Something for a child or partner is a family thing, unless it is really about their health or money.
 const area:AreaKey=member&&member.relation!=='other'?(domain==='health'||domain==='money'?domain:'family'):domain;
 const light=lightFor({deadline:c.hard_deadline,urgency:c.urgency,soonByNature:false},today);
 const original=[c.card_headline,c.hard_deadline?`by ${c.hard_deadline}`:''].filter(Boolean).join(' ');
 const item:SortedItem=await placeSorted(store,{title:c.card_headline.slice(0,90),original,domain:area,secondary,deadline:c.hard_deadline,deadlineSource:c.hard_deadline?'stated':null,window:null,windowBy:null,suggestedStart:suggestStart(c.card_headline,c.hard_deadline,light.light,today),urgency:c.urgency,nextAction:null,...light},'text',today,now);
 // Drafts go with the task, including one this card was added to, unless that task already has its own.
 if(item.taskId&&(!item.already||!(await store.get('tasks',item.taskId))?.prepared)){
  await store.update('tasks',item.taskId,{prepared:{actionType:c.action_type,member:c.family_member,work:c.ai_work_completed,blocker:c.missing_blocker,confidence:c.confidence_score,payload:c.execution_payload}}).catch(()=>null);
 }
 return {card_id:c.card_id,family_member:c.family_member,action_type:c.action_type,urgency:item.light,hard_deadline:c.hard_deadline,card_headline:item.title,ai_work_completed:c.ai_work_completed,execution_payload:c.execution_payload,confidence_score:c.confidence_score,missing_blocker:c.missing_blocker,taskId:item.taskId,area:item.domain,when:item.when,already:item.already,linkedFrom:item.linkedFrom||null};
}
