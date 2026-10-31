// Bear Ideas V2: the orchestrator, the Strategic Attention Engine and the Mental Load Opportunity
// Engine working together. Bear Ideas stays a small set of ideas that take thinking off the person,
// never a priority list, and My Bear stays calm.
import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {ensureProfile,saveProfile,setDayMode} from '../lib/bear/services/profile.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {confirmBill} from '../lib/bear/services/task-inference.ts';
import {homeView} from '../lib/bear/services/home.ts';
import {notToday,prioritiseOpen} from '../lib/bear/services/priority.ts';
import {bearIdeas,actOnIdea,setCapacity} from '../lib/bear/services/ideas.ts';
import {orchestrate,learnedMultiplier} from '../lib/bear/strategy/ideas.ts';
import {strategicAttention} from '../lib/bear/strategy/attention.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {stamp} from '../lib/bear/store/store.ts';

const USER='66666666-6666-4666-8666-666666666666';const NOW=new Date('2026-10-27T09:00:00+11:00');
const day=n=>new Date(NOW.getTime()+n*86400000);
async function onboard(store){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['work','family','home','money'],onboardingComplete:true});}
async function give(store,text,now=NOW){const {extraction}=await createCapture(store,null,{method:'text',text,referenceYear:2026});return (await maybeAutoSetup(store,extraction,now)).task;}
// A project the person cares about, with real to-dos and no deadline.
async function project(store,{title='Grant application',importance='very',role='progress',age=21,tasks=['Draft the significance section','Fix the references formatting']}={}){
 const p=await store.insert('projects',stamp(USER,{areaKey:'work',title,status:'active',dueAt:null,resourceDocumentIds:[],billId:null,importance,role,createdAt:day(-age).toISOString()}));
 const ts=[];for(const [i,t] of tasks.entries()){const x=await give(store,t);ts.push(await store.update('tasks',x.id,{projectId:p.id,order:i}));}
 return {p,ts};
}
async function complete(store,taskId,at){await store.update('tasks',taskId,{status:'done'});await store.insert('completions',stamp(USER,{taskId,billId:null,completedAt:at.toISOString(),daysBeforeDue:null,method:null}));}
const ideas=async(store,now=NOW)=>(await bearIdeas(store,now)).ideas;
const NO_PANIC=/\b(overdue|late|behind|falling behind|failed|should have)\b/i;

test('an important project with no due date still gets attention once it stalls, without invented deadlines',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {p}=await project(store);
 const i=(await ideas(store)).find(x=>x.type==='protect_time');
 assert.ok(i,'protect-time idea');assert.equal(i.projectId,p.id);assert.match(i.title,/Grant application/);
 assert.match(i.title,/significance section/,'the next real step, not the tidy-up');assert.equal(i.eyebrow,'Worth protecting time for');
 for(const x of await ideas(store))assert.doesNotMatch(`${x.title} ${x.body} ${(x.why||[]).map(w=>w.title+' '+w.text).join(' ')}`,NO_PANIC);
 assert.equal((await store.get('projects',p.id)).dueAt,null,'no deadline manufactured');
});

test('a project moving well is left alone (no neglect idea)',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {p,ts}=await project(store,{tasks:['Draft the significance section','Draft the budget justification','Fix the references formatting']});
 await complete(store,ts[0].id,day(-2));
 assert.equal((await ideas(store)).filter(x=>x.projectId===p.id).length,0);
});

test('activity is not progress: tidy-ups alone don’t reset the progress clock',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {p,ts}=await project(store,{tasks:['Draft the significance section','Fix the references formatting']});
 await complete(store,ts[1].id,day(-1));
 const a=strategicAttention({projects:await store.list('projects'),tasks:await store.list('tasks'),completions:await store.list('completions'),results:(await prioritiseOpen(store,NOW)).results,today:'2026-10-27'}).find(x=>x.projectId===p.id);
 assert.equal(a.momentum,'stalled');assert.ok(a.neglect>0);
});

