import {json,withBear} from '@/lib/bear/server/context';
import {todayFor,taskLight} from '@/lib/bear/services/sort-service';
export const dynamic='force-dynamic';
// Bear's own calendar: every open task with a date, by day, with what is overdue first.
export const GET=(req:Request)=>withBear(req,async({store})=>{
 const {today}=await todayFor(store);
 const [tasks,projects]=await Promise.all([store.list('tasks',{where:[{column:'status',value:'open'}]}),store.list('projects')]);
 const area=new Map(projects.map(p=>[p.id,p.areaKey]));const steps=new Set((await store.list('task_dependencies')).map(d=>d.dependsOnTaskId));
 const dated=tasks.filter(t=>t.dueAt&&!steps.has(t.id)&&!t.isDemo).map(t=>({taskId:t.id,title:t.title,date:t.dueAt!,time:t.dueTime||null,location:t.location||null,area:area.get(t.projectId)||'me',light:taskLight(t,today).light,web:t.sorted?.deadlineSource==='web'}))
  .sort((a,b)=>a.date.localeCompare(b.date)||(a.time||'99').localeCompare(b.time||'99'));
 const days=new Map<string,typeof dated>();for(const d of dated.filter(x=>x.date>=today)){const l=days.get(d.date)||[];l.push(d);days.set(d.date,l);}
 return json({today,overdue:dated.filter(d=>d.date<today),days:[...days].map(([date,items])=>({date,items})),undated:tasks.filter(t=>!t.dueAt&&!steps.has(t.id)&&!t.isDemo).length});
});
