import type {AreaKey,ExtractedEntity,Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';
import {confirmTask} from './task-inference.ts';
import {breakDownTask,estimateTaskCost} from './task-edit.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {flags} from '../flags.ts';
import {findSchoolMatch,mergeDetails} from '../coverage/matching.ts';
import {splitByEvent} from '../coverage/packs/school.ts';
import {stamp} from '../store/store.ts';
import {traced,type ExtractedEntity as Extraction} from '../domain/types.ts';
import {recordBehaviour} from './behaviour.ts';

// Less friction: when Bear understood a non-bill capture well enough to name it, it sets the
// task up itself (area, project, steps, a reminder plan) and tells the person afterwards, with
// everything still editable. Bills always stay behind the "have I got this right?" check,
// because money is involved. The person can switch this off in Me.
const defaultArea:Record<string,AreaKey>={appointment:'health',school:'family',form:'family',errand:'home',shopping:'home',message:'me',note:'me',event:'family',other:'me'};
export const autoSetupEnabled=(p:{pins:{preferences:{autoSetup?:boolean}}})=>p.pins.preferences.autoSetup!==false;

export async function maybeAutoSetup(store:BearStore,extraction:ExtractedEntity,now=new Date(),provider:StructuredModelProvider|null=null):Promise<{task:Task;planned:boolean;area:AreaKey;merged?:boolean}|null>{
 if(extraction.kind!=='task'||extraction.status!=='draft')return null;
 const profile=await ensureProfile(store);if(!autoSetupEnabled(profile))return null;
 const g=extraction.general;
 if(!g.title.value||g.title.confidence<0.5)return null;
 const area=g.area.value||defaultArea[g.kind]||'me';
 const confirmedFields=['title','when','timeOfDay','person','location','isRecurring'].filter(k=>(g as unknown as Record<string,{value:unknown}>)[k].value!==null);
 // A newsletter with several events: one item per event, each with only its own obligations.
 if(flags.coveragePacks()&&extraction.school?.isSchool&&extraction.school.events.length>1){
  const [first,...rest]=splitByEvent(extraction.school);const at=now.toISOString();
  const general={...extraction.general,title:traced(first.events[0].title,'rules',0.85,false,at),when:traced(first.events[0].date,'rules',first.events[0].date?0.85:0,false,at)};
  const firstX=await store.update('extractions',extraction.id,{school:first,general});
  const main=await maybeAutoSetup(store,firstX,now,provider).catch(()=>null);
  for(const part of rest){const ev=part.events[0];
   const copy=await store.insert('extractions',stamp<Extraction>(store.userId,{captureId:extraction.captureId,kind:'task',status:'draft',fields:extraction.fields,general:{...extraction.general,title:traced(ev.title,'rules',0.85,false,at),when:traced(ev.date,'rules',ev.date?0.85:0,false,at)},questions:[],sourceText:extraction.sourceText,inferenceId:extraction.inferenceId,duplicateOfBillId:null,school:part}));
   await maybeAutoSetup(store,copy,now,provider).catch(()=>null);}
  return main;
 }
 // School Admin pack: a notice about an event Bear already holds (a reminder, a resend) joins it.
 let joinProject:string|null=null;
 if(flags.coveragePacks()&&extraction.school?.isSchool){
  const m=await findSchoolMatch(store,extraction.school);
  if(m){const {details,added,conflicts}=mergeDetails(m.details,extraction.school.obligations);
   const graph=structuredClone(m.task.load!);const primary=graph.nodes.find(n=>n.id===graph.primaryId)!;primary.entities={...primary.entities,school:details};
   // Fill a missing payment reference on the payment itself, too.
   const pay=details.obligations.find(o=>o.type==='payment');for(const n of graph.nodes)if(n.pattern==='BILL_PAYMENT'&&n.parentId===primary.id&&pay){n.entities={...n.entities,reference:n.entities.reference||pay.reference,amountCents:n.entities.amountCents??pay.amountCents};}
   const updated=await store.update('tasks',m.task.id,{load:graph});
   const capture=await store.get('captures',extraction.captureId);const project=await store.get('projects',m.task.projectId);
   if(project&&capture?.documentId&&!project.resourceDocumentIds.includes(capture.documentId))await store.update('projects',project.id,{resourceDocumentIds:[...project.resourceDocumentIds,capture.documentId]});
   await recordBehaviour(store,'coverage_merged',{pack:'school',added:added.map(a=>a.type),conflicts},now);
   if(!added.length){await store.update('extractions',extraction.id,{status:'verified'});if(capture)await store.update('captures',capture.id,{status:'verified'});return {task:updated,planned:false,area:project?.areaKey||'family',merged:true};}
   // Something genuinely new for the same event: set up just that, in the same project.
   extraction={...extraction,school:{...extraction.school,obligations:added}};await store.update('extractions',extraction.id,{school:extraction.school});joinProject=m.task.projectId;}
 }
 const {task}=await confirmTask(store,{extractionId:extraction.id,corrections:g.area.value?{}:{area},confirmedFields:[...confirmedFields,...(g.area.value?['area']:[])],includeSteps:true,setupBy:'bear'},now);
 // A list with no prices yet is priced straight away when the AI service is connected, so the total is already there when the task opens.
 let task2=task;
 if(joinProject&&joinProject!==task.projectId){const own=task.projectId;task2=await store.update('tasks',task.id,{projectId:joinProject});await store.remove('projects',own).catch(()=>{});}
 if(provider&&task.items?.some(i=>i.estimatedCents===null)){try{task2=await estimateTaskCost(store,provider,task.id);}catch{/* the list stands; the Estimate button is on the task */}}
 // Only time-sensitive things get a planned reminder time. Everything else is simply held:
 // no date, no time, no pressure, and the person chooses how (or whether) to be reminded.
 let planned=false;
 if(task2.timing==='time_sensitive'){
  try{const plan=await recommendPlan(store,null,task2,now);if(plan.suggested.when){await acceptPlan(store,{taskId:task2.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:plan.followUpDefault},now);planned=true;}}catch{/* the task stands without a reminder */}
 }
 // A bigger task with no steps yet is broken into small ones when the AI service is connected.
 if(provider&&task2.size==='bigger'&&profile.pins.preferences.planningDetail!=='just_the_task'&&!(await store.list('task_dependencies',{where:[{column:'task_id',value:task2.id}]})).length){try{await breakDownTask(store,provider,task2.id);}catch{/* the Break it down button can try again */}}
 return {task:task2,planned,area};
}
