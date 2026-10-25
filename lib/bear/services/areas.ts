import {daysBetween,relativeDay,todayISO} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import {areaLabels} from '../domain/labels.ts';
import {areaKeys,type AreaKey,type Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';

// Areas (the "A" in PARA, never named as such): every area the person has or uses, with what
// is current in it. Steps and purchases belong to their main task and are not listed twice.
export interface AreaTile{key:string;label:string;open:number;done:number}
export interface AreaItem{part:string|null;taskId:string;billId:string|null;title:string;kind:string;due:string|null;dueLabel:string;amount:string|null;estimate:string|null;stepsLeft:number;itemsLeft:number;isDemo:boolean}
export interface AreaDetail{key:string;label:string;current:AreaItem[];done:AreaItem[]}

async function load(store:BearStore){
 const [projects,tasks,bills,deps]=await Promise.all([store.list('projects'),store.list('tasks'),store.list('bills'),store.list('task_dependencies')]);
 const stepIds=new Set(deps.map(d=>d.dependsOnTaskId));
 const projectArea=new Map(projects.map(p=>[p.id,p.areaKey]));
 const mains=tasks.filter(t=>!stepIds.has(t.id)&&projectArea.has(t.projectId)&&t.status!=='dropped'&&t.status!=='archived');
 const wishlist=mains.filter(t=>t.status==='open'&&t.wishlist);
 return {tasks,bills,deps,stepIds,projectArea,mains:mains.filter(t=>!(t.status==='open'&&t.wishlist)),wishlist};
}
export async function areaTiles(store:BearStore,chosen:AreaKey[]):Promise<AreaTile[]>{
 const {mains,projectArea}=await load(store);
 const count=(key:string,status:Task['status'])=>mains.filter(t=>projectArea.get(t.projectId)===key&&t.status===status).length;
 const keys=areaKeys.filter(k=>chosen.includes(k)||count(k,'open')>0||count(k,'done')>0);
 return keys.map(key=>({key,label:areaLabels[key],open:count(key,'open'),done:count(key,'done')}));
}
export async function areaView(store:BearStore,key:AreaKey,now=new Date()):Promise<AreaDetail>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const {tasks,bills,deps,projectArea,mains}=await load(store);
 const item=(t:Task):AreaItem=>{
  const bill=bills.find(b=>b.taskId===t.id)||null;const due=bill?.dueAt||t.dueAt;
  const stepIds=deps.filter(d=>d.taskId===t.id).map(d=>d.dependsOnTaskId);
  const rel=due?relativeDay(due,today):'';const d=due?daysBetween(today,due):null;
  return {part:t.part?`${t.part.index} of ${t.part.total}`:null,taskId:t.id,billId:bill?.id||null,title:bill?`${bill.biller||'Bill'}: ${t.title}`:t.title,kind:bill?'bill':t.kind,due,dueLabel:due?(d!==null&&d<0?'Past the due date':'Due '+rel):'No date',amount:bill?formatAUD(bill.amountCents):null,estimate:t.estimatedCents?`about ${formatAUD(t.estimatedCents)}`:null,stepsLeft:tasks.filter(x=>stepIds.includes(x.id)&&x.status==='open').length,itemsLeft:(t.items||[]).filter(i=>!i.done).length,isDemo:t.isDemo};
 };
 const inArea=mains.filter(t=>projectArea.get(t.projectId)===key);
 const current=inArea.filter(t=>t.status==='open').sort((a,b)=>((a.dueAt||'9999')<(b.dueAt||'9999')?-1:1)).map(item);
 const done=inArea.filter(t=>t.status==='done').sort((a,b)=>(a.updatedAt<b.updatedAt?1:-1)).slice(0,30).map(item);
 return {key,label:areaLabels[key],current,done};
}
