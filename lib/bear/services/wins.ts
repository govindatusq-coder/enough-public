import {daysBetween} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import {areaLabels} from '../domain/labels.ts';
const reasonText:Record<string,string>={late_fee_avoided:'Late fee avoided',early_discount_used:'Early payment discount',discount_used:'Discount used',better_price:'Better price',subscription_cancelled:'Subscription cancelled',duplicate_charge:'Duplicate charge found'};
import type {BearStore} from '../store/store.ts';
import {isLowLeverage,roleOf} from '../priority/importance.ts';
// My Wins: a visual receipt for invisible labour, not a completed-task list.
export interface WinsView{pressure:{early:number;rushes:number;followUps:number;offMind:number};
 // Strategic and cognitive outcomes this week: important projects moved forward, upkeep handled.
 strategic:{progressed:number;maintenance:number;line:string|null};totals:{handled:number;moneyCents:number;timeMinutes:number;forMe:number};cards:{id:string;title:string;detail:string;amount:string|null;when:string;isDemo:boolean;taskId:string|null;billId:string|null;areaKey:string;areaLabel:string;counted:{label:string;cents:number;mine:boolean}[]}[];breakdown:{money:{label:string;cents:number;reason:string;when:string;mine:boolean}[];time:{label:string;minutes:number;when:string}[];forMe:{title:string;when:string}[]};reinforcement:string|null}
export async function winsView(store:BearStore,now=new Date()):Promise<WinsView>{
 const wins=await store.list('wins',{orderBy:{column:'created_at',ascending:false},limit:100});
 const ledger=await store.list('value_ledger',{orderBy:{column:'occurred_at',ascending:false},limit:300});
 // Example data is shown on its card but never counted in the totals.
 const moneyCents=ledger.filter(r=>r.kind==='wealth'&&r.defensible&&!r.isDemo).reduce((s,r)=>s+(r.amountCents||0),0);
 const timeMinutes=ledger.filter(r=>r.kind==='happiness'&&!r.isDemo).reduce((s,r)=>s+(r.minutes||0),0);
 const meWins=wins.filter(w=>w.category==='me'&&!w.isDemo);const forMeEntries=ledger.filter(r=>r.kind==='health'&&!r.isDemo);const forMe=meWins.length+forMeEntries.length;
 const completions=new Map((await store.list('completions',{limit:300})).map(c=>[c.id,c.taskId]));
 const [tasks,projects]=await Promise.all([store.list('tasks'),store.list('projects')]);const areaOfTask=new Map(tasks.map(t=>[t.id,projects.find(p=>p.id===t.projectId)?.areaKey||'me']));
 // Pressure prevented: the invisible work, counted honestly from what actually happened.
 const allCompletions=await store.list('completions',{limit:500});const demoTask=new Set(tasks.filter(t=>t.isDemo).map(t=>t.id));const real=allCompletions.filter(c=>!demoTask.has(c.taskId));
 const early=real.filter(c=>c.daysBeforeDue!==null&&c.daysBeforeDue>=2).length;
 const rushes=real.filter(c=>c.timing?.latestSafe&&c.timing.deadline&&c.completedAt.slice(0,10)<=c.timing.latestSafe&&(daysBetween(c.completedAt.slice(0,10),c.timing.deadline)??0)>=2).length;
 const reminders=await store.list('reminders',{limit:500});const followUps=reminders.filter(r=>r.deliveredAt&&!demoTask.has(r.taskId)&&(r.plan.windowId==='load'||r.kind==='deadline'||r.kind==='follow_up')).length+tasks.filter(t=>!t.isDemo&&t.load?.nodes.some(n=>n.evidence.some(e=>e.key==='response_received'))).length;
 const offMind=tasks.filter(t=>!t.isDemo&&t.load&&!t.load.migrated).length;
 // Progress means real steps on a project that moves the person forward (not tidy-ups); upkeep is
 // everything that keeps life running. Both count; neither is dressed up.
 const weekAgo=new Date(now.getTime()-7*86400000).toISOString();const projectOf=new Map(projects.map(p=>[p.id,p]));
 let progressed=0,maintenance=0;const moved=new Map<string,number>();
 for(const c of real.filter(c=>c.completedAt>=weekAgo)){const t=tasks.find(x=>x.id===c.taskId);if(!t)continue;const p=projectOf.get(t.projectId);
  const role=roleOf(t.load?.nodes[0]?.pattern||'UNKNOWN_LOAD',`${t.title} ${t.notes||''}`,p?.role||null,null).role;
  if(role==='progress'&&!isLowLeverage(t.title)&&p&&p.importance!=='not'){progressed++;moved.set(p.title,(moved.get(p.title)||0)+(p.importance==='very'?2:1));}
  else if(role==='maintain'||role==='prevent')maintenance++;}
 const top=[...moved].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const strategicLine=top?(offMind>=2?`Bear kept ${offMind} little things out of your head while you moved ${top} forward.`:`You moved ${top} forward this week.`):null;
 const lines=['One less thing to carry.',"That's sorted."];
 return {strategic:{progressed,maintenance,line:strategicLine},pressure:{early,rushes,followUps,offMind},totals:{handled:wins.filter(w=>!w.isDemo).length,moneyCents,timeMinutes,forMe},cards:wins.map(w=>{const taskId=completions.get(w.completionId)||null;const areaKey=(taskId&&areaOfTask.get(taskId))||(w.billId?'money':'me');return {areaKey,areaLabel:areaLabels[areaKey]||'Me',id:w.id,title:w.title,detail:w.detail,amount:w.amountCents?'+'+formatAUD(w.amountCents):null,when:w.createdAt,isDemo:w.isDemo,taskId,billId:w.billId,counted:ledger.filter(r=>r.kind==='wealth'&&r.defensible&&taskId&&r.sourceTaskId===taskId).map(r=>({label:r.label,cents:r.amountCents||0,mine:r.source==='user'}))};}),breakdown:{money:ledger.filter(r=>r.kind==='wealth'&&r.defensible&&!r.isDemo).map(r=>({label:r.label,cents:r.amountCents||0,reason:reasonText[r.reason]||r.reason,when:r.occurredAt,mine:r.source==='user'})),time:ledger.filter(r=>r.kind==='happiness'&&!r.isDemo).map(r=>({label:r.label,minutes:r.minutes||0,when:r.occurredAt})),forMe:[...meWins.map(w=>({title:w.title,when:w.createdAt})),...forMeEntries.map(r=>({title:r.label,when:r.occurredAt}))]},reinforcement:wins.length&&wins.length%3===1?lines[wins.length%lines.length]:null};
}
