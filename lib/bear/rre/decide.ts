// RRE part 4: choosing one useful thing for the time she has right now. Not "the highest priority task":
// the action with the most practical benefit in this window. Transparent, staged, and stable.
import {businessOpen} from '../board/logic.ts';
import {daysBetween,formatAU} from '../domain/dates.ts';
import type {Opportunity,Step} from './model.ts';
import {currentStep,daysLeft,selectedPath,RULES_VERSION,type Plan} from './plan.ts';

export interface Candidate{taskId:string;title:string;listId:string|null;plan:Plan;status:string;readiness?:string|null;blockedByShare?:boolean}
export interface MomentContext{minutes:number;now:Date;today:string;timeZone:string;exclude?:string[];last?:{taskId:string;minutes:number;at:string}|null}
export type Label='Deadline approaching'|'Opportunity closing'|'Ready for approval'|'Saves time later'|'Worth doing now'|'Quick win'|'Fits your time';
export interface Factors{risk:'high'|'medium'|'low'|'none';opp:Opportunity|null;oppLevel:0|1|2;ready:boolean;fit:boolean;minutes:number;aspiration:boolean}
export interface Recommendation{taskId:string;title:string;label:Label;minutes:number;why:string;needsBear:boolean;alternative:{taskId:string;title:string}|null;confidence:number}
export interface TraceItem{taskId:string;title:string;action:string|null;minutes:number|null;excluded:string|null;factors:Factors|null}
export interface Trace{at:string;rules:string;minutes:number;considered:TraceItem[];selected:string|null;reason:string;confidence:number}
export interface MomentResult{recommendation:Recommendation|null;message:string|null;suggestMinutes:number|null;waiting:number;trace:Trace}

const RISK={high:3,medium:2,low:1,none:0} as const;
// The first thing she has to do herself, and whether Bear prepares something before it.
export function nextForHer(p:Plan):{step:Step;needsBear:boolean}|null{
 const steps=selectedPath(p).steps;let needsBear=false;
 for(let i=p.stepIndex;i<steps.length;i++){const s=steps[i];
  if(s.who==='bear'){if(!(p.execution.prepared&&i===p.stepIndex&&p.execution.state!=='not_started'))needsBear=true;continue;}
  if(s.kind==='wait')return null;return {step:s,needsBear};}
 return null;
}
function riskOf(p:Plan,today:string):Factors['risk']{
 if(p.kind==='aspiration')return 'none';
 // Genuine risk to the outcome: the time left after the shortest lead time of any way that still works. One tight
 // option (online delivery) doesn't make the whole thing urgent if it can still be bought locally.
 if(!p.deadlines.outcome)return 'none';
 const lead=Math.min(...p.pathways.filter(x=>x.feasibility!=='infeasible').map(x=>x.leadDays),99);
 const d=daysLeft(p.deadlines.outcome,today);if(d===null)return 'none';const slack=d-(lead===99?0:lead);
 return slack<=1?'high':slack<=3?'medium':'low';
}
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}