test('stalled → protect time: “I’ll make room” stores a rough window, then one check-in when it arrives',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {p}=await project(store);
 const i=(await ideas(store)).find(x=>x.type==='protect_time');
 const r=await actOnIdea(store,{ideaId:i.id,type:i.type,action:'make_room',projectId:p.id,window:'tomorrow'},NOW);assert.ok(r.message);
 assert.equal((await store.get('projects',p.id)).intent.window,'tomorrow');
 assert.equal((await ideas(store)).filter(x=>x.projectId===p.id).length,0,'quiet until then');
 const check=(await ideas(store,day(1))).find(x=>x.type==='make_room_check');assert.ok(check);assert.equal(check.title,'Got a decent block today?');
 const yes=await actOnIdea(store,{ideaId:check.id,type:check.type,action:'block_yes',projectId:p.id,taskId:check.taskId},day(1));
 assert.match(yes.message,/^Great\. The little stuff can wait\. Nothing urgent needs you right now\. Next: draft the significance section\.$/);
});

test('“got a block?” never says nothing is urgent when something is',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {p,ts}=await project(store);
 await give(store,'Return the excursion permission note by 28 October.');
 const r=await actOnIdea(store,{ideaId:'block:x',type:'make_room_check',action:'block_yes',projectId:p.id,taskId:ts[0].id},NOW);
 assert.doesNotMatch(r.message,/Nothing urgent/);assert.match(r.message,/One thing first/);
});

test('“Not this week” keeps importance; squeezed out three times → one rethink idea',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {p}=await project(store);
 let now=NOW;
 for(let k=0;k<3;k++){const i=(await ideas(store,now)).find(x=>x.projectId===p.id);assert.equal(i?.type,'protect_time',`round ${k}`);await actOnIdea(store,{ideaId:i.id,type:i.type,action:'not_this_week',projectId:p.id},now);now=new Date(now.getTime()+8*86400000);}
 assert.equal((await store.get('projects',p.id)).importance,'very','importance untouched');
 const r=(await ideas(store,now)).find(x=>x.projectId===p.id);assert.equal(r.type,'reprioritise');assert.equal(r.title,'This keeps getting squeezed out');
 assert.deepEqual(r.actions.map(a=>a.label),['Protect it more','Lower its importance','Pause it']);
 await actOnIdea(store,{ideaId:r.id,type:r.type,action:'pause',projectId:p.id},now);
 assert.equal((await ideas(store,now)).filter(x=>x.projectId===p.id).length,0,'paused projects stay quiet');
});

test('high aversion → more Bear support, not more reminders (and honest about it)',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const t=await give(store,'Car registration expires 30 November 2026. Renew online.');
 for(let k=0;k<3;k++)await notToday(store,t.id,null,day(k));
 const i=(await ideas(store,day(3))).find(x=>x.type==='take_over');
 assert.ok(i,'take-over idea');assert.match(i.body,/smaller/);assert.doesNotMatch(i.body,/Bear will (call|compare|pay)/i);
 await actOnIdea(store,{ideaId:i.id,type:i.type,action:'take_over',taskId:i.taskId},day(3));
 assert.equal((await store.get('tasks',i.taskId)).bearSupport,'more');
});

test('future pressure: something with a long lead time gets a head start',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 await give(store,'Passport renewal for Leo, expires 15 December 2026.');
 const all=await ideas(store);assert.ok(all.some(x=>/passport/i.test(x.title)&&['worth_doing_now','prepare'].includes(x.type)));
});

test('unlock: a small step other steps wait on',async()=>{
 const a=orchestrate([cand('unlock','priority','unlock_project',{leverage:0.9,effort:0.05}),cand('x','priority','prevent_future_pressure',{pressure:0.2})],opts());
 assert.equal(a.ideas[0].type,'unlock_project');
});

test('nothing useful → nothing',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 assert.deepEqual(await ideas(store),[]);
 await give(store,'Waiting for an email reply from the school about the uniform.');
 assert.deepEqual(await ideas(store),[]);
});

