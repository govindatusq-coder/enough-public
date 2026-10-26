import {daysBetween,relativeDay,todayISO} from '../domain/dates.ts';
import {overdueDays,overdueLabel} from '../domain/overdue.ts';
import {formatAUD} from '../domain/money.ts';
import {areaLabels} from '../domain/labels.ts';
import {areaKeys,type AreaKey,type Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from './profile.ts';
import {prioritiseOpen,priorityEnabled} from './priority.ts';
import {dueReminders} from './reminders.ts';

// Areas (the "A" in PARA, never named as such): every area the person has or uses, with what
// is current in it. Steps and purchases belong to their main task and are not listed twice.
export interface AreaTile{key:string;label:string;open:number;done:number;needs:number;overdue:number;soft:boolean}
export interface AreaItem{project?:{id:string;title:string;priority:string|null}|null;needs:boolean;soft:boolean;reminderId:string|null;overdueDays:number;part:string|null;taskId:string;billId:string|null;title:string;kind:string;due:string|null;dueLabel:string;amount:string|null;estimate:string|null;stepsLeft:number;itemsLeft:number;isDemo:boolean}
export interface AreaDetail{key:string;label:string;current:AreaItem[];done:AreaItem[]}

async function load(store:BearStore){
 const [projects,tasks,bills,deps]=await Promise.all([store.list('projects'),store.list('tasks'),store.list('bills'),store.list('task_dependencies')]);
 const stepIds=new Set(deps.map(d=>d.dependsOnTaskId));
 const projectArea=new Map(projects.map(p=>[p.id,p.areaKey]));
 const mains=tasks.filter(t=>!stepIds.has(t.id)&&projectArea.has(t.projectId)&&t.status!=='dropped'&&t.status!=='archived');
 const wishlist=mains.filter(t=>t.status==='open'&&t.wishlist);
 return {tasks,bills,deps,stepIds,projectArea,projects,mains:mains.filter(t=>!(t.status==='open'&&t.wishlist)),wishlist};
}
// Always all six areas, in a fixed order, so My Bear is the same shape every time and anything can land in any area.
export async function areaTiles(store:BearStore,_chosen:AreaKey[],attention?:Map<string,{needs:Set<string>;overdue:Set<string>;soft:boolean}>):Promise<AreaTile[]>{
 const {mains,projectArea}=await load(store);
 const count=(key:string,status:Task['status'])=>mains.filter(t=>projectArea.get(t.projectId)===key&&t.status===status).length;
 const keys=[...areaKeys];
 return keys.map(key=>{const a=attention?.get(key);return {key,label:areaLabels[key],open:count(key,'open'),done:count(key,'done'),needs:a?.needs.size||0,overdue:a?.overdue.size||0,soft:!!a?.soft};});
}
export async function areaView(store:BearStore,key:AreaKey,now=new Date()):Promise<AreaDetail>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const {tasks,bills,deps,projectArea,mains,projects}=await load(store);
 // Priority Engine: calm timing labels in place of a bare "No rush", and the order things are worth doing in.
 const pr=priorityEnabled()?await prioritiseOpen(store,now).catch(()=>null):null;
 const labelRank:Record<string,number>={'Worth doing now':0,'Good to do this week':1,'Coming up':2,'Waiting':3,'Bear is handling it':4,'Later is fine':5,'Nothing needed yet':6};
 // Projects from a brain dump group their to-dos, most pressing project first.
 const dumpProject=new Map(projects.filter(p=>p.captureId).map(p=>[p.id,p]));const rank={now:0,soon:1,later:2,none:3} as Record<string,number>;
 const dueNow=new Map((await dueReminders(store,now)).map(d=>[d.reminder.taskId,{id:d.reminder.id,soft:d.reminder.kind==='nudge'}]));
 const item=(t:Task):AreaItem=>{
  const bill=bills.find(b=>b.taskId===t.id)||null;const due=bill?.dueAt||t.dueAt;
  const stepIds=deps.filter(d=>d.taskId===t.id).map(d=>d.dependsOnTaskId);
  const rel=due?relativeDay(due,today):'';const d=due?daysBetween(today,due):null;
  const reminder=dueNow.get(t.id)||null;const late=overdueDays(due,today,t.timing)>0;const soon=t.timing!=='flexible'&&due!==null&&d!==null&&d<=2;
  const dp=dumpProject.get(t.projectId);
  return {project:dp?{id:dp.id,title:dp.title,priority:dp.priority||null}:null,needs:t.status==='open'&&(late||soon||(!!reminder&&!reminder.soft)),soft:!!reminder?.soft&&t.status==='open',reminderId:reminder?.id||null,overdueDays:overdueDays(due,today,t.timing),part:t.part?`${t.part.index} of ${t.part.total}`:null,taskId:t.id,billId:bill?.id||null,title:bill?`${bill.biller||'Bill'}: ${t.title}`:t.title,kind:bill?'bill':t.kind,due,dueLabel:(()=>{const r=pr?.results.get(t.id);const base=due?(d!==null&&d<0?overdueLabel(-d):'Due '+rel):null;if(r&&t.status==='open')return d!==null&&d<0&&base?base:r.timingLabel==='Worth doing now'&&base?`${r.timingLabel} · ${base}`:r.timingLabel==='Good to do this week'&&base?`${r.timingLabel} · ${base}`:r.timingLabel;return t.timing==='flexible'?'No rush':base||'No date';})(),amount:bill?formatAUD(bill.amountCents):null,estimate:t.estimatedCents?`about ${formatAUD(t.estimatedCents)}`:null,stepsLeft:tasks.filter(x=>stepIds.includes(x.id)&&x.status==='open').length,itemsLeft:(t.items||[]).filter(i=>!i.done).length,isDemo:t.isDemo};
 };
 const inArea=mains.filter(t=>projectArea.get(t.projectId)===key);
 const pkey=(t:Task)=>{const p=dumpProject.get(t.projectId);if(p)return `1${rank[p.priority||'none']??4}${String(p.order??0).padStart(3,'0')}${String(t.order??0).padStart(3,'0')}`;const r=pr?.results.get(t.id);return r?`0${labelRank[r.timingLabel]??7}${String(Math.round(999-Math.min(999,r.actionPriority*500))).padStart(3,'0')}${t.dueAt||'9999'}`:`0${t.dueAt||'9999'}`;};
 const current=inArea.filter(t=>t.status==='open').sort((a,b)=>pkey(a)<pkey(b)?-1:1).map(item);
 const done=inArea.filter(t=>t.status==='done').sort((a,b)=>(a.updatedAt<b.updatedAt?1:-1)).slice(0,30).map(item);
 return {key,label:areaLabels[key],current,done};
}
