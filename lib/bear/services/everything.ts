import {areaLabels} from '../domain/labels.ts';
import type {BearStore} from '../store/store.ts';
// "Everything Bear is holding": the PARA view in plain words. Area → Project → open tasks,
// with the original document as the resource and done projects as the archive.
export interface EverythingView{areas:{key:string;label:string;projects:{id:string;title:string;dueAt:string|null;status:string;billId:string|null;taskId:string|null;openSteps:number;hasResource:boolean}[]}[];archived:number}
export async function everythingView(store:BearStore):Promise<EverythingView>{
 const [areas,projects,tasks]=await Promise.all([store.list('areas'),store.list('projects',{orderBy:{column:'due_at'}}),store.list('tasks')]);
 const stepIds=new Set((await store.list('task_dependencies')).map(d=>d.dependsOnTaskId));
 const keys=['money','family','home','work','health','me'];
 const out=keys.filter(k=>areas.some(a=>a.key===k&&!a.archived)||projects.some(p=>p.areaKey===k&&p.status==='active')).map(key=>({key,label:areaLabels[key],projects:projects.filter(p=>p.areaKey===key&&p.status==='active').map(p=>{const main=tasks.find(t=>t.projectId===p.id&&!stepIds.has(t.id));return {id:p.id,title:p.title,dueAt:p.dueAt,status:p.status,billId:p.billId,taskId:main?.id||null,openSteps:tasks.filter(t=>t.projectId===p.id&&stepIds.has(t.id)&&t.status==='open').length,hasResource:p.resourceDocumentIds.length>0};})}));
 return {areas:out,archived:projects.filter(p=>p.status!=='active').length};
}