test('existing mental-load ideas stay, alongside strategic ones, and keep their own actions',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await project(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 20 November 2026.',referenceYear:2026});
 await confirmBill(store,{extractionId:extraction.id,corrections:{biller:'AGL',category:'electricity',amountDueCents:18460,dueDate:'2026-11-20',isRecurring:true,expectedRecurrence:'quarterly'},confirmedFields:['biller','category','amountDueCents','dueDate','isRecurring','expectedRecurrence'],allowDuplicate:true,forPerson:null},NOW);
 const all=await ideas(store);
 const rec=all.find(x=>x.type==='recurring_pattern');assert.ok(rec,'recurring bill idea still there');assert.deepEqual(rec.actions.map(a=>a.key),['accept','reject']);
 assert.ok(all.some(x=>x.type==='protect_time'));
 await actOnIdea(store,{ideaId:rec.id,type:rec.type,action:'accept',suggestionId:rec.suggestionId},NOW);
 assert.equal((await store.list('recurring_expectations')).length,1);
});

test('My Bear stays calm: no recommendation card; the flag brings the old card back for comparison',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await give(store,'Return the excursion permission note by 28 October.');
 const home=await homeView(store,NOW);assert.equal(home.oneThing,null);assert.ok(home.ideasCount>=1&&home.ideasCount<=5);
 process.env.BEAR_IDEAS_V2='off';try{assert.ok((await homeView(store,NOW)).oneThing);}finally{delete process.env.BEAR_IDEAS_V2;}
});

test('Chaos day: Bear Ideas goes quiet except for what can’t wait',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await project(store);
 await setDayMode(store,'chaos',NOW);
 for(const i of await ideas(store))assert.ok(i.critical);
});

test('capacity: “15 minutes” keeps out ideas that need a proper block; “nothing right now” leaves only the critical',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);await project(store,{tasks:['Write the grant narrative draft']});
 assert.ok((await ideas(store)).some(x=>x.type==='protect_time'));
 await setCapacity(store,'15',NOW);assert.ok(!(await ideas(store)).some(x=>x.type==='protect_time'));
 await setCapacity(store,'none',NOW);for(const i of await ideas(store))assert.ok(i.critical);
});

test('reactive-work bias: lots of upkeep done doesn’t make upkeep important or bury the project',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {p}=await project(store);
 for(let k=0;k<6;k++){const t=await give(store,`Order school shoes size ${k}`);await complete(store,t.id,day(-1));}
 const i=(await ideas(store)).find(x=>x.projectId===p.id);assert.equal(i?.type,'protect_time');
 const why=i.why.map(w=>w.title+' '+w.text).join(' ');assert.match(why,/kept lots of everyday things running/);assert.doesNotMatch(why+i.body,/procrastinat|distract|busywork|neglect/i);
 // Dismissing strategic ideas many times can quieten them but never silence them, and never changes importance.
 assert.ok(learnedMultiplier('protect_time','strategic',{'idea_no:protect_time':20})>=0.75);
 assert.equal((await store.get('projects',p.id)).importance,'very');
});

test('dismissed ideas rest for a while, then may come back',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 for(let k=0;k<5;k++)await give(store,`Buy thing ${k}`);
 const i=(await ideas(store)).find(x=>x.id==='matters');assert.ok(i);
 await actOnIdea(store,{ideaId:i.id,type:i.type,action:'dismiss'},NOW);
 assert.ok(!(await ideas(store)).some(x=>x.id==='matters'));
 assert.ok((await ideas(store,day(31))).some(x=>x.id==='matters'));
});

// ---------- idea competition and the attention budget (pure) ----------
function cand(id,family,type,score={},extra={}){return {id,family,type,eyebrow:'',title:id,body:'',actions:[],minutes:extra.minutes??null,entity:extra.entity||id,critical:extra.critical,score:{loadRemoved:0,pressure:0,strategic:0,decisions:0,money:0,leverage:0,effort:0,uncertainty:0,interruption:0.1,...score}};}
const opts=(o={})=>({today:'2026-10-27',history:{},capacity:null,dayMode:null,learned:{},...o});

