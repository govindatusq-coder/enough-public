// Previous Adaptive Responsibility Engine vs the Cognitive Relief Policy, on identical scenarios, with identical tasks,
// capabilities and conditions (two identical in-memory accounts per scenario, one per policy). Expectations are fixed per
// scenario type before running, from what a good outcome would be; every measure is an observable count or state, never the
// engine's own relief estimate. Synthetic engineering results, not measured benefits for real people.
//   node scripts/relief-compare.mjs [--seeds N]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload,openTasks} from '../lib/bear/board/service.ts';
import {recommend,detailView,skip} from '../lib/bear/rre/service.ts';
import {saveAnswers} from '../lib/bear/adaptive/service.ts';
import {attributesOf} from '../lib/bear/adaptive/attributes.ts';
import {zonedDateTime} from '../lib/bear/domain/dates.ts';

const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const SEEDS=Number(arg('--seeds'))||6;
const ROOT=join(import.meta.dirname,'..');const bank=JSON.parse(readFileSync(join(ROOT,'research','temporal-autonomy','synthetic-tasks.json'),'utf8')).tasks;
const PROFILES={planner:{control:'plan_own',howDone:'in_advance',helpers:'rarely'},juggler:{control:'fixed_routine',howDone:'routine',helpers:'sometimes_if_organised'},
 improviser:{control:'flexible_changing',howDone:'grab_moment',barriers:['interruptions']},oncall:{control:'depends_others',howDone:'when_urgent',barriers:['interruptions','exhausted'],helpers:'regularly'}};