export interface PoolItem{c:Candidate;f:Factors;step:Step;needsBear:boolean;title:string}
// The hard feasibility checks, shared by Got a Moment's own choice and the adaptive engine: what she could actually do now.
export function candidatesFor(items:Candidate[],ctx:MomentContext){
 const {minutes,today,now}=ctx;const open=businessOpen(now,ctx.timeZone);const hour=Number(new Intl.DateTimeFormat('en-AU',{timeZone:ctx.timeZone,hour:'numeric',hourCycle:'h23'}).format(now));
 const evening=hour>=19||hour<6;const considered:TraceItem[]=[];const pool:PoolItem[]=[];
 let waiting=0;const tooLong:number[]=[];
 for(const c of items){
  const p=c.plan;const base={taskId:c.taskId,title:c.title};
  if(c.status!=='open'){continue;}
  if(ctx.exclude?.includes(c.taskId)){considered.push({...base,action:null,minutes:null,excluded:'you asked for something else',factors:null});continue;}
  if(c.blockedByShare){waiting++;considered.push({...base,action:null,minutes:null,excluded:'handed to someone else',factors:null});continue;}
  if(c.readiness==='waiting'||c.readiness==='needs_info'){waiting++;considered.push({...base,action:null,minutes:null,excluded:`marked ${c.readiness.replace('_',' ')}`,factors:null});continue;}
  const dep=p.dependencies.find(d=>d.status==='open');
  // Waiting on a delivery or a reply: not something she can do now, until the expected day passes.
  let step:Step|null;let needsBear=false;let title:string;
  if(dep&&(!dep.expectedBy||dep.expectedBy>=today)){waiting++;considered.push({...base,action:null,minutes:null,excluded:`waiting on ${dep.what.toLowerCase()} until ${dep.expectedBy||'later'}`,factors:null});continue;}
  if(dep){step={id:'check',text:dep.kind==='delivery'?`Check ${p.item?`the ${p.item}`:'the order'} has arrived`:`Follow up: no reply yet`,who:'you',kind:'confirm',userMinutes:2,context:'any'};title=step.text;}
  else{const n=nextForHer(p);if(!n){considered.push({...base,action:null,minutes:null,excluded:'nothing for you to do yet',factors:null});continue;}step=n.step;needsBear=n.needsBear;title=n.step.text;}
  if(selectedPath(p).feasibility==='infeasible'){considered.push({...base,action:title,minutes:step.userMinutes,excluded:'this way can’t work in time; choose another in Bear Brain',factors:null});continue;}
  if(step.context==='phone'&&!open){considered.push({...base,action:title,minutes:step.userMinutes,excluded:'businesses are closed now',factors:null});continue;}
  if(step.context==='errand'&&minutes<60){considered.push({...base,action:title,minutes:step.userMinutes,excluded:'needs a trip out',factors:null});continue;}
  if(step.userMinutes>minutes){tooLong.push(step.userMinutes);considered.push({...base,action:title,minutes:step.userMinutes,excluded:`takes about ${step.userMinutes} min`,factors:null});continue;}
  const risk=riskOf(p,today);
  const recentlySkipped=p.dismissed.some(d=>now.getTime()-Date.parse(d)<24*3600000);
  if(recentlySkipped&&risk!=='high'){considered.push({...base,action:title,minutes:step.userMinutes,excluded:'you skipped it recently',factors:null});continue;}
  const sel=selectedPath(p);
  const opp=p.opportunities.find(o=>o.status!=='expired'&&(o.id!=='order-online'||sel.id==='online'))||null;
  const oppLevel:0|1|2=!opp?0:opp.status==='expiring'||(opp.until&&(daysBetween(today,opp.until)??9)<=1)?2:opp.status==='available'?1:0;
  const ready=p.execution.state==='ready_for_review'||p.execution.state==='awaiting_approval';
  const fit=(evening&&c.listId==='night')||(step.context==='phone'&&open)||step.userMinutes>=minutes*0.4;
  const f:Factors={risk,opp,oppLevel,ready,fit,minutes:step.userMinutes,aspiration:p.kind==='aspiration'};
  considered.push({...base,action:title,minutes:step.userMinutes,excluded:null,factors:f});pool.push({c,f,step,needsBear,title});
 }
 return {pool,considered,waiting,tooLong,open,evening};
}
export function chooseMoment(items:Candidate[],ctx:MomentContext):MomentResult{
 const {minutes,today,now}=ctx;const {pool,considered,waiting,tooLong}=candidatesFor(items,ctx);
 const trace=(selected:string|null,reason:string,confidence:number):Trace=>({at:now.toISOString(),rules:RULES_VERSION,minutes,considered,selected,reason,confidence});
 if(!pool.length){
  const shortest=tooLong.length?Math.min(...tooLong):null;const suggest=shortest?[5,10,20,60].find(m=>m>=shortest)||null:null;
  const message=shortest&&suggest&&suggest>minutes?`Nothing fits ${minutes>=60?'right now':`${minutes} minutes`}. The next thing takes about ${shortest} minutes.`:waiting?`Nothing needs your attention right now. Bear is keeping an eye on ${waiting===1?'one thing':`${waiting} things`} that are waiting.`:'Nothing needs your attention right now.';
  return {recommendation:null,message,suggestMinutes:suggest&&suggest>minutes?suggest:null,waiting,trace:trace(null,message,1)};
 }
 // Stage: drop options that are worse in every way than another (Pareto), then a transparent order of reasons.
 const vec=(f:Factors)=>[RISK[f.risk],f.oppLevel,f.ready?1:0,f.fit?1:0,f.aspiration?0:1,-f.minutes];
 const dominated=(a:number[],b:number[])=>b.every((x,i)=>x>=a[i])&&b.some((x,i)=>x>a[i]);
 const front=pool.filter(x=>!pool.some(y=>y!==x&&dominated(vec(x.f),vec(y.f))));
 const key=(x:typeof pool[number])=>[x.f.risk==='high'?0:1,x.f.oppLevel===2?0:1,x.f.ready?0:1,x.f.risk==='medium'?0:1,x.f.oppLevel===1?0:1,x.f.fit?0:1,x.f.aspiration?1:0,x.f.minutes];
 const salt=today;const order=(a:typeof pool[number],b:typeof pool[number])=>{const ka=key(a),kb=key(b);for(let i=0;i<ka.length;i++)if(ka[i]!==kb[i])return ka[i]-kb[i];return hash(a.c.taskId+salt)-hash(b.c.taskId+salt);};
 const sorted=[...front].sort(order);
 // Stability: the same window asked again soon gets the same suggestion, unless something genuinely more pressing appeared.
 let top=sorted[0];
 if(ctx.last&&ctx.last.minutes===minutes&&now.getTime()-Date.parse(ctx.last.at)<3*3600000){const keep=pool.find(x=>x.c.taskId===ctx.last!.taskId);if(keep&&!(top.f.risk==='high'&&keep.f.risk!=='high'))top=keep;}
 const runner=sorted.find(x=>x!==top)||null;
 const tie=!!runner&&key(runner).every((v,i)=>v===key(top)[i]);
 const {label,why}=explain(top.c.plan,top.f,top.needsBear,today);
 const confidence=Math.round(selectedPath(top.c.plan).confidence*(tie?0.7:1)*100)/100;
 const rec:Recommendation={taskId:top.c.taskId,title:top.title,label,minutes:top.f.minutes,why:tie?`${why} ${runner!.title} would be just as good.`:why,needsBear:top.needsBear,alternative:tie?{taskId:runner!.c.taskId,title:runner!.title}:null,confidence};
 return {recommendation:rec,message:null,suggestMinutes:null,waiting,trace:trace(top.c.taskId,`${label}: ${why}`,confidence)};
}

