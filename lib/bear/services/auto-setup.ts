import type {AreaKey,ExtractedEntity,Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';
import {confirmTask} from './task-inference.ts';
import {breakDownTask,estimateTaskCost} from './task-edit.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';

// Less friction: when Bear understood a non-bill capture well enough to name it, it sets the
// task up itself (area, project, steps, a reminder plan) and tells the person afterwards, with
// everything still editable. Bills always stay behind the "have I got this right?" check,
// because money is involved. The person can switch this off in Me.
const defaultArea:Record<string,AreaKey>={appointment:'health',school:'family',form:'family',errand:'home',shopping:'home',message:'me',note:'me',event:'family',other:'me'};
export const autoSetupEnabled=(p:{pins:{preferences:{autoSetup?:boolean}}})=>p.pins.preferences.autoSetup!==false;

export async function maybeAutoSetup(store:BearStore,extraction:ExtractedEntity,now=new Date(),provider:StructuredModelProvider|null=null):Promise<{task:Task;planned:boolean;area:AreaKey}|null>{
 if(extraction.kind!=='task'||extraction.status!=='draft')return null;
 const profile=await ensureProfile(store);if(!autoSetupEnabled(profile))return null;
 const g=extraction.general;
 if(!g.title.value||g.title.confidence<0.5)return null;
 const area=g.area.value||defaultArea[g.kind]||'me';
 const confirmedFields=['title','when','timeOfDay','person','location','isRecurring'].filter(k=>(g as unknown as Record<string,{value:unknown}>)[k].value!==null);
 const {task}=await confirmTask(store,{extractionId:extraction.id,corrections:g.area.value?{}:{area},confirmedFields:[...confirmedFields,...(g.area.value?['area']:[])],includeSteps:true,setupBy:'bear'});
 // A list with no prices yet is priced straight away when the AI service is connected, so the total is already there when the task opens.
 let task2=task;
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