test('attention budget: 20 eligible ideas → at most five, varied, load-reduction keeps a seat',()=>{
 const c=[];
 for(let k=0;k<8;k++)c.push(cand('s'+k,'strategic','protect_time',{strategic:0.9+k/100},{minutes:60}));
 for(let k=0;k<6;k++)c.push(cand('p'+k,'priority','worth_doing_now',{pressure:0.9},{minutes:5}));
 for(let k=0;k<4;k++)c.push(cand('u'+k,'priority','unlock_project',{leverage:0.9},{minutes:5}));
 c.push(cand('l1','load','recurring_pattern',{loadRemoved:0.5}));c.push(cand('l2','load','save_money',{loadRemoved:0.4,money:0.3}));
 assert.equal(c.length,20);
 const r=orchestrate(c,opts());
 assert.ok(r.ideas.length<=5);assert.equal(r.considered,20);
 const per=t=>r.ideas.filter(i=>i.type===t).length;
 for(const t of new Set(r.ideas.map(i=>i.type)))assert.ok(per(t)<=2,t);
 assert.ok(r.ideas.filter(i=>i.family==='strategic').length<=2,'strategic ideas don’t crowd out the rest');
 assert.ok(r.ideas.some(i=>i.family==='load'),'mental-load ideas keep a seat');
});
test('competition: duplicates about the same thing collapse to the most useful one',()=>{
 const r=orchestrate([cand('a','load','prepare',{loadRemoved:0.3},{entity:'task:1'}),cand('b','priority','worth_doing_now',{pressure:0.9},{entity:'task:1'})],opts());
 assert.deepEqual(r.ideas.map(i=>i.id),['b']);
});
test('competition: low-value ideas are dropped; a full day shows fewer',()=>{
 assert.equal(orchestrate([cand('weak','load','remember',{loadRemoved:0.1})],opts()).ideas.length,0);
 const many=Array.from({length:6},(_,k)=>cand('l'+k,'load',['remember','monitor','prepare','follow_up','simplify','save_money'][k],{loadRemoved:0.8}));
 assert.equal(orchestrate(many,opts({dayMode:'full'})).ideas.length,3);
 assert.equal(orchestrate(many,opts({dayMode:'wiped'})).ideas.length,2);
});
test('capacity question only when the answer would change what shows',()=>{
 assert.equal(orchestrate([cand('a','priority','worth_doing_now',{pressure:0.9},{minutes:5})],opts()).askCapacity,false);
 assert.equal(orchestrate([cand('a','priority','worth_doing_now',{pressure:0.9},{minutes:5}),cand('b','strategic','protect_time',{strategic:0.9},{minutes:90})],opts()).askCapacity,true);
});

test('My Wins: important projects progressed and upkeep handled, counted honestly',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {ts}=await project(store,{tasks:['Draft the significance section','Draft the budget justification']});
 await complete(store,ts[0].id,day(-1));
 const w=await winsView(store,NOW);
 assert.equal(w.strategic.progressed,1);assert.match(w.strategic.line||'',/Grant application/);
});

test('tab badge: counts only ideas not yet seen; seeing clears it; a new idea brings it back',async()=>{
 const {ideasCount,markIdeasSeen}=await import('../lib/bear/services/ideas.ts');
 const store=new MemoryBackend().for(USER);await onboard(store);await project(store);
 const first=await ideas(store);assert.ok(first.length>=1);assert.equal(await ideasCount(store,NOW),first.length);
 await markIdeasSeen(store,first.map(i=>i.id));assert.equal(await ideasCount(store,NOW),0,'seen → no badge');
 await give(store,'Return the excursion permission note by 28 October.');
 assert.equal(await ideasCount(store,NOW),(await ideas(store)).filter(i=>!first.some(f=>f.id===i.id)).length,'only the new one counts');
 assert.ok(await ideasCount(store,NOW)>=1);
});
