import {z} from 'zod';
import {json,readJson,withBear} from '@/lib/bear/server/context';
import {lightFor,soonByNature,sortOne} from '@/lib/bear/services/sorter';
import {placeSorted} from '@/lib/bear/services/sort-service';
import {updateTask} from '@/lib/bear/services/task-edit';
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

// Add something straight into Bear's calendar: a title and a day (and a time if given). It becomes an ordinary task, filed and
// reminded like anything else, so it shows everywhere Bear shows things.
const addSchema=z.object({title:z.string().trim().min(2).max(120),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional()}).strict();
export const POST=(req:Request)=>withBear(req,async({store})=>{
 const {title,date,time}=addSchema.parse(await readJson(req));const {today,children}=await todayFor(store);
 const base=sortOne(title,today,children);const light=lightFor({deadline:date,urgency:base.urgency,soonByNature:soonByNature(base.title)},today);
 const item=await placeSorted(store,{...base,deadline:date,deadlineSource:'stated',window:null,windowBy:null,suggestedStart:null,...light},'text',today,new Date(),{noLink:true});
 if(item.taskId&&time)await updateTask(store,item.taskId,{dueTime:time}).catch(()=>null);
 return json({item},201);
});