const COUNTRIES={AU:'Australia/Sydney',CA:'America/Toronto',US:'America/New_York'};
// Scenario types and what a good outcome is (fixed here, independent of either policy).
const TYPES={
 routine:{},competing:{n:5},very_limited:{minutes:2},low_energy:{day:'wiped'},missing_info:{noDates:true},delegation_declined:{declined:true},
 user_declines:{declineFirst:true},recovery:{day:'chaos',expect:'only_consequential'},wrong_profile:{answers:'planner',minutes:5},previously_rejected:{rejected:true},
 high_consequence:{urgent:true,expect:'urgent_first'},repeatedly_deferred:{deferred:3,expect:'deferred_first'},no_intervention_optimal:{onlyAspirations:true,day:'wiped',expect:'none_or_small'},
 interruptions:{answers:'improviser',minutes:10},unpredictable_caregiving:{answers:'oncall',minutes:10},high_autonomy:{answers:'planner',minutes:30},
};
function rng(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%100000)/100000;};}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
function scenario(type,profileKey,country,seed){
 const T=TYPES[type];const r=rng(`${type}|${profileKey}|${country}|${seed}`);const n=T.n||3;
 const pool=T.onlyAspirations?bank.filter(t=>t.domain==='personal_goals'):bank.filter(t=>t.domain!=='personal_goals');
 const chosen=[];while(chosen.length<n){const t=pick(r,pool);if(!chosen.includes(t))chosen.push(t);}
 const lines=chosen.map((t,i)=>T.noDates||T.onlyAspirations?t.activity:i===0&&T.urgent?`${t.activity} by tomorrow`:`${t.activity} by ${DAYS[(2+Math.floor(r()*5))%7]}`);
 const minutes=T.minutes||pick(r,[5,10,20,30]);const evening=r()<.5;
 return {type,T,profileKey:T.answers||profileKey,realProfile:profileKey,country,tz:COUNTRIES[country],lines,chosen,minutes,evening,unsure:r()<.15};
}
async function build(sc){
 const s=new MemoryBackend().for('9e000000-0000-4000-8000-000000000001');await ensureProfile(s);
 await saveProfile(s,{name:'Synthetic',onboardingComplete:true,lifeRhythm:{timezone:sc.tz,blocks:[]}});await saveAnswers(s,{answers:PROFILES[sc.profileKey]},new Date('2026-11-23T08:00:00Z'));
 const received=new Date(zonedDateTime('2026-11-23',19*60,sc.tz));await unload(s,null,{text:sc.lines.join('\n'),via:'text'},received);
 // The target is the task made from the first line she wrote (matched on her own words, not a guess from the title).
 const tasks=await openTasks(s);const target=tasks.find(t=>(t.sorted?.originalInput||'').trim()===sc.lines[0].trim())||null;
 const at=new Date(zonedDateTime('2026-11-24',sc.evening?20*60+30:12*60+30,sc.tz));
 for(const t of tasks)await detailView(s,t.id,received);
 if(sc.T.declined&&target)await s.update('tasks',target.id,{delegation:{id:'x',to:'Helper',status:'DECLINED',at:received.toISOString()}});
 if(sc.T.rejected&&target)await skip(s,target.id,new Date(at.getTime()-3600000));
 if(sc.T.deferred&&target){const t=await s.get('tasks',target.id);await s.update('tasks',target.id,{rre:{...t.rre,dismissed:Array.from({length:sc.T.deferred},(_,i)=>new Date(at.getTime()-(i+2)*86400000).toISOString())}});}
 if(sc.T.day){const p=await ensureProfile(s);await s.update('profiles',p.id,{dayMode:sc.T.day==='wiped'?'wiped':'chaos',dayModeSetAt:at.toISOString()});}
 return {s,target,at};
}
const needsHer=a=>['ready_for_her','prepared_for_approval','understood_not_ready'].includes(a.awareness);
async function run(sc,policy){
 const {s,target,at}=await build(sc);const env=policy==='relief'?{}:{BEAR_RELIEF_POLICY:'off'};
 let exclude=[];
 if(sc.T.declineFirst){const first=await recommend(s,{minutes:sc.minutes,exclude:[]},at,env);if(first.recommendation){exclude=[first.recommendation.taskId];await skip(s,first.recommendation.taskId,at);}}
 const res=await recommend(s,{minutes:sc.minutes,exclude,...(sc.unsure?{unsure:true}:{})},at,env);const rec=res.recommendation;
 const tr=(await ensureProfile(s)).rreTrace?.[0];const tc=target&&tr?tr.considered.find(c=>c.taskId===target.id):null;const targetFeasible=!!tc&&!tc.excluded;const targetWhy=tc?.excluded||null;
 const open=await openTasks(s);let attention=0,decisions=0,herSteps=0,prepared=false,fits=null,bh=null,urgentFirst=null,deferredFirst=null,onlyConsequential=null,declinedRespected=null;
 for(const t of open){const d=await detailView(s,t.id,at);const f=await s.get('tasks',t.id);const a=attributesOf(f,f.rre,{status:d.status});if(needsHer(a))attention++;}
 if(rec){const d=await detailView(s,rec.taskId,at);const f=await s.get('tasks',rec.taskId);const a=attributesOf(f,f.rre,{status:d.status});
  herSteps=d.steps.filter(x=>x.who==='you'&&x.state!=='done'&&x.kind!=='wait').length;decisions=d.steps.filter(x=>x.who==='you'&&x.kind==='decide'&&x.state!=='done').length+(rec.share?1:0);
  prepared=!!d.prepared&&d.executionState!=='not_started';fits=(rec.minutes??a.humanMinutes)<=(sc.unsure?5:sc.minutes);bh=!a.requiresBusinessHours||!sc.evening;
  if(sc.T.urgent&&target)urgentFirst=rec.taskId===target.id;if(sc.T.deferred&&target)deferredFirst=rec.taskId===target.id;
  if(sc.T.expect==='only_consequential'){const day=Math.round((Date.parse(a.dueAt||'2100-01-01')-Date.parse('2026-11-24'))/86400000);onlyConsequential=day<=1;}
  if(sc.T.declineFirst)declinedRespected=!exclude.includes(rec.taskId);}
 else if(sc.T.expect==='only_consequential')onlyConsequential=true;
 const noneOrSmall=sc.T.expect==='none_or_small'?(!rec||(rec.minutes??99)<=5):null;
 const falseCompletion=(await s.list('tasks')).some(t=>t.status==='done');
 return {targetFound:!!target,targetFeasible,targetWhy,type:sc.type,profile:sc.realProfile,answeredAs:sc.profileKey,country:sc.country,policy,suggested:!!rec,intervention:rec?.intervention||null,attention,herSteps,decisions,prepared,fits,bh,
  urgentFirst,deferredFirst,onlyConsequential,noneOrSmall,declinedRespected,askFeedbackOnHardDay:sc.T.day?!!res.askFeedback:null,falseCompletion};
}
const rows=[];const started=Date.now();let n=0;
const ONLY=arg('--types')?arg('--types').split(','):null;
for(const type of Object.keys(TYPES).filter(t=>!ONLY||ONLY.includes(t)))for(const pk of Object.keys(PROFILES))for(const c of Object.keys(COUNTRIES))for(let seed=0;seed<SEEDS;seed++){
 const sc=scenario(type,pk,c,seed);for(const policy of ['adaptive','relief'])rows.push(await run(sc,policy));n++;
 if(n%200===0)console.error(`${n} scenarios (${Math.round((Date.now()-started)/1000)}s)`);
}
const pct=(rs,f)=>{const v=rs.map(f).filter(x=>x!==null&&x!==undefined);return v.length?Math.round(v.filter(Boolean).length/v.length*1000)/10:null;};
const avg=(rs,f)=>rs.length?Math.round(rs.reduce((a,r)=>a+f(r),0)/rs.length*100)/100:null;
const metrics=rs=>({n:rs.length,suggested:pct(rs,r=>r.suggested),avg_needing_her_attention:avg(rs,r=>r.attention),avg_her_steps_on_suggestion:avg(rs.filter(r=>r.suggested),r=>r.herSteps),
 avg_decisions_on_suggestion:avg(rs.filter(r=>r.suggested),r=>r.decisions),prepared_before_shown:pct(rs.filter(r=>r.suggested),r=>r.prepared),fits_window:pct(rs,r=>r.fits),business_hours_respected:pct(rs,r=>r.bh),
 urgent_first:pct(rs,r=>r.urgentFirst),deferred_first:pct(rs,r=>r.deferredFirst),only_consequential_on_chaos_day:pct(rs,r=>r.onlyConsequential),none_or_small_when_optimal:pct(rs,r=>r.noneOrSmall),
 declined_respected:pct(rs,r=>r.declinedRespected),optional_question_on_hard_day:pct(rs,r=>r.askFeedbackOnHardDay),false_completion:rs.filter(r=>r.falseCompletion).length,
 target_found:pct(rs,r=>r.targetFound),
 urgent_first_when_doable:pct(rs.filter(r=>r.targetFeasible),r=>r.urgentFirst),deferred_first_when_doable:pct(rs.filter(r=>r.targetFeasible),r=>r.deferredFirst),
 interventions:Object.fromEntries(Object.entries(rs.reduce((m,r)=>{const k=r.intervention||(r.suggested?'(previous engine)':'none');m[k]=(m[k]||0)+1;return m;},{})))});
const by=(k)=>{const g={};for(const r of rows)((g[r[k]]??={})[r.policy]??=[]).push(r);return Object.fromEntries(Object.entries(g).map(([x,v])=>[x,{adaptive:metrics(v.adaptive||[]),relief:metrics(v.relief||[])}]));};
const summary={name:'previous adaptive engine vs Cognitive Relief Policy',synthetic:true,scenarios:n,evaluations:rows.length,seconds:Math.round((Date.now()-started)/1000),
 note:'Identical scenarios, tasks and capabilities for both policies. Expectations fixed per scenario type in advance; measures are observable states and counts, not either policy’s own estimates. Synthetic engineering results only.',
 overall:{adaptive:metrics(rows.filter(r=>r.policy==='adaptive')),relief:metrics(rows.filter(r=>r.policy==='relief'))},byType:by('type'),byProfile:by('profile')};
const out=join(ROOT,'research','temporal-autonomy','runs',`${new Date().toISOString().replace(/[:.]/g,'-')}-relief-compare`);mkdirSync(out,{recursive:true});
writeFileSync(join(out,'evaluations.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,1)+'\n');
console.log(JSON.stringify({out,scenarios:n,seconds:summary.seconds,overall:summary.overall},null,1));
