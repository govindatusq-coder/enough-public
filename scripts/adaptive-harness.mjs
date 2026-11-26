// Temporal-autonomy synthetic harness: 500 synthetic responsibilities × 4 temporal profiles × 3 countries = 6,000 paired
// configurations, each evaluated under 5 conditions (A conventional, B generic, C personalised lists, D adaptive strategy,
// E full) = 30,000 evaluations, through Load Bear's real code (in-memory store, no AI, no network).
// Engineering tests only: synthetic tasks, hand-assigned labels, and no measure of how real people feel or fare.
// Each measure is reported separately; there is no combined score, so nothing is weighted towards personalisation.
//   node scripts/adaptive-harness.mjs [--limit N] [--label text]
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {unload,openTasks} from '../lib/bear/board/service.ts';
import {recommend,brainView,detailView,giveToBear} from '../lib/bear/rre/service.ts';
import {saveAnswers,chooseListStyle} from '../lib/bear/adaptive/service.ts';
import {recommendStyle} from '../lib/bear/adaptive/lists.ts';
import {scoreProfile} from '../lib/bear/adaptive/profile.ts';
import {attributesOf} from '../lib/bear/adaptive/attributes.ts';
import {statusOf} from '../lib/bear/rre/plan.ts';
import {zonedDateTime} from '../lib/bear/domain/dates.ts';

const arg=k=>{const i=process.argv.indexOf(k);return i>0?process.argv[i+1]:null;};
const ROOT=join(import.meta.dirname,'..');
const bank=JSON.parse(readFileSync(join(ROOT,'research','temporal-autonomy','synthetic-tasks.json'),'utf8'));
const TASKS=bank.tasks.slice(0,Number(arg('--limit'))||undefined);
const PROFILES={
 planner:{control:'plan_own',howDone:'in_advance',helpers:'rarely',comms:'important_only'},
 juggler:{control:'fixed_routine',howDone:'routine',helpers:'sometimes_if_organised',comms:'daily_checkin'},
 improviser:{control:'flexible_changing',howDone:'grab_moment',barriers:['interruptions'],helpers:'depends',comms:'as_i_go'},
 oncall:{control:'depends_others',howDone:'when_urgent',barriers:['interruptions','exhausted'],helpers:'regularly',assist:['prepare','take_off_plate'],comms:'only_when_open'},
};
const COUNTRIES={AU:'Australia/Sydney',CA:'America/Toronto',US:'America/New_York'};
const CONDITIONS=['A','B','C','D','E'];
const DAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const ADVERSE=['missing_info','wrong_estimate','delegation_declined','third_party_unavailable','user_declines','very_low_time','conflicting_deadlines'];
function rng(seed){let h=2166136261;for(const c of String(seed)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%100000)/100000;};}
const pick=(r,a)=>a[Math.floor(r()*a.length)];
const localise=(t,c)=>c==='AU'?t:t.replace(/\borganis/g,'organiz').replace(/\bOrganis/g,'Organiz').replace(/\bMum\b/g,'Mom').replace(/\bmum/g,'mom').replace(/\bnappies\b/g,'diapers').replace(/\bOpal card\b/g,'transit card').replace(/\brego\b/g,'registration');
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
const words=s=>new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(w=>w.length>2));
const overlap=(a,b)=>{const A=words(a),B=words(b);if(!A.size)return 0;let n=0;for(const w of A)if(B.has(w))n++;return n/A.size;};