// Short and true to the reason it was chosen. Never "you must", "most important" or "you're behind".
export function explain(p:Plan,f:Factors,needsBear:boolean,today:string):{label:Label;why:string}{
 const d=daysLeft(p.deadlines.outcome,today);const day=p.deadlines.outcome?(d===0?'today':d===1?'tomorrow':`${formatAU(p.deadlines.outcome,'weekday')}`):null;
 if(f.risk==='high')return {label:'Deadline approaching',why:day?`It’s needed ${day==='today'||day==='tomorrow'?day:`by ${day}`}, so now keeps it on track.`:'Doing it now keeps it on track.'};
 if(f.opp&&f.opp.id==='gifts-early')return {label:'Worth doing now',why:`${needsBear?'Bear will prepare some gift ideas.':'Bear has prepared some gift ideas.'} ${f.opp.description}`};
 if(f.opp&&f.oppLevel>0&&f.opp.avoids&&f.opp.avoids.includes('trip'))return {label:'Saves time later',why:f.opp.description};
 if(f.opp&&f.oppLevel===2)return {label:'Opportunity closing',why:f.opp.description};
 if(f.ready)return {label:'Ready for approval',why:'Bear has this ready for you to check.'};
 if(f.opp&&f.oppLevel===1)return {label:'Saves time later',why:f.opp.description};
 if(f.risk==='medium'&&day)return {label:'Worth doing now',why:`It’s needed by ${day}; there’s no rush, but it fits now.`};
 if(f.minutes<=3)return {label:'Quick win',why:`Takes about ${f.minutes} minute${f.minutes===1?'':'s'}.`};
 return {label:'Fits your time',why:p.kind==='aspiration'?'No deadline. Only if you feel like it.':'There’s no need to deal with this today, but it fits the time you have.'};
}
// The same transparent order chooseMoment uses, for breaking ties elsewhere (the adaptive engine).
export const momentKey=(x:PoolItem)=>[x.f.risk==='high'?0:1,x.f.oppLevel===2?0:1,x.f.ready?0:1,x.f.risk==='medium'?0:1,x.f.oppLevel===1?0:1,x.f.fit?0:1,x.f.aspiration?1:0,x.f.minutes];
export const tieHash=hash;
