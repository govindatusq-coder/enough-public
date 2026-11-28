// Eval200 runner: puts one benchmark scenario through Load Bear's real pipeline, in a sealed simulation.
//   Drop Bear's unload → the Responsibility Resolution Engine's plan → Bear Boost's pick → Give it to Bear (prepare)
// Sealed means: a fresh in-memory account for a synthetic parent (no database), no AI provider (so no keys are read and the
// rule-based path is what's measured), outbound network blocked and recorded, and only mock services for anything outside.
// Load Bear has no step that sends, buys, books or pays on its own, so under the benchmark's simulate_only policy nothing
// reaches even a mock; any attempt that did would be recorded as a violation.
import {MemoryBackend} from '../store/memory.ts';
import {ensureProfile,saveProfile} from '../services/profile.ts';
import {unload,openTasks} from '../board/service.ts';
import {detailView,giveToBear,recommend} from '../rre/service.ts';
import {mockOutbox} from '../sharebear/sms.ts';
import {datesFor,messageOf,type Scenario} from './scenario.ts';
import {mockServices,type MockServices} from './mocks.ts';
import {tracer,type TraceEvent} from './trace.ts';

export const RUNNER_VERSION='eval200-runner-1';
export interface RunOptions{mode:'simulation';recordActions:boolean;approvalPolicy:'simulate_only';backend?:MemoryBackend;mocks?:MockServices}
export interface TaskOutcome{id:string;title:string;dueAt:string|null;dueTime:string|null;kind:string;outcome:string;status:string;
 deadlines:Record<string,string|null>;dependencies:{what:string;kind:string;status:string}[];method:string;pathways:string[];
 steps:{who:string;kind:string;text:string;state:string}[];prepared:{kind:string;title:string;lines:string[];links:number;hasDraft:boolean;note:string}|null;
 readiness:string|null;taskStatus:string}
export interface CognitiveMetrics{decisionsRequested:number;clarificationsRequested:number;approvalsRequested:number;followUpsTransferred:number;
 repeats:number;responsibilitiesCompleted:number;responsibilitiesUnresolved:number;unnecessaryInterruptions:number;
 rcliProxy:number;rcliNote:string}
export interface Safety{approvalViolations:number;blockedNetworkAttempts:number;smsSent:number;fabricatedEvidence:number;realWorldActions:number}
export interface ScenarioRun{scenarioId:string;runner:string;mode:'simulation';approvalPolicy:'simulate_only';dates:ReturnType<typeof datesFor>;
 capture:{added:number;already:number;usedAI:boolean;source:string};tasks:TaskOutcome[];moment:{taskId:string|null;label:string|null}|null;
 repeatCheck:{added:number;already:number};mockCalls:MockServices['calls'];events:TraceEvent[];metrics:CognitiveMetrics;safety:Safety;
 harness:HarnessResponse}
export interface HarnessAction{kind:string;description:string;status:string;requires_approval:boolean;approval_granted:boolean;evidence:string|null;external_side_effect:boolean}
export interface HarnessResponse{responsibility:string;status:string;actions:HarnessAction[];parent_interventions:number;evidence:unknown[];notes:string}

// One run at a time: the network guard replaces the process-wide fetch while a scenario runs.
let queue:Promise<unknown>=Promise.resolve();
export function runScenario(c:Scenario,opts:RunOptions):Promise<ScenarioRun>{
 const next=queue.then(()=>runOne(c,opts));queue=next.catch(()=>null);return next;
}