// What a sensible list would be for each list set, from the hand labels (a harness assumption, written independently of the engine).
function expectedLists(L,domain,style){
 const out=new Set();
 if(style==='classic'){if(domain==='personal_goals')out.add('aspire');if(L.business_hours)out.add('calls');if(L.focus||L.purchase_lead)out.add('night');if(['social','family_coordination'].includes(domain))out.add('week');if(L.delegatable&&L.long)out.add('spare');if(!out.size)['spare','week','night'].forEach(x=>out.add(x));}
 if(style==='areas'){out.add(['work_admin','work_deliverables'].includes(domain)?'work':domain==='finances'?'money':domain==='wellbeing'?'wellbeing':domain==='personal_goals'?'goals':['school_admin','childcare','child_health','family_coordination','adult_caregiving','social','travel'].includes(domain)?'family':'home');}
 if(style==='routine'){if(L.business_hours)out.add('business');if(L.out)out.add('after');if(L.quick)out.add('before');if(L.focus||L.purchase_lead)out.add('night');if(['social','family_coordination'].includes(domain))out.add('week');if(!out.size)['night','week'].forEach(x=>out.add(x));}
 if(style==='windows'){if(L.business_hours)out.add('open');if(L.out)out.add('out');if(L.focus)out.add('quiet');if(L.long)out.add('longer');if(L.quick)out.add('quick');if(!out.size)['quick','longer'].forEach(x=>out.add(x));}
 if(style==='support'){if(L.personal)out.add('just_me');if(L.business_hours)out.add('arrange');if(L.delegatable)out.add('someone');if(L.purchase_lead||L.focus)out.add('bear_prep');if(!out.size)out.add('capacity');}
 return out;
}
const DATED=/\b(today|tonight|tomorrow|monday|tuesday|tuesdays|wednesday|thursday|friday|saturday|sunday|weekend|january|february|march|april|may|june|july|august|september|october|november|december|next year|this year|term one|christmas|easter)\b/i;
const isBusiness=(local)=>{const [d,h]=[local.getUTCDay(),local.getUTCHours()];return d>=1&&d<=5&&h>=9&&h<17||d===6&&h>=9&&h<12;};

let uid=0;
async function makeUser(backend,tz,answers){const s=backend.for(`7a000000-0000-4000-8000-${String(++uid).padStart(12,'0')}`);await ensureProfile(s);
 await saveProfile(s,{name:'Synthetic',onboardingComplete:true,lifeRhythm:{timezone:tz,blocks:[]}});if(answers)await saveAnswers(s,{answers},new Date('2026-11-23T08:00:00Z'));return s;}

async function scenario(task,profileKey,country){
 const r=rng(`${task.id}|${profileKey}|${country}`);const tz=COUNTRIES[country];const L=task.labels;
 const adverse=r()<.25?pick(r,ADVERSE):null;
 const dueDay=2+Math.floor(r()*5);const dueDate=`2026-11-${String(23+dueDay).padStart(2,'0')}`;const dayName=DAYS[dueDay%7];
 const withTime=r()<.4;const hh=pick(r,[9,10,15,17]);
 const act=localise(task.activity,country);
 const phr=adverse==='missing_info'?act:pick(r,[`${act} by ${dayName}`,`Need to ${lc(act)} before ${dayName}${withTime?` ${hh}:00`:''}`,`Can you handle ${lc(act)} by ${dayName}${withTime?` ${hh}:00`:''}? I am working most of the day.`]);
 const others=[];while(others.length<2){const o=pick(r,bank.tasks);if(o.domain!==task.domain&&!others.includes(o))others.push(o);}
 const otherDay=adverse==='conflicting_deadlines'?dayName:DAYS[(dueDay+1+Math.floor(r()*3))%7];
 const lines=[phr,...others.map(o=>`${localise(o.activity,country)} by ${otherDay}`)];
 const received=new Date(zonedDateTime('2026-11-23',19*60+30,tz));
 const moments=[{at:new Date(zonedDateTime('2026-11-24',12*60+30,tz)),local:new Date(Date.UTC(2026,10,24,12,30)),minutes:adverse==='very_low_time'?2:pick(r,[5,10,20,30]),unsure:false},
  {at:new Date(zonedDateTime('2026-11-24',20*60+30,tz)),local:new Date(Date.UTC(2026,10,24,20,30)),minutes:pick(r,[5,10,20,30]),unsure:r()<.25}];
 return {task,profileKey,country,tz,L,adverse,expectedDue:adverse==='missing_info'?null:dueDate,expectedTime:withTime&&adverse!=='missing_info'&&!phr.endsWith(act)?`${String(hh).padStart(2,'0')}:00`:null,text:lines.join('\n'),received,moments,answers:PROFILES[profileKey]};
}
async function setup(sc,style,backend){
 const s=await makeUser(backend,sc.tz,sc.answers);if(style!=='classic')await chooseListStyle(s,{style},sc.received);
 const d=await unload(s,null,{text:sc.text,via:'text'},sc.received);
 const all=await openTasks(s);const target=[...all].sort((a,b)=>overlap(sc.task.activity,b.title)-overlap(sc.task.activity,a.title))[0]||null;
 const capturedOk=!!target&&overlap(sc.task.activity,target.title)>=.5;
 if(target&&sc.adverse==='wrong_estimate')await s.update('tasks',target.id,{estimatedMinutes:45,minutesBy:'you'});
 if(target&&sc.adverse==='third_party_unavailable')await s.update('tasks',target.id,{readiness:'waiting'});
 if(target&&sc.adverse==='delegation_declined')await s.update('tasks',target.id,{delegation:{id:'syn',to:'Helper',status:'DECLINED',at:sc.received.toISOString()}});
 return {s,target,capturedOk,added:d.added.length};
}
async function attrsOf(s,t,at){if(!t)return null;const dv=await detailView(s,t.id,at);const fresh=await s.get('tasks',t.id);return {a:attributesOf(fresh,fresh.rre,{status:dv.status}),dv};}
// A: conventional task management. Earliest due date first; no preparation, no feasibility checks, no categorising.
async function conventional(s,m){const open=(await openTasks(s)).filter(t=>t.status==='open');open.sort((a,b)=>(a.dueAt||'9999').localeCompare(b.dueAt||'9999')||a.title.localeCompare(b.title));
 const t=open[0];return t?{taskId:t.id,minutes:t.minutesBy==='you'?t.estimatedMinutes:null}:null;}

