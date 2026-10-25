import type {AreaKey,ExtractedEntity,Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {acceptPlan,recommendPlan} from './reminder-planning.ts';
import {confirmTask} from './task-inference.ts';

// Less friction: when Bear understood a non-bill capture well enough to name it, it sets the
// task up itself (area, project, steps, a reminder plan) and tells the person afterwards, with
// everything still editable. Bills always stay behind the "have I got this right?" check,
// because money is involved. The person can switch this off in Me.
const defaultArea:Record<string,AreaKey>={appointment:'health',school:'family',form:'family',errand:'home',shopping:'home',message:'me',note:'me',event:'family',other:'me'};
export const autoSetupEnabled=(p:{pins:{preferences:{autoSetup?:boolean}}})=>p.pins.preferences.autoSetup!==false;

export async function maybeAutoSetup(store:BearStore,extraction:ExtractedEntity,now=new Date()):Promise<{task:Task;planned:boolean;area:AreaKey}|null>{
 if(extraction.kind!=='task'||extraction.status!=='draft')return null;
 const profile=await ensureProfile(store);if(!autoSetupEnabled(profile))return null;
 const g=extraction.general;
 if(!g.title.value||g.title.confidence<0.5)return null;
 const area=g.area.value||defaultArea[g.kind]||'me';
 const confirmedFields=['title','when','timeOfDay','person','location','isRecurring'].filter(k=>(g as unknown as Record<string,{value:unknown}>)[k].value!==null);
 const {task}=await confirmTask(store,{extractionId:extraction.id,corrections:g.area.value?{}:{area},confirmedFields:[...confirmedFields,...(g.area.value?['area']:[])],includeSteps:true,setupBy:'bear'});
 let planned=false;
 // Only plan a reminder when there is a date to plan towards; otherwise Bear just holds it.
 if(task.dueAt){
  try{const plan=await recommendPlan(store,null,task,now);if(plan.suggested.when){await acceptPlan(store,{taskId:task.id,when:plan.suggested.when,label:plan.suggested.label,rationale:plan.suggested.rationale,key:'bear',followUpIfUnpaid:plan.followUpDefault},now);planned=true;}}catch{/* the task stands without a reminder */}
 }
 return {task,planned,area};
}
