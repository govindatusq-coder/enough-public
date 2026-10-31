import {z} from 'zod';
import {addDays,daysBetween} from '../domain/dates.ts';
import type {Importance,Profile,Project,Suggestion,SuggestionKind,Task} from '../domain/types.ts';
import {flags} from '../flags.ts';
import {friendlyDate,the} from '../load/words.ts';
import {recompute} from '../load/engine.ts';
import {describe} from '../load/view.ts';
import {caps} from './load.ts';
import {importanceLabel,roleLabel} from '../priority/importance.ts';
import {strategicAttention,type ProjectAttention} from '../strategy/attention.ts';
import {orchestrate,type Capacity,type Idea,type IdeaActionKey,type IdeaScore,type Orchestrated} from '../strategy/ideas.ts';
import type {BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {notToday,prioritiseOpen,type Prioritised} from './priority.ts';
import {ensureProfile} from './profile.ts';
import {refreshSuggestions,respondToSuggestion} from './suggestions.ts';

// Bear Ideas service: gathers candidates from every engine and lets the orchestrator choose a few.
const S=(p:Partial<IdeaScore>):IdeaScore=>({loadRemoved:0,pressure:0,strategic:0,decisions:0,money:0,leverage:0,effort:0,uncertainty:0,interruption:0.1,...p});

// ---------- Family A: the Mental Load Opportunity Engine ----------
// The existing pattern ideas (bills, recurring, discounts, related areas) stay exactly as they were;
// they are typed here so they compete fairly, and keep their own accept / "Not relevant" behaviour.
const suggestionType:Record<SuggestionKind,{type:Idea['type'];eyebrow:string;score:Partial<IdeaScore>}>={
 expect_recurring:{type:'recurring_pattern',eyebrow:'Bear can expect it',score:{loadRemoved:0.8,decisions:0.2}},
 watch_annual:{type:'monitor',eyebrow:'Bear can watch for it',score:{loadRemoved:0.75,pressure:0.2}},
 bill_increased:{type:'save_money',eyebrow:'Could save money',score:{loadRemoved:0.4,money:0.6,effort:0.15}},
 discount_available:{type:'save_money',eyebrow:'Could save money',score:{loadRemoved:0.6,money:0.8}},
 add_related_areas:{type:'remember',eyebrow:'Bear can keep these together',score:{loadRemoved:0.55}},
 missing_expected:{type:'monitor',eyebrow:'Bear noticed',score:{loadRemoved:0.6,pressure:0.4}},
 plan_not_helping:{type:'simplify',eyebrow:'Bear noticed',score:{loadRemoved:0.5,decisions:0.3}},
 demo_bill:{type:'remember',eyebrow:'Try it',score:{loadRemoved:0.4}},
};
export function suggestionIdeas(list:Suggestion[]):Idea[]{
 return list.map(s=>{const m=suggestionType[s.kind];const billId=typeof s.payload.billId==='string'?s.payload.billId:null;
  return {id:'s:'+s.id,family:'load',type:m.type,eyebrow:m.eyebrow,title:s.title,body:s.body,actions:[{key:'accept',label:s.actionLabel,primary:true},{key:'reject',label:'Not relevant'}],suggestionId:s.id,suggestionKind:s.kind,href:s.kind==='bill_increased'&&billId?`/bear/bills/${billId}`:null,minutes:null,entity:billId?'bill:'+billId+':'+s.kind:'s:'+s.dedupeKey,score:S(m.score)};});
}
interface Ctx{tasks:Task[];projects:Project[];pr:Prioritised;today:string;profile:Profile}
const projectOfTask=(c:Ctx,t:Task)=>c.projects.find(p=>p.id===t.projectId);
const chipsFor=(imp:Importance|null|undefined,role:keyof typeof roleLabel|null|undefined)=>[...(imp?[importanceLabel[imp]]:[]),...(role?[roleLabel[role]]:[])];
const nameOf=(c:Ctx,t:Task)=>(t.load?describe(recompute(t.load,c.today,caps(),c.profile.loadMap),c.today).title:null)||t.title;
const mins=(n:number)=>`about ${n} minute${n===1?'':'s'}`;

// "ARC Linkage · ~2 min": the whole default explanation.
const meta=(project:string|null,minutes:number)=>[project,minutes?`~${minutes} min`:null].filter(Boolean).join(' · ');
export function mentalLoadIdeas(c:Ctx):Idea[]{
 const out:Idea[]=[];const {pr,today}=c;const title=(id:string)=>c.tasks.find(t=>t.id===id)?.title||'This one';
 const results=[...pr.results.values()].filter(r=>r.id!==pr.top?.id);
 // take_over: important and hard to start. Bear can carry more of it (smaller steps, details kept,
 // one step at a time). Honest about the limits: Bear can't make the call or compare quotes for you.
 for(const r of results.filter(r=>r.support==='prepare_more'&&r.importance>=0.45&&r.action)){
  const t=c.tasks.find(x=>x.id===r.id);if(!t)continue;
  if(t.bearSupport==='more'){if(r.firstStep)out.push({id:'start:'+t.id,family:'load',type:'prepare',eyebrow:'Start small',title:`A small way into ${the(t.title)}`,body:r.firstStep,actions:[{key:'open',label:'Start small',primary:true},{key:'later',label:'Not now'}],href:`/bear/tasks/${t.id}`,taskId:t.id,minutes:5,entity:'task:'+t.id,score:S({loadRemoved:0.4,pressure:r.futurePressureRisk*0.6,effort:0.08})});continue;}
  out.push({id:'takeover:'+t.id,family:'load',type:'take_over',eyebrow:'Bear can carry more of this',title:`Let Bear carry more of ${the(nameOf(c,t))}`,body:`It matters, and it’s the kind of thing that’s easy to put off. Bear can break it into small steps, keep the details together and bring back one step at a time. You still make the calls; Bear just makes each one smaller.`,actions:[{key:'take_over',label:'Yes, carry more',primary:true},{key:'dismiss',label:'I’m fine with it'}],taskId:t.id,minutes:null,entity:'task:'+t.id,why:[{key:'matters',title:'It matters',text:r.explanation.primaryReason},{key:'timing',title:'Heavy, not unimportant',text:'Putting something off usually means it’s heavy. More help beats more reminders.'}],score:S({loadRemoved:0.7,pressure:r.futurePressureRisk*0.5,uncertainty:0.1})});
 }
 // prepare: someone else needs a head start, and the comfortable moment is near.
 for(const r of results.filter(r=>r.explanation.reasons.some(x=>x.key==='lead')&&r.latestComfortableActionAt&&(daysBetween(today,r.latestComfortableActionAt)??99)<=10&&!r.surfaceNow).slice(0,2))
  out.push({id:'head:'+r.id,family:'load',type:'prepare',eyebrow:'Needs a head start',title:`Give ${the(title(r.id))} a head start`,body:`${r.explanation.reasons.find(x=>x.key==='lead')!.text} Starting by ${friendlyDate(r.latestComfortableActionAt,today)} keeps it calm.`,actions:[{key:'open',label:'Take a look',primary:true},{key:'later',label:'Not now'}],href:`/bear/tasks/${r.id}`,taskId:r.id,minutes:r.minutes,entity:'task:'+r.id,score:S({loadRemoved:0.3,pressure:0.7,effort:r.minutes/120})});
 // follow_up: the reply window has passed. Bear drafts the nudge; the person sends it.
 for(const t of c.tasks.filter(t=>t.status==='open'&&t.load?.nodes.some(n=>n.state==='waiting'&&n.waiting?.expectedBy&&n.waiting.expectedBy<today)).slice(0,2)){
  const n=t.load!.nodes.find(x=>x.waiting)!;const who=n.waiting!.waitingFor;
  out.push({id:'nudge:'+t.id,family:'load',type:'follow_up',eyebrow:'Bear drafted a nudge',title:`Still waiting on ${who}`,body:`It’s been a while for ${the(t.title)}. A short nudge often gets things moving. Bear wrote one you can copy and send.`,draft:`Hi, just following up on ${the(t.title)}. Is there an update? Thanks!`,actions:[{key:'copy',label:'Copy the nudge',primary:true},{key:'open',label:'Take a look'},{key:'later',label:'Not now'}],href:`/bear/tasks/${t.id}`,taskId:t.id,minutes:2,entity:'task:'+t.id,score:S({loadRemoved:0.6,pressure:0.35,decisions:0.2,effort:0.03})});
 }
 // reduce_coordination: an invitation that needs a reply. Bear drafts both answers.
 for(const r of results.filter(r=>r.action&&/\b(rsvp|reply|let .{1,30} know)\b/i.test(r.action)&&!r.surfaceNow&&r.timingLabel!=='Later is fine').slice(0,1)){
  const t=c.tasks.find(x=>x.id===r.id);if(!t)continue;
  const ev=t.title.replace(/^(rsvp|reply)\s+(to|for)\s+/i,'');
  out.push({id:'reply:'+t.id,family:'load',type:'reduce_coordination',eyebrow:'Bear drafted a reply',title:`A reply for ${the(ev)}, ready to send`,body:'One less message to compose. Keep the line that fits and send it when you’re ready.',draft:`Hi! Thanks so much for the invitation to ${the(ev)}. We’d love to come.\n\nOr: Thanks so much for thinking of us. Unfortunately we can’t make it this time.`,actions:[{key:'copy',label:'Copy the reply',primary:true},{key:'open',label:'Take a look'}],href:`/bear/tasks/${t.id}`,taskId:t.id,minutes:2,entity:'task:'+t.id,score:S({loadRemoved:0.45,decisions:0.3,pressure:r.futurePressureRisk*0.4,effort:0.03})});
 }
 // reduce_decisions: line up a brain dump, or tell Bear what matters.
 const unsorted=c.projects.find(p=>p.captureId&&p.status==='active'&&!p.priority);
 if(unsorted)out.push({id:'lineup:'+unsorted.captureId,family:'load',type:'reduce_decisions',eyebrow:'Fewer decisions',title:'Line up your projects',body:'Some projects from a list you gave Bear haven’t been lined up yet. One quick pass and Bear brings back only the next thing in each.',actions:[{key:'open',label:'Line them up',primary:true},{key:'later',label:'Not now'}],href:`/bear/sort/${unsorted.captureId}`,minutes:3,entity:'capture:'+unsorted.captureId,score:S({loadRemoved:0.5,decisions:0.7,effort:0.05})});
 if(!c.profile.valuesMap?.values.some(v=>v.source==='user'&&v.confidence>0)&&c.tasks.filter(t=>t.status==='open').length>=5)out.push({id:'matters',family:'load',type:'reduce_decisions',eyebrow:'Fewer decisions',title:'Tell Bear what matters to you',body:'A few taps help Bear tell what’s important from what’s just loud, so it asks you less.',actions:[{key:'open',label:'Choose',primary:true},{key:'dismiss',label:'Not now'}],href:'/bear/me#matters',minutes:2,entity:'values',score:S({loadRemoved:0.3,decisions:0.5,effort:0.04})});
 // simplify: things that have sat quietly for a month.
 const quiet=c.tasks.filter(t=>t.status==='open'&&t.timing==='flexible'&&!t.dueAt&&t.updatedAt.slice(0,10)<=addDays(today,-30));
 if(quiet.length>=3)out.push({id:'letgo',family:'load',type:'simplify',eyebrow:'Lighten the load',title:`${quiet.length} things have sat quietly for a month`,body:'If some don’t matter any more, letting them go is a real way to lighten the load.',actions:[{key:'open',label:'Have a look',primary:true},{key:'dismiss',label:'Not now'}],href:'/bear/me/everything',minutes:5,entity:'letgo',score:S({loadRemoved:0.55,decisions:0.3,effort:0.08})});
 return out;
}

// ---------- Family B: priority ideas (the "worth doing now" pick moved here from My Bear) ----------
export function priorityFamilyIdeas(c:Ctx):Idea[]{
 const out:Idea[]=[];const {pr,today}=c;
 const r=pr.top;const t=r?c.tasks.find(x=>x.id===r.id):null;
 if(r&&t){const p=projectOfTask(c,t);const pressure=r.explanation.reasons.find(x=>['pressure','lead','deadline','safety'].includes(x.key));
  const view=t.load?describe(recompute(t.load,today,caps(),c.profile.loadMap),today):null;const head=view?.needsYou?.headline;
  const name=p?.captureId?`${p.title}: ${t.title}`:(view?.title||t.title);
  const easy=!!pressure&&r.minutes<=10&&pressure.key==='pressure';
  // Minimal card: a calm label, the thing, where it lives and roughly how long. Reasons only on request.
  out.push({id:'top:'+t.id,family:'priority',type:'worth_doing_now',eyebrow:r.relationalStatus==='closing_loop'?'Worth closing the loop':easy?'Easy win before it gets urgent':'Worth doing now',title:name,body:meta(p?.captureId?p.title:null,r.minutes),actions:[{key:'open',label:'Do it now',primary:true},{key:'later',label:'Not now'}],href:`/bear/tasks/${t.id}`,taskId:t.id,minutes:r.minutes||5,critical:r.tier<=1,entity:'task:'+t.id,why:r.explanation.reasons,score:S({pressure:Math.max(0.6,r.pressurePreventionValue),loadRemoved:0.3,leverage:r.dependencyLeverage,effort:r.minutes/90})});}
 // close_loop: someone is waiting on a small thing from you. Skipped when you've already carried a lot today.
 for(const x of [...pr.results.values()].filter(x=>x.id!==r?.id&&x.relationalStatus==='closing_loop'&&x.action&&!['Coming up','Waiting','Bear is handling it','Sorted'].includes(x.timingLabel)&&x.minutes<=30).sort((a,b)=>b.importance-a.importance).slice(0,2)){
  const tt=c.tasks.find(y=>y.id===x.id);if(!tt||pr.present?.saturated)continue;const p=projectOfTask(c,tt);
  out.push({id:'loop:'+tt.id,family:'priority',type:'close_loop',eyebrow:'Worth closing the loop',title:tt.title,body:meta(p?.captureId?p.title:null,x.minutes),actions:[{key:'open',label:'Do it now',primary:true},{key:'later',label:'Not now'}],href:`/bear/tasks/${tt.id}`,taskId:tt.id,minutes:x.minutes||5,entity:'task:'+tt.id,why:x.explanation.reasons,score:S({leverage:0.6+0.3*x.dependencyLeverage,pressure:0.3,strategic:0.1*x.importance,effort:(x.minutes||5)/90})});
 }
 // unlock_project: a small step other steps are waiting on.
 for(const x of [...pr.results.values()].filter(x=>x.id!==r?.id&&x.dependencyLeverage>=0.25&&x.action&&!['Later is fine','Coming up','Waiting','Bear is handling it','Sorted'].includes(x.timingLabel)).slice(0,1)){
  const tt=c.tasks.find(y=>y.id===x.id);if(!tt)continue;
  out.push({id:'unlock:'+tt.id,family:'priority',type:'unlock_project',eyebrow:'Unlocks the next steps',title:`${tt.title}: ${x.action!.charAt(0).toLowerCase()+x.action!.slice(1)}`,body:`Once this bit is done, the rest can happen. It’s ${mins(x.minutes||5)}.`,actions:[{key:'open',label:'Take a look',primary:true},{key:'later',label:'Not now'}],href:`/bear/tasks/${tt.id}`,taskId:tt.id,minutes:x.minutes||5,entity:'task:'+tt.id,score:S({leverage:0.8,pressure:x.futurePressureRisk*0.5,effort:(x.minutes||5)/90})});
 }
 // prevent_future_pressure: a busy stretch is coming; doing one early spreads it.
 const ds=[...pr.results.values()].map(x=>x.deadline).filter((d):d is string=>!!d&&d>=today&&d<=addDays(today,14)).sort();
 for(let i=0;i+2<ds.length;i++)if((daysBetween(ds[i],ds[i+2])??99)<=2){out.push({id:'busy:'+ds[i],family:'priority',type:'prevent_future_pressure',eyebrow:'Future pressure',title:`Busy stretch around ${friendlyDate(ds[i],today)}`,body:'Three or more things fall due within a couple of days. Doing one early spreads the load.',actions:[{key:'open',label:'See what’s coming',primary:true},{key:'dismiss',label:'Not now'}],href:'/bear/me/everything',minutes:10,entity:'busy',score:S({pressure:0.7,loadRemoved:0.2,effort:0.1})});break;}
 return out;
}

// ---------- Family C: strategic attention ----------
export function strategicIdeas(c:Ctx,att:ProjectAttention[]):Idea[]{
 const out:Idea[]=[];const {today}=c;
 for(const a of att.filter(a=>a.strategic&&a.next)){
  // Plain words, only when asked. Never "neglected".
  const why=[{key:'future' as const,title:'This matters to where you’re heading',text:`${a.title} ${a.explicit==='very'?'really matters to you':'matters'}, but it hasn’t had much room lately.`},...(a.busyElsewhere?[{key:'meaning' as const,title:'Everyday things got their turn',text:'You’ve kept lots of everyday things running lately. This could use a turn too.'}]:[]),{key:'timing' as const,title:'No deadline needed',text:'Bear won’t invent one. Small tidy-ups don’t count as progress, so they don’t reset this.'}];
  const chips:string[]=[];const next=a.next!;
  // Present self and balance: future work doesn't automatically win over a full day or the rest of life.
  const ps=c.pr.present;const damp=(a.role==='progress'&&ps&&ps.recentLoad>=0.5?0.6:1)*(ps?.heavyArea&&ps.heavyArea===a.areaKey?0.7:1);const lift=ps?.heavyArea&&ps.heavyArea!==a.areaKey?0.15:0;
  const window=a.intent?.window;const setAt=a.intent?.on||a.intent?.setAt.slice(0,10)||today;
  const windowOpen=window==='today'?setAt<=today:window==='tomorrow'?addDays(setAt,1)<=today:window==='this_week'?addDays(setAt,2)<=today:false;
  // They said they'd make room: one gentle check when that time arrives. No calendar, no pretending.
  if(a.intent&&windowOpen&&a.lastProgressAt<setAt){out.push({id:`block:${a.projectId}:${setAt}`,family:'strategic',type:'make_room_check',eyebrow:'Worth protecting time for',title:'Got a decent block today?',body:`For ${a.title}: ${next.title.charAt(0).toLowerCase()+next.title.slice(1)}. ${a.capacity==='block'?'It wants a proper block.':`It’s ${mins(next.minutes)}.`}`,actions:[{key:'block_yes',label:'Yes',primary:true},{key:'block_no',label:'Not today'}],projectId:a.projectId,taskId:next.taskId,minutes:null,entity:'project:'+a.projectId,chips,why,score:S({strategic:0.6+a.importance*0.3,interruption:0.1})});continue;}
  if(a.intent&&!windowOpen)continue;
  if(a.deferredUntil&&a.deferredUntil>today)continue;
  if(a.momentum!=='stalled')continue;
  // Squeezed out again and again: ask once whether the plan should change, without judgement.
  if(a.deferrals>=3){out.push({id:'squeezed:'+a.projectId,family:'strategic',type:'reprioritise',eyebrow:'Worth a rethink',title:'This keeps getting squeezed out',body:`${a.title} has been set aside a few times. That’s fine. It might just need a different plan.`,actions:[{key:'protect',label:'Protect it more',primary:true},{key:'lower',label:'Lower its importance'},{key:'pause',label:'Pause it'}],projectId:a.projectId,minutes:null,entity:'project:'+a.projectId,chips,why,score:S({strategic:0.5+a.neglect*0.5,decisions:0.4})});continue;}
  out.push({id:'protect:'+a.projectId,family:'strategic',type:'protect_time',eyebrow:'Worth protecting time for',title:`${a.title} — ${next.title}`,body:a.capacity==='block'?'Best with a focus block.':`About ${next.minutes} minutes.`,actions:[{key:'make_room',label:'I’ll make room',primary:true},{key:'not_this_week',label:'Not this week'}],projectId:a.projectId,taskId:next.taskId,minutes:next.minutes,entity:'project:'+a.projectId,chips,why,score:S({strategic:(0.35+a.neglect*0.8)*damp+lift,effort:Math.min(0.4,next.minutes/150)})});
 }
 return out;
}

// ---------- the feed ----------
export interface IdeasFeed extends Orchestrated{capacity:Capacity|null}
export async function bearIdeas(store:BearStore,now=new Date()):Promise<IdeasFeed>{
 const profile=await ensureProfile(store);
 const [suggestions,pr,tasks,projects,completions]=await Promise.all([refreshSuggestions(store,now),prioritiseOpen(store,now),store.list('tasks'),store.list('projects'),store.list('completions',{limit:500})]);
 const today=pr.ctx.today;const c:Ctx={tasks,projects,pr,today,profile};
 const capacity=profile.capacityToday?.date===today?profile.capacityToday.value:null;
 const candidates:Idea[]=[...suggestionIdeas(suggestions)];
 if(flags.mentalLoadOpportunityV1())candidates.push(...mentalLoadIdeas(c));
 if(flags.priorityEngineV1())candidates.push(...priorityFamilyIdeas(c));
 if(flags.strategicAttentionV1())candidates.push(...strategicIdeas(c,strategicAttention({projects,tasks,completions,results:pr.results,today})));
 const res=orchestrate(candidates,{today,history:profile.ideaHistory,capacity,dayMode:pr.ctx.dayMode,learned:pr.ctx.learned,saturated:!!pr.present?.saturated});
 return {...res,capacity};
}

// ---------- acting on an idea ----------
export const ideaActSchema=z.object({ideaId:z.string().min(1).max(200),type:z.string().max(40),action:z.enum(['accept','reject','open','later','dismiss','make_room','not_this_week','protect','lower','pause','block_yes','block_no','take_over','copy']),
 suggestionId:z.string().uuid().nullable().optional(),taskId:z.string().uuid().nullable().optional(),projectId:z.string().uuid().nullable().optional(),
 window:z.enum(['today','tomorrow','this_week','not_sure']).nullable().optional()}).strict();
export type IdeaAct=z.infer<typeof ideaActSchema>;
const cooldown:Partial<Record<IdeaActionKey,number>>={dismiss:30,later:1,open:3,copy:3,take_over:30,make_room:0,not_this_week:7,protect:2,lower:30,pause:60,block_yes:1,block_no:1};
export async function actOnIdea(store:BearStore,a:IdeaAct,now=new Date()):Promise<{message:string|null}>{
 if(a.action==='accept'||a.action==='reject'){if(!a.suggestionId)throw new Error('not_found');await respondToSuggestion(store,{suggestionId:a.suggestionId,response:a.action},now);return {message:null};}
 const profile=await ensureProfile(store);const pr=await prioritiseOpen(store,now);const today=pr.ctx.today;
 const project=a.projectId?await store.get('projects',a.projectId):null;if(a.projectId&&!project)throw new Error('not_found');
 let message:string|null=null;
 switch(a.action){
  case 'later':if(a.taskId)await notToday(store,a.taskId,null,now);message='No problem. Bear will bring it back another day.';break;
  case 'take_over':if(a.taskId)await store.update('tasks',a.taskId,{bearSupport:'more'});message='Done. Bear will bring it back in smaller steps.';break;
  case 'make_room':{const window=a.window||'not_sure';await store.update('projects',project!.id,{intent:{window,setAt:now.toISOString(),on:today}});message=window==='not_sure'?'That’s fine. Bear will check in later in the week.':'Good. Bear will check in then.';
   if(window==='not_sure')await store.update('projects',project!.id,{intent:{window:'this_week',setAt:now.toISOString(),on:today}});break;}
  // "Not this week" sets it aside without touching how much it matters.
  case 'not_this_week':await store.update('projects',project!.id,{deferredUntil:addDays(today,7),intent:null,strategicDeferrals:(project!.strategicDeferrals||0)+1});message='Okay. It keeps its importance; Bear will ask again next week.';break;
  case 'protect':await store.update('projects',project!.id,{importance:'very',strategicDeferrals:0,intent:{window:'this_week',setAt:now.toISOString(),on:today},deferredUntil:null});message='Protected. Bear will help you find room for it this week.';break;
  case 'lower':{const cur=project!.importance;const next:Importance=cur==='very'?'nice':'not';await store.update('projects',project!.id,{importance:next,strategicDeferrals:0});message='Lowered. Bear will ask about it less.';break;}
  case 'pause':await store.update('projects',project!.id,{paused:true,strategicDeferrals:0,intent:null});message='Paused. Nothing from it will come up until you unpause it.';break;
  case 'block_yes':{await store.update('profiles',profile.id,{capacityToday:{value:'block',date:today}});if(project)await store.update('projects',project.id,{intent:null});
   // Only say "nothing urgent" when the engine agrees.
   const critical=[...pr.results.values()].filter(r=>r.surfaceNow&&(r.tier<=1||(r.deadline!=null&&r.deadline<=addDays(today,1))));
   const next=a.taskId?(await store.get('tasks',a.taskId))?.title:null;
   const nextLine=next?` Next: ${next.charAt(0).toLowerCase()+next.slice(1)}.`:'';
   if(!critical.length)message=`Great. The little stuff can wait. Nothing urgent needs you right now.${nextLine}`;
   else{const t=await store.get('tasks',critical[0].id);message=`Great. One thing first: ${t?.title||'one thing'} can’t wait.${next?` Then: ${next.charAt(0).toLowerCase()+next.slice(1)}.`:''}`;}
   break;}
  case 'block_no':{const w=project?.intent?.window;if(project)await store.update('projects',project.id,{intent:w==='today'?{window:'tomorrow',setAt:now.toISOString(),on:today}:w==='tomorrow'?{window:'this_week',setAt:now.toISOString(),on:today}:null,strategicDeferrals:w==='this_week'?(project.strategicDeferrals||0)+1:project.strategicDeferrals||0});message='No problem. Bear will check again another day.';break;}
  default:break;
 }
 // History (cooldowns) and learning: which KINDS of idea help. Never what matters.
 const days=cooldown[a.action]??1;const hist={...(profile.ideaHistory||{})};
 const status=['dismiss','lower','pause'].includes(a.action)?'dismissed':['later','not_this_week','block_no'].includes(a.action)?'deferred':'accepted';
 hist[a.ideaId]={status,at:now.toISOString(),until:days?addDays(today,days):today};
 // Keep the history small: drop entries whose cooldown ended more than 60 days ago.
 for(const [k,v] of Object.entries(hist))if(v.until&&v.until<addDays(today,-60))delete hist[k];
 const map=structuredClone(profile.loadMap||{domains:{}});map.learned??={};const ch=map.learned.choices??={};
 const key=status==='accepted'?`idea_yes:${a.type}`:status==='dismissed'?`idea_no:${a.type}`:null;if(key)ch[key]=(ch[key]||0)+1;
 await store.update('profiles',profile.id,{ideaHistory:hist,loadMap:map,ideasSeen:(profile.ideasSeen||[]).filter(id=>id!==a.ideaId)});
 await recordBehaviour(store,'idea_response',{type:a.type,action:a.action},now);
 return {message};
}
export const capacitySchema=z.object({value:z.enum(['5','15','30','block','none'])}).strict();
export async function setCapacity(store:BearStore,value:Capacity,now=new Date()){
 const profile=await ensureProfile(store);const pr=await prioritiseOpen(store,now);
 await store.update('profiles',profile.id,{capacityToday:{value,date:pr.ctx.today}});
}
export const ideaEnabled=flags.bearIdeasIntelligenceV2;
export type {Idea};

// The number on the Bear Ideas tab: ideas the person hasn't seen yet. Opening Bear Ideas clears it;
// a new idea (or one coming back after a rest) brings it back.
export async function ideasCount(store:BearStore,now=new Date()):Promise<number>{
 if(ideaEnabled()){const profile=await ensureProfile(store);const seen=new Set(profile.ideasSeen||[]);return (await bearIdeas(store,now)).ideas.filter(i=>!seen.has(i.id)).length;}
 const {priorityIdeas}=await import('./priority-ideas.ts');
 return (await refreshSuggestions(store,now)).length+(flags.priorityEngineV1()?(await priorityIdeas(store,now).catch(()=>[])).length:0);
}
export const seenSchema=z.object({ids:z.array(z.string().min(1).max(200)).max(20)}).strict();
export async function markIdeasSeen(store:BearStore,ids:string[]){
 const profile=await ensureProfile(store);const seen=[...new Set([...(profile.ideasSeen||[]),...ids])].slice(-200);
 if(seen.length!==(profile.ideasSeen||[]).length)await store.update('profiles',profile.id,{ideasSeen:seen});
}