async function evaluate(sc){
 const rows=[];const styleP=recommendStyle(scoreProfile(sc.answers));
 // A fresh in-memory store for each configuration, so runs stay independent (and don't slow down as they go).
 const backend=new MemoryBackend();const classic=await setup(sc,'classic',backend);const personal=await setup(sc,styleP,backend);
 const base=await attrsOf(classic.s,classic.target,sc.received);
 const brainC=await brainView(classic.s,sc.received);const brainP=await brainView(personal.s,sc.received);
 const catOf=(b,t)=>{if(!t)return null;for(const c of b.categories)if(c.items.some(i=>i.id===t.id))return c.id;return null;};
 const shared={capture_ok:classic.capturedOk,one_task_per_line:classic.added===3,
  // A task whose own words carry a date ("…for tomorrow", "…on Sunday") clashes with the date the harness adds: not scored.
  deadline_ok:DATED.test(sc.task.activity)?null:sc.expectedDue?classic.target?.dueAt===sc.expectedDue:!classic.target?.dueAt,time_ok:sc.expectedTime?classic.target?.dueTime===sc.expectedTime:null,
  bh_recognised:base?base.a.requiresBusinessHours===sc.L.business_hours:false,delegation_recognised:base?base.a.delegationEligible===(sc.L.delegatable&&!sc.L.personal):false,
  prep_recognised:base?base.a.agentPreparationAvailable===(sc.L.purchase_lead||sc.L.focus):false};
 for(const cond of CONDITIONS){
  const u=cond==='C'||cond==='E'?personal:classic;const style=cond==='C'||cond==='E'?styleP:'classic';
  const cat=cond==='A'?null:catOf(cond==='C'||cond==='E'?brainP:brainC,u.target);
  const row={id:sc.task.id,domain:sc.task.domain,profile:sc.profileKey,country:sc.country,condition:cond,adverse:sc.adverse||'none',style,
   ...shared,category_ok:cond==='A'?null:!!cat&&expectedLists(sc.L,sc.task.domain,style).has(cat),moments:[]};
  for(const m of sc.moments){
   const p=await ensureProfile(u.s);await u.s.update('profiles',p.id,{rreLast:null});
   let rec=null,alt=null;
   if(cond==='A')rec=await conventional(u.s,m);
   else{const res=await recommend(u.s,{minutes:m.minutes,exclude:sc.adverse==='user_declines'&&u.target?[u.target.id]:[],...(m.unsure?{unsure:true}:{})},m.at,{BEAR_ENGINE_CONDITION:cond});rec=res.recommendation;alt=res.alternative;}
   let fits=null,bh=null,interr=null,shareOffered=null;
   if(rec){const t=await u.s.get('tasks',rec.taskId);const lab=bank.tasks.find(x=>overlap(x.activity,t.title)>=.5&&(x.id===sc.task.id||true))?.labels;
    const ra=await attrsOf(u.s,t,m.at);const mins=rec.minutes??ra?.a.humanMinutes??15;
    fits=mins<=(m.unsure?5:m.minutes);bh=!(ra?.a.requiresBusinessHours)||isBusiness(m.local);
    interr=!(['improviser','oncall'].includes(sc.profileKey)&&m.minutes<20&&ra&&ra.a.interruptibility==='low');
    shareOffered=cond==='D'||cond==='E'?!!rec.share:null;void lab;}
   row.moments.push({minutes:m.minutes,unsure:m.unsure,business:isBusiness(m.local),suggested:!!rec,fits,bh_respected:bh,interruption_fit:interr,
    declined_respected:sc.adverse==='user_declines'?!(rec&&u.target&&rec.taskId===u.target.id):null,alternative:alt?.kind||null,share_offered:shareOffered});
  }
  // Her remaining steps for the target once Bear has done its part (A: no preparation, so every step is hers).
  if(u.target){const before=await detailView(u.s,u.target.id,sc.received);
   if(cond==='A')row.human_steps=before.steps.length;else{let after=before;try{after=await giveToBear(u.s,null,u.target.id,sc.received);}catch{/* not open */}row.human_steps=after.steps.filter(x=>x.who==='you'&&x.state!=='done').length;}
   const t2=await u.s.get('tasks',u.target.id);row.false_completion=t2.status==='done';}
  rows.push(row);
 }
 return rows;
}

