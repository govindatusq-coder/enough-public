import {z} from 'zod';
import {addDays,parseISODate,toISODate,todayISO} from '../domain/dates.ts';
import {projectPriorities,type Area,type ExtractedEntity,type GeneralFields,type Project,type ProjectPriority,type Task} from '../domain/types.ts';
import {areaLabels} from '../domain/labels.ts';
import {understand} from '../load/engine.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {caps,relayLoadDate} from './load.ts';
import {ensureProfile} from './profile.ts';

// Brain dumps. A page of headings with tasks under each is several projects, not one task.
// Bear files every heading as a project and every line as a to-do under it, then asks one
// light question: how should these be lined up? Nothing is dated or pushed until the person says.
export const isBrainDump=(g:Pick<GeneralFields,'projects'>)=>{const p=g.projects||[];return p.length>=2&&p.reduce((n,x)=>n+x.tasks.length,0)>=3;};

export async function setupBrainDump(store:BearStore,extraction:ExtractedEntity,now=new Date()){
 const g=extraction.general;const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 // The AI's area when it is confident; otherwise read the whole page: work words win for a work list.
 const page=(g.projects||[]).map(p=>[p.name,...p.tasks].join(' ')).join(' ');
 const workish=(page.match(/\b(phd|paper|papers|ethics|meeting|mtg|report|contract|contracts|project|review|r\/v|journal|article|grant|conference|conf|thesis|chapter|chp|students?|supervis\w*|team|client|deadline|email|procurement|training|methodology|partnership)\b/gi)||[]).length;
 const areaKey=g.area.value&&g.area.value!=='money'&&g.area.confidence>=0.7?g.area.value:workish>=2?'work':(g.area.value&&g.area.value!=='money'?g.area.value:'work');
 let area=(await store.list('areas',{where:[{column:'key',value:areaKey}]}))[0];
 if(!area)area=await store.insert('areas',stamp<Area>(store.userId,{key:areaKey,label:areaLabels[areaKey],archived:false}));else if(area.archived)await store.update('areas',area.id,{archived:false});
 if(!profile.areas.includes(areaKey))await store.update('profiles',profile.id,{areas:[...profile.areas,areaKey]});
 const capture=await store.get('captures',extraction.captureId);
 const projects:{project:Project;tasks:Task[]}[]=[];
 for(const [pi,p] of (g.projects||[]).entries()){
  if(!p.tasks.length)continue;
  const project=await store.insert('projects',stamp<Project>(store.userId,{areaKey,title:p.name,status:'active',dueAt:null,resourceDocumentIds:capture?.documentId?[capture.documentId]:[],billId:null,captureId:extraction.captureId,priority:null,order:pi}));
  const tasks:Task[]=[];
  for(const [ti,title] of p.tasks.entries()){
   const {graph}=understand({text:title,title,today,caps:caps(),loadMap:profile.loadMap,asTodo:true});
   tasks.push(await store.insert('tasks',stamp<Task>(store.userId,{projectId:project.id,kind:'custom',title,status:'open',dueAt:null,estimatedMinutes:15,cognitiveEffort:'low',forPerson:null,isDemo:!!capture?.isDemo,setupBy:'bear',timing:'flexible',size:'one_go',order:ti,load:graph})));
  }
  projects.push({project,tasks});
 }
 await store.update('extractions',extraction.id,{status:'verified'});
 if(capture)await store.update('captures',capture.id,{status:'verified'});
 return {captureId:extraction.captureId,areaKey,projects:projects.map(p=>({id:p.project.id,title:p.project.title,count:p.tasks.length}))};
}

export async function dumpView(store:BearStore,captureId:string){
 const projects=(await store.list('projects')).filter(p=>p.captureId===captureId).sort((a,b)=>(a.order??0)-(b.order??0));
 const tasks=await store.list('tasks',{where:[{column:'status',value:'open'}]});
 return {areaKey:projects[0]?.areaKey||'work',projects:projects.map(p=>({id:p.id,title:p.title,priority:p.priority||null,dueAt:p.dueAt,tasks:tasks.filter(t=>t.projectId===p.id).sort((a,b)=>(a.order??0)-(b.order??0)).map(t=>({id:t.id,title:t.title}))}))};
}

export const sortDumpSchema=z.object({projects:z.array(z.object({id:z.string().uuid(),priority:z.enum(projectPriorities),dueAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()}).strict()).max(40)}).strict();
// This week → by the coming Friday; this month → by the end of the month; later or no rush → no date.
export function dateForPriority(priority:ProjectPriority,today:string):string|null{
 const t=parseISODate(today)!;
 if(priority==='now'){const toFri=(5-t.getDay()+7)%7;return addDays(today,toFri<2?toFri+7:toFri);}
 if(priority==='soon'){const end=toISODate(new Date(t.getFullYear(),t.getMonth()+1,0,12));return (parseISODate(end)!.getTime()-t.getTime())/86400000<10?addDays(today,14):end;}
 return null;
}
export async function sortDump(store:BearStore,captureId:string,input:z.infer<typeof sortDumpSchema>,now=new Date()){
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const mine=new Set((await store.list('projects')).filter(p=>p.captureId===captureId).map(p=>p.id));
 for(const p of input.projects){
  if(!mine.has(p.id))continue;
  const dueAt=p.dueAt??dateForPriority(p.priority,today);
  await store.update('projects',p.id,{priority:p.priority,dueAt});
  for(const t of await store.list('tasks',{where:[{column:'project_id',value:p.id},{column:'status',value:'open'}]})){
   // A date makes it time-sensitive; "later" and "no rush" stay quiet, with no reminders.
   const next=await store.update('tasks',t.id,{dueAt,timing:dueAt?'time_sensitive':'flexible'});
   if(next.load&&!next.load.migrated)await store.update('tasks',t.id,{load:await relayLoadDate(store,next,dueAt,now)});
  }
 }
 return dumpView(store,captureId);
}
