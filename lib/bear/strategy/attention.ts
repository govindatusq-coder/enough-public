import {addDays,daysBetween} from '../domain/dates.ts';
import type {Completion,Importance,Project,Task,WorkRole} from '../domain/types.ts';
import {importancePrior,isLowLeverage,roleOf} from '../priority/importance.ts';
import type {PriorityResult} from '../priority/types.ts';

// The Strategic Attention Engine. Pure: reads projects, tasks, completions and the Priority Engine's
// results; writes nothing. It watches the progress clock of projects that matter, not the age of tasks:
//  - strategic neglect is time since meaningful progress on an important project, never task age;
//  - activity is not progress: tidy-up work, edits and busy upkeep don't reset the clock;
//  - an undated project is not a low-priority project, and Bear never invents a deadline for it;
//  - a project moving well is left alone.
export type Momentum='moving'|'stable'|'stalled'|'blocked'|'dormant';
export interface ProjectAttention{
 projectId:string;title:string;areaKey:string;
 importance:number;explicit:Importance|null;role:WorkRole;strategic:boolean;
 momentum:Momentum;lastProgressAt:string;daysSinceProgress:number;expectedDays:number;neglect:number;
 next:{taskId:string;title:string;minutes:number}|null;capacity:'15'|'30'|'block';
 busyElsewhere:boolean;deferrals:number;intent:Project['intent'];deferredUntil:string|null;
}
const roleWeight:Record<WorkRole,number>={progress:1,restore:0.8,prevent:0.7,maintain:0.4};
const patternOf=(t:Task)=>t.load?.nodes[0]?.pattern||'UNKNOWN_LOAD';

export function strategicAttention(o:{projects:Project[];tasks:Task[];completions:Completion[];results:Map<string,PriorityResult>;today:string}):ProjectAttention[]{
 const {today}=o;const doneAt=new Map<string,string>();for(const c of o.completions){const d=c.completedAt.slice(0,10);if(!doneAt.has(c.taskId)||doneAt.get(c.taskId)!<d)doneAt.set(c.taskId,d);}
 const taskRole=(t:Task,p?:Project)=>{const r=o.results.get(t.id)?.role;return r||roleOf(patternOf(t),`${t.title} ${t.notes||''}`,p?.role||null,null).role;};
 // Upkeep finished lately, anywhere: lots of it alongside a stalled important project is worth a gentle word.
 const upkeepDone=o.tasks.filter(t=>t.status==='done'&&(doneAt.get(t.id)||'')>=addDays(today,-14)&&(isLowLeverage(t.title)||taskRole(t,o.projects.find(p=>p.id===t.projectId))==='maintain')).length;
 const out:ProjectAttention[]=[];
 for(const p of o.projects.filter(p=>p.status==='active')){
  const kids=o.tasks.filter(t=>t.projectId===p.id);const open=kids.filter(t=>t.status==='open'&&!t.wishlist);
  if(!open.length&&!p.paused)continue;
  // Importance: the person's own traffic light first; otherwise Bear's read of the strongest tasks, discounted.
  const inferred=open.map(t=>o.results.get(t.id)?.importanceSignal.inferredScore).filter((n):n is number=>n!=null).sort((a,b)=>b-a).slice(0,3);
  const projectRole=p.role||(()=>{const r=roleOf('UNKNOWN_LOAD',p.title,null,null);if(r.explicit||r.role!=='maintain')return r.role;const counts=new Map<WorkRole,number>();for(const t of open){if(isLowLeverage(t.title))continue;const k=taskRole(t,p);counts.set(k,(counts.get(k)||0)+1);}return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||'maintain';})();
  const importance=p.importance?importancePrior[p.importance]:inferred.length?0.8*inferred.reduce((a,b)=>a+b,0)/inferred.length+(projectRole==='progress'?0.1:0):0.4;
  const strategic=importance*roleWeight[projectRole]>=0.5;
  // The progress clock: only meaningful work counts (not tidy-up, not edits, not re-ordering).
  const progress=kids.filter(t=>t.status==='done'&&!isLowLeverage(t.title)&&doneAt.has(t.id)).map(t=>doneAt.get(t.id)!).sort();
  const lastProgressAt=progress[progress.length-1]||p.createdAt.slice(0,10);
  const daysSinceProgress=Math.max(0,daysBetween(lastProgressAt,today)??0);
  const expectedDays=importance>=0.8?7:importance>=0.55?14:28;
  const next=open.filter(t=>!isLowLeverage(t.title)).sort((a,b)=>(a.order??0)-(b.order??0)||a.createdAt.localeCompare(b.createdAt))[0]||null;
  const nextR=next?o.results.get(next.id):null;
  // Blocked: everything left is waiting on someone else. (Work Bear is only holding is still the person's.)
  const blocked=open.every(t=>o.results.get(t.id)?.timingLabel==='Waiting');
  const momentum:Momentum=p.paused?'dormant':blocked?'blocked':progress.length&&daysSinceProgress<=expectedDays?'moving':daysSinceProgress<=expectedDays?'stable':'stalled';
  const neglect=momentum==='stalled'?Math.min(1,(daysSinceProgress-expectedDays)/(2*expectedDays)+0.15)*importance:0;
  const minutes=nextR?.minutes||next?.estimatedMinutes||30;
  out.push({projectId:p.id,title:p.title,areaKey:p.areaKey,importance,explicit:p.importance||null,role:projectRole,strategic,momentum,lastProgressAt,daysSinceProgress,expectedDays,neglect,
   next:next?{taskId:next.id,title:next.title,minutes}:null,capacity:minutes<=15?'15':minutes<=30?'30':'block',
   busyElsewhere:upkeepDone>=5,deferrals:p.strategicDeferrals||0,intent:p.intent||null,deferredUntil:p.deferredUntil||null});
 }
 return out.sort((a,b)=>b.neglect-a.neglect||b.importance-a.importance);
}