const mean=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length*1000)/10:null;// percent
const rate=(rows,f)=>{const v=rows.map(f).filter(x=>x!==null&&x!==undefined);return v.length?mean(v.map(Number)):null;};
function summarise(rows){
 const flat=rows.flatMap(r=>r.moments.map(m=>({...r,...m})));
 const by=(key)=>{const g={};for(const r of rows)(g[r[key]]??=[]).push(r);return g;};
 const metrics=rs=>{const ms=rs.flatMap(r=>r.moments);return {n:rs.length,capture_ok:rate(rs,r=>r.capture_ok),deadline_ok:rate(rs,r=>r.deadline_ok),time_ok:rate(rs,r=>r.time_ok),category_ok:rate(rs,r=>r.category_ok),
  bh_recognised:rate(rs,r=>r.bh_recognised),delegation_recognised:rate(rs,r=>r.delegation_recognised),prep_recognised:rate(rs,r=>r.prep_recognised),
  suggested:rate(ms,m=>m.suggested),fits_window:rate(ms,m=>m.fits),bh_respected:rate(ms,m=>m.bh_respected),interruption_fit:rate(ms,m=>m.interruption_fit),
  declined_respected:rate(ms,m=>m.declined_respected),share_offered:rate(ms,m=>m.share_offered),
  alternative_when_none:rate(ms.filter(m=>!m.suggested),m=>!!m.alternative),avg_human_steps:rs.filter(r=>r.human_steps!=null).length?Math.round(rs.reduce((a,r)=>a+(r.human_steps||0),0)/rs.length*100)/100:null,
  false_completion:rs.filter(r=>r.false_completion).length};};
 const cond=by('condition');const out={conditions:Object.fromEntries(CONDITIONS.map(c=>[c,metrics(cond[c]||[])]))};
 for(const key of ['profile','country','adverse','domain']){out[key]={};const g={};for(const r of rows)((g[r[key]]??={})[r.condition]??=[]).push(r);for(const [k,v] of Object.entries(g))out[key][k]=Object.fromEntries(Object.entries(v).map(([c,rs])=>[c,metrics(rs)]));}
 void flat;return out;
}

const started=Date.now();const rows=[];let i=0;const total=TASKS.length*4*3;
for(const task of TASKS)for(const pk of Object.keys(PROFILES))for(const c of Object.keys(COUNTRIES)){
 const sc=await scenario(task,pk,c);rows.push(...await evaluate(sc));i++;
 if(i%300===0)console.error(`${i}/${total} configurations (${Math.round((Date.now()-started)/1000)}s)`);
}
const summary={name:'temporal-autonomy synthetic harness',bank:bank.version,synthetic:true,configurations:i,evaluations:rows.length,seconds:Math.round((Date.now()-started)/1000),
 note:'Synthetic engineering tests. Labels are hand-assigned; the list expectations per style are a harness assumption. Not evidence about real people.',...summarise(rows)};
const out=join(ROOT,'research','temporal-autonomy','runs',new Date().toISOString().replace(/[:.]/g,'-')+(arg('--label')?`-${arg('--label').replace(/\W+/g,'-')}`:''));mkdirSync(out,{recursive:true});
writeFileSync(join(out,'evaluations.jsonl'),rows.map(r=>JSON.stringify(r)).join('\n')+'\n');writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,1)+'\n');
console.log(JSON.stringify({out,configurations:i,evaluations:rows.length,seconds:summary.seconds,conditions:summary.conditions},null,1));