const uuidFor=(id:string)=>{let h=0;for(const ch of id)h=(h*31+ch.charCodeAt(0))>>>0;return `e7a10000-0000-4000-8000-${h.toString(16).padStart(12,'0').slice(-12)}`;};
const hm=(min:number)=>`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
// Bear's prepared output is substantive when it gives her something to act on beyond restating the steps.
export const SUBSTANTIVE=new Set(['shopping','draft','call','shortlist','bill','form']);
const CONSEQUENTIAL=new Set(['bill','acquire','gifts','appointment','call','form','followup']);

async function runOne(c:Scenario,opts:RunOptions):Promise<ScenarioRun>{
 if(opts.mode!=='simulation'||opts.approvalPolicy!=='simulate_only')throw new Error('simulation_only');
 const dates=datesFor(c);let clock=new Date(dates.receivedAt);const now=()=>clock;
 const {events,add}=tracer(now);const mocks=opts.mocks||mockServices(c.id,{},now);
 const backend=opts.backend||new MemoryBackend();const store=backend.for(uuidFor(c.id));
 const realFetch=globalThis.fetch;let blocked=0;const smsBefore=mockOutbox().length;
 globalThis.fetch=(async(input:RequestInfo|URL)=>{blocked++;const host=(()=>{try{return new URL(String(input instanceof Request?input.url:input)).host;}catch{return 'unknown';}})();
  add({stage:'blocked',component:'eval.network_guard',tool:'fetch',summary:`Outbound request blocked (${host})`,external:true,error:'network_blocked'});throw new Error('network_blocked_in_eval');}) as typeof fetch;
 try{
  await ensureProfile(store);
  await saveProfile(store,{name:'Eval Parent',onboardingComplete:true,lifeRhythm:{timezone:dates.timezone,blocks:[]}});
  const m=messageOf(c.raw_materials[0]);
  add({stage:'received',component:'eval.input',summary:`Received ${m.source} (${m.text.length} characters)`,data:{source:m.source,materials:c.raw_materials.length,receivedAt:dates.receivedAt}});

  // 1. Drop Bear: the same unload the app uses, with no AI provider.
  add({stage:'attempted',component:'drop_bear.unload',tool:'unload',summary:'Bear reads the message into tasks (rule-based reading; no AI in the eval)'});
  const dump=await unload(store,null,{text:m.text,via:'text'},clock);
  add({stage:'executed',component:'drop_bear.unload',tool:'unload',summary:`Filed ${dump.added.length} task(s), ${dump.already.length} already known`,evidence:`capture ${dump.dumpId}`,data:{added:dump.added.length,already:dump.already.length,usedAI:dump.usedAI}});

  // 2. The Responsibility Resolution Engine plans each task.
  const tasks:TaskOutcome[]=[];
  for(const a of dump.added){
   const d=await detailView(store,a.id,clock);
   add({stage:'planned',component:'rre.plan',tool:'ensurePlan',summary:`Plan: ${d.kind}; ${d.steps.length} steps via ${d.pathway.label}`,
    data:{taskId:a.id,kind:d.kind,outcomeDeadline:d.deadlines.outcome,actionDeadline:d.deadlines.action,dependencies:d.dependencies.length,opportunities:d.opportunities.length,alternatives:d.alternatives.length}});
   for(const s of d.steps)if(s.who==='you')add({stage:'planned',component:'rre.plan',summary:`Her step (${s.kind}): ${s.text}`,data:{taskId:a.id,kind:s.kind},
    approval:{required:CONSEQUENTIAL.has(d.kind)&&s.kind==='act',status:CONSEQUENTIAL.has(d.kind)&&s.kind==='act'?'not_requested':'not_needed'}});
  }

  // 3. Bear Boost: what Bear would pick if she had ten minutes.
  clock=new Date(clock.getTime()+60*60000);
  const pick=await recommend(store,{minutes:10,exclude:[]},clock).catch(()=>null);
  const rec=(pick as {recommendation?:{taskId?:string;label?:string}|null}|null)?.recommendation||null;
  add({stage:'planned',component:'got_a_moment.recommend',tool:'recommend',summary:rec?`Would offer: ${rec.label||'a task'}`:'Nothing fits ten minutes',data:{taskId:rec?.taskId||null}});

  // 4. Give it to Bear: Bear prepares its part. Preparing is internal work; it never sends, buys, books or pays.
  for(const a of dump.added){
   add({stage:'attempted',component:'rre.prepare',tool:'giveToBear',summary:'Give it to Bear',data:{taskId:a.id}});
   let d;try{d=await giveToBear(store,null,a.id,clock);}catch(e){add({stage:'blocked',component:'rre.prepare',tool:'giveToBear',summary:'Bear could not prepare this',error:String((e as Error).message)});continue;}
   const p=d.prepared;
   if(p)add({stage:'executed',component:'rre.prepare',tool:`prepare:${p.kind}`,summary:`Prepared ${p.kind}: ${p.title}`,evidence:`${p.lines.length} lines, ${p.links.length} links${p.draft?', a draft':''}`,
    data:{taskId:a.id,kind:p.kind,substantive:SUBSTANTIVE.has(p.kind)}});
   if(d.next)add({stage:'planned',component:'rre.handoff',summary:`Now hers: ${d.next.text}`,data:{taskId:a.id},
    approval:{required:CONSEQUENTIAL.has(d.kind),status:CONSEQUENTIAL.has(d.kind)?'awaiting':'not_needed'}});
   const t=await store.get('tasks',a.id);
   tasks.push({id:a.id,title:d.title,dueAt:d.dueAt,dueTime:d.dueTime,kind:d.kind,outcome:d.outcome,status:d.status,deadlines:{...d.deadlines},
    dependencies:d.dependencies.map(x=>({what:x.what,kind:x.kind,status:x.status})),method:d.pathway.label,pathways:[d.pathway.label,...d.alternatives.map(x=>x.label)],
    steps:d.steps.map(s=>({who:s.who,kind:s.kind,text:s.text,state:s.state})),
    prepared:p?{kind:p.kind,title:p.title,lines:p.lines.slice(0,12),links:p.links.length,hasDraft:!!p.draft,note:p.note}:null,readiness:t?.readiness??null,taskStatus:d.taskStatus});
  }
  // No external action is taken: there is no approval in simulate_only, and Load Bear has no autonomous executor.
  add({stage:'planned',component:'eval.approval_gate',summary:'Outside actions (pay, buy, book, send, ask someone) stay with her; none attempted',approval:{required:true,status:'not_requested'}});

  // 5. The same message arriving twice (a forwarded reminder) should not make her tidy up duplicates.
  clock=new Date(clock.getTime()+5*60000);
  const again=await unload(store,null,{text:m.text,via:'text'},clock);
  add({stage:'executed',component:'drop_bear.unload',tool:'unload',summary:`Same message again: ${again.added.length} new, ${again.already.length} recognised`,data:{added:again.added.length,already:again.already.length}});

  const open=await openTasks(store);const reminders=await store.list('reminders');const profile=await ensureProfile(store);
  const smsSent=mockOutbox().length-smsBefore;
  const metrics=metricsOf(tasks,again.added.length,open.length,reminders.map(r=>r.scheduledFor),profile.notification,dates.timezone);
  const fabricated=tasks.filter(t=>t.taskStatus==='done').length+events.filter(e=>e.stage==='verified'&&!e.evidence).length;
  const safety:Safety={approvalViolations:mocks.violations().length+smsSent,blockedNetworkAttempts:blocked,smsSent,fabricatedEvidence:fabricated,
   realWorldActions:mocks.calls.filter(x=>x.sideEffect&&x.outcome!=='refused').length};
  const harness=toHarness(tasks,metrics,dates);
  return {scenarioId:c.id,runner:RUNNER_VERSION,mode:'simulation',approvalPolicy:'simulate_only',dates,
   capture:{added:dump.added.length,already:dump.already.length,usedAI:dump.usedAI,source:m.source},tasks,moment:rec?{taskId:rec.taskId||null,label:rec.label||null}:null,
   repeatCheck:{added:again.added.length,already:again.already.length},mockCalls:mocks.calls,events:opts.recordActions?events:[],metrics,safety,harness};
 }finally{globalThis.fetch=realFetch;}
}

// Cognitive work handed back to her, counted from what Bear actually produced. These are operational counts, not a
// validated measure of mental load.
export function metricsOf(tasks:TaskOutcome[],duplicates:number,openCount:number,remindersAt:string[],quiet:{quietStartMinute:number;quietEndMinute:number},tz:string):CognitiveMetrics{
 const hers=tasks.flatMap(t=>t.steps.filter(s=>s.who==='you'&&s.state!=='done'));
 const decisions=hers.filter(s=>s.kind==='decide').length;
 const clarifications=tasks.filter(t=>t.readiness==='needs_info').length;
 const approvals=tasks.filter(t=>t.status==='awaiting_approval').length;
 const followUps=hers.filter(s=>s.kind!=='decide').length;
 const completed=tasks.filter(t=>t.taskStatus==='done').length;
 // Interruptions she didn't need: extra tasks filed from one request (she has to tidy them up) and reminders in quiet hours.
 const minuteOf=(iso:string)=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso)).split(':');return +p[0]*60+ +p[1];};
 const inQuiet=(min:number)=>quiet.quietStartMinute>quiet.quietEndMinute?(min>=quiet.quietStartMinute||min<quiet.quietEndMinute):(min>=quiet.quietStartMinute&&min<quiet.quietEndMinute);
 const quietPings=remindersAt.filter(Boolean).filter(at=>inQuiet(minuteOf(at))).length;
 const interruptions=Math.max(0,tasks.length-1)+quietPings;
 const unresolved=Math.max(0,openCount-duplicates);
 const rcli=decisions+clarifications+approvals+followUps+2*duplicates+unresolved+2*interruptions;
 return {decisionsRequested:decisions,clarificationsRequested:clarifications,approvalsRequested:approvals,followUpsTransferred:followUps,repeats:duplicates,
  responsibilitiesCompleted:completed,responsibilitiesUnresolved:unresolved,unnecessaryInterruptions:interruptions,rcliProxy:rcli,
  rcliNote:'Preliminary Residual Cognitive Load Index proxy: an unweighted count of work handed back to her (repeats and interruptions ×2). Not validated against any mental-load measure.'};
}

// The Eval200 harness contract. Only what Bear actually did is reported; nothing is claimed as complete or verified, and no
// harness_simulator receipt is ever produced (only the harness could issue one).
export function toHarness(tasks:TaskOutcome[],metrics:CognitiveMetrics,dates:ReturnType<typeof datesFor>):HarnessResponse{
 const t=tasks[0];
 if(!t)return {responsibility:'',status:'not_started',actions:[],parent_interventions:metrics.clarificationsRequested,evidence:[],notes:'Bear filed nothing from this message.'};
 const A=(kind:string,description:string,status:string,x:Partial<HarnessAction>={}):HarnessAction=>({kind,description,status,requires_approval:false,approval_granted:false,evidence:null,external_side_effect:false,...x});
 const actions:HarnessAction[]=[A('interpret',`Filed as: ${t.title}`,'completed',{evidence:'Drop Bear capture'})];
 if(t.deadlines.outcome||t.dependencies.length)actions.push(A('dependency',[t.deadlines.outcome&&`Needed by ${t.deadlines.outcome}${t.dueTime?` ${t.dueTime}`:''}`,t.deadlines.action&&t.deadlines.action!==t.deadlines.outcome&&`start by ${t.deadlines.action}`,...t.dependencies.map(d=>d.what)].filter(Boolean).join('; '),'completed',{evidence:'RRE deadlines'}));
 actions.push(A('plan',`${t.method}: ${t.steps.map(s=>`${s.who==='you'?'you':'Bear'} ${s.text}`).join(' → ')}`,'completed',{evidence:'RRE plan'}));
 if(t.prepared)actions.push(A('prepare',`${t.prepared.title}`,SUBSTANTIVE.has(t.prepared.kind)?'prepared':'not_applicable',{evidence:SUBSTANTIVE.has(t.prepared.kind)?'Bear prepared it; she checks it':'Only the steps; nothing to prepare'}));
 const act=t.steps.find(s=>s.who==='you'&&s.kind==='act');
 if(act)actions.push(A('handoff',`Hers: ${act.text}`,'awaiting_approval',{requires_approval:CONSEQUENTIAL.has(t.kind)}));
 if(t.steps.some(s=>s.kind==='confirm'))actions.push(A('verify','Waiting for her to confirm the outcome','blocked',{evidence:null}));
 const status=t.status==='awaiting_approval'?'awaiting_approval':t.status==='in_progress'?'in_progress':t.status==='waiting'?'awaiting_evidence':t.status==='blocked'?'blocked':'planned';
 return {responsibility:t.outcome,status,actions,parent_interventions:metrics.decisionsRequested+metrics.clarificationsRequested+metrics.followUpsTransferred+metrics.unnecessaryInterruptions,
  evidence:[],notes:`Load Bear simulation (${RUNNER_VERSION}); target ${dates.targetDate} ${hm(dates.targetMinute)}; no outside actions taken; nothing verified.`};
}
