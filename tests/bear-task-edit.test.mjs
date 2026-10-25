import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryBackend} from '../lib/bear/store/memory.ts';
import {FakeProvider} from '../lib/bear/ai/fake.ts';
import {ensureProfile,saveProfile} from '../lib/bear/services/profile.ts';
import {rhythmPresets} from '../lib/bear/domain/labels.ts';
import {createCapture} from '../lib/bear/services/capture.ts';
import {maybeAutoSetup} from '../lib/bear/services/auto-setup.ts';
import {updateTask,setItemDone,estimateTaskCost,splitIntoPurchases,reopenTask} from '../lib/bear/services/task-edit.ts';
import {completeTask} from '../lib/bear/services/completion.ts';
import {winsView} from '../lib/bear/services/wins.ts';
import {everythingView} from '../lib/bear/services/everything.ts';
import {parseItemLines,totalCost,qtyFactor} from '../lib/bear/domain/items.ts';

const USER='22222222-2222-4222-8222-222222222222';const NOW=new Date('2026-11-10T09:00:00+11:00');
async function onboard(store,extra={}){await ensureProfile(store);return saveProfile(store,{name:'Sarah',areas:['family','home','money'],lifeRhythm:{timezone:'Australia/Sydney',blocks:rhythmPresets.map((b,i)=>({...b,id:'b'+i}))},onboardingComplete:true,...extra});}
const LIST='Bunnings: 2 bags potting mix, drill bits, 3 x fence palings, outdoor paint, due 5 December 2026';
async function listTask(store){const {extraction}=await createCapture(store,null,{method:'text',text:LIST,referenceYear:2026});const auto=await maybeAutoSetup(store,extraction,NOW);return {extraction,auto};}

test('item lines parse quantities and estimates multiply only counted quantities',()=>{
 const items=parseItemLines('2 bags potting mix\n3 x fence palings\neggs x 2\nmilk');
 assert.deepEqual(items.map(i=>[i.name,i.quantity]),[['potting mix','2 bags'],['fence palings','3 x'],['eggs','2'],['milk',null]]);
 assert.equal(qtyFactor('3 x'),3);assert.equal(qtyFactor('2 bags'),2);assert.equal(qtyFactor('1kg'),1);
 assert.equal(totalCost([{quantity:'2',estimatedCents:500},{quantity:null,estimatedCents:null}]),1000);assert.equal(totalCost([{quantity:null,estimatedCents:null}]),null);
});

test('a typed hardware list is set up automatically with items, area, a reminder and no verify step',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction,auto}=await listTask(store);
 assert.equal(extraction.general.kind,'shopping');assert.equal(extraction.general.items.length,4);
 assert.ok(auto,'auto set up');assert.equal(auto.task.title,'Bunnings run','short title, not the pasted line');assert.equal(auto.task.notes,null,'list is not repeated in notes');assert.equal(auto.task.setupBy,'bear');assert.equal(auto.area,'home');assert.equal(auto.task.items.length,4);assert.equal(auto.task.dueAt,'2026-12-05');assert.equal(auto.planned,true);
 assert.equal((await store.list('reminders')).length>0,true);
 assert.equal((await everythingView(store)).areas.find(a=>a.key==='home').projects.length,1);
});

test('auto set-up leaves bills, switched-off users and unnamed captures alone',async()=>{
 const store=new MemoryBackend().for(USER);const p=await onboard(store);
 const bill=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 28/11/2026. BPAY biller 12345',referenceYear:2026});
 assert.equal(await maybeAutoSetup(store,bill.extraction,NOW),null);
 await store.update('profiles',p.id,{pins:{...p.pins,preferences:{...p.pins.preferences,autoSetup:false}}});
 const note=await createCapture(store,null,{method:'text',text:'Return the permission form for Max by 12/11/2026',referenceYear:2026});
 assert.equal(await maybeAutoSetup(store,note.extraction,NOW),null);
});

test('prices are estimated by the AI service, never invented, and keep user prices',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await assert.rejects(estimateTaskCost(store,null,auto.task.id),e=>e.code==='ai_unavailable');
 const first=auto.task.items[0];await updateTask(store,auto.task.id,{items:auto.task.items.map(i=>i.id===first.id?{...i,estimatedCents:2000}:i)});
 const provider=new FakeProvider(input=>({prices:input.text.split('\n').map((n,i)=>({name:n,cents:(i+1)*1000}))}));
 const priced=await estimateTaskCost(store,provider,auto.task.id);
 assert.equal(priced.items.find(i=>i.id===first.id).estimatedCents,2000,'user price kept');assert.ok(priced.items.every(i=>i.estimatedCents!==null));
 assert.equal(provider.calls[0].text.split('\n').length,3,'only unpriced items were sent');assert.ok(priced.estimatedCents>0);
});

test('items can be ticked over several trips and the last tick completes the task with a win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);const [a,b,c,d]=auto.task.items;
 let r=await setItemDone(store,auto.task.id,{itemId:a.id},NOW);assert.equal(r.completed,false);
 r=await setItemDone(store,auto.task.id,{itemId:b.id},NOW);r=await setItemDone(store,auto.task.id,{itemId:b.id,done:false},NOW);assert.equal(r.task.items.find(i=>i.id===b.id).done,false);
 r=await setItemDone(store,auto.task.id,{itemId:b.id},NOW);r=await setItemDone(store,auto.task.id,{itemId:c.id},NOW);assert.equal(r.completed,false);
 r=await setItemDone(store,auto.task.id,{itemId:d.id},NOW);assert.equal(r.completed,true);assert.equal(r.win.title,auto.task.title);
 assert.equal((await winsView(store)).cards.length,1);
});

test('"got everything" completes a list in one go',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 const r=await setItemDone(store,auto.task.id,{all:true},NOW);assert.equal(r.completed,true);assert.ok(r.task.items.every(i=>i.done));
});

test('splitting a list makes separate tasks, each with its own project, items, date and reminder',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await updateTask(store,auto.task.id,{items:auto.task.items.map((i,k)=>({...i,estimatedCents:[9000,3000,2500,1500][k]}))});
 const split=await splitIntoPurchases(store,auto.task.id,2,NOW);
 assert.equal(split.tasks.length,2);assert.equal(split.areaKey,'home');assert.equal(split.original.status,'archived');
 assert.equal(split.tasks.reduce((s,t)=>s+t.items.length,0),4);
 assert.deepEqual(split.tasks.map(t=>t.part.index+'/'+t.part.total),['1/2','2/2']);assert.ok(split.tasks.every(t=>t.part.of===auto.task.id));
 const costs=split.tasks.map(t=>t.estimatedCents).sort((x,y)=>x-y);assert.deepEqual(costs,[12000,18000],'2 bags of mix (18000) alone vs the other three (12000): balanced by cost, not count');
 assert.ok(split.tasks.every(t=>t.dueAt<='2026-12-05'&&t.dueAt>'2026-11-10'));
 assert.equal((await store.list('task_dependencies')).length,0,'separate tasks, not steps');
 const projects=await store.list('projects');assert.equal(projects.filter(p=>p.status==='active').length,2);assert.equal(projects.find(p=>p.id===auto.task.projectId).status,'archived');
 const live=(await store.list('reminders')).filter(r=>r.status==='scheduled'&&r.kind==='planned');assert.equal(live.length,2,'each purchase has its own reminder');assert.ok(live.every(r=>split.tasks.some(t=>t.id===r.taskId)));
 await assert.rejects(splitIntoPurchases(store,auto.task.id,2,NOW),e=>e.code==='not_open');
 await assert.rejects(splitIntoPurchases(store,split.tasks[0].id,2,NOW),e=>e.code==='already_split'||e.code==='too_few');
 // each purchase finishes on its own and is counted on its own
 await completeTask(store,{taskId:split.tasks[0].id,method:null,expectNext:false},NOW);
 const view=await areaView(store,'home',NOW);assert.equal(view.current.length,1);assert.equal(view.done.length,1);assert.equal((await winsView(store)).cards.length,1);
});

test('five purchases are five tasks',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Bunnings: deck boards, outdoor paint, drill, screws, brushes, sandpaper, gloves',referenceYear:2026});
 const auto=await maybeAutoSetup(store,extraction,NOW);const split=await splitIntoPurchases(store,auto.task.id,5,NOW);
 assert.equal(split.tasks.length,5);assert.equal((await areaView(store,'home',NOW)).current.length,5);assert.equal(split.tasks.reduce((s,t)=>s+t.items.length,0),7);
});

test('a completed task can be edited, and reopened without leaving a stale win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await completeTask(store,{taskId:auto.task.id,method:null,expectNext:false},NOW);
 const edited=await updateTask(store,auto.task.id,{title:'Bunnings run for the deck',notes:'Went on Saturday',location:'Bunnings Marrickville'});
 assert.equal(edited.status,'done');assert.equal(edited.title,'Bunnings run for the deck');
 assert.equal((await winsView(store)).cards[0].title,'Bunnings run for the deck','win follows the edit');
 const reopened=await reopenTask(store,auto.task.id);assert.equal(reopened.status,'open');assert.ok(reopened.items.every(i=>!i.done));
 assert.equal((await winsView(store)).cards.length,0);assert.equal((await store.list('completions')).length,0);
 await assert.rejects(reopenTask(store,auto.task.id),e=>e.code==='not_done');
});

import {areaView,areaTiles} from '../lib/bear/services/areas.ts';
import {setWinSaving} from '../lib/bear/services/win-edit.ts';
import {confirmBill} from '../lib/bear/services/task-inference.ts';
import {homeView} from '../lib/bear/services/home.ts';

test('areas list what is current in each and move tasks to done',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 await updateTask(store,auto.task.id,{items:auto.task.items.map(i=>({...i,estimatedCents:1000}))});
 const home=await areaView(store,'home',NOW);assert.equal(home.current.length,1);assert.equal(home.current[0].taskId,auto.task.id);assert.match(home.current[0].estimate,/about \$70/);assert.equal(home.current[0].part,null);
 const tiles=await areaTiles(store,['family','home','money']);assert.equal(tiles.find(t=>t.key==='home').open,1);assert.equal(tiles.find(t=>t.key==='money').open,0);
 assert.equal((await homeView(store,NOW)).areas.find(a=>a.key==='home').open,1);
 await completeTask(store,{taskId:auto.task.id,method:null,expectNext:false},NOW);
 const after=await areaView(store,'home',NOW);assert.equal(after.current.length,0);assert.equal(after.done.length,1);
});

async function paidElectricityBill(store){
 const {extraction}=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 28/11/2026. BPAY biller 12345 ref 998877',referenceYear:2026});
 const {bill,task}=await confirmBill(store,{extractionId:extraction.id,corrections:{biller:'AGL',amountDueCents:18460,dueDate:'2026-11-28',category:'electricity',isRecurring:false},confirmedFields:['biller','amountDueCents','dueDate','category','isRecurring'],allowDuplicate:false});
 const done=await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);
 return {bill,task,done};
}
test('a saving the person knows about is counted, labelled as theirs, replaceable and removable',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {done}=await paidElectricityBill(store);
 assert.equal((await winsView(store)).totals.moneyCents,0,'nothing was printed on the bill, so nothing is counted automatically');
 await setWinSaving(store,done.win.id,{cents:1500,reason:'early_discount_used'},NOW);
 let view=await winsView(store);assert.equal(view.totals.moneyCents,1500);assert.match(view.cards[0].detail,/\+\$15\.00 early payment discount \(you told Bear\)/);assert.equal(view.cards[0].counted[0].mine,true);
 await setWinSaving(store,done.win.id,{cents:2000,reason:'discount_used'},NOW);
 view=await winsView(store);assert.equal(view.totals.moneyCents,2000,'replaced, not added twice');assert.equal(view.cards[0].detail.split('you told Bear').length,2);
 assert.equal((await homeView(store,NOW)).ledgers.wealth.headline,'$20.00 protected this month');
 await setWinSaving(store,done.win.id,{cents:0,reason:'discount_used'},NOW);
 assert.equal((await winsView(store)).totals.moneyCents,0);
});

test('a paid bill can be made current again, and its saving goes with the win',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {bill,task,done}=await paidElectricityBill(store);
 await setWinSaving(store,done.win.id,{cents:1500,reason:'early_discount_used'},NOW);
 const reopened=await reopenTask(store,task.id);assert.equal(reopened.status,'open');
 const b=await store.get('bills',bill.id);assert.equal(b.status,'watching');assert.equal(b.paidAt,null);
 const view=await winsView(store);assert.equal(view.cards.length,0);assert.equal(view.totals.moneyCents,0);
 assert.equal((await areaView(store,'money',NOW)).current.length,1);
});

import {setTimeZone,isValidTimeZone} from '../lib/bear/services/timezone.ts';
import {recommendPlan,acceptPlan} from '../lib/bear/services/reminder-planning.ts';
import {localParts} from '../lib/bear/domain/dates.ts';

test('Bear follows the phone: a new time zone is saved and waiting reminders are planned again for local time',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 assert.equal(isValidTimeZone('Australia/Perth'),true);assert.equal(isValidTimeZone('Not/AZone'),false);assert.equal(isValidTimeZone(''),false);
 const {auto}=await listTask(store);
 const before=(await store.list('reminders')).filter(r=>r.status==='scheduled'&&r.kind==='planned')[0];
 assert.ok(before,'a reminder was planned in Sydney time');
 const same=await setTimeZone(store,'Australia/Sydney',NOW);assert.equal(same.changed,false);
 const moved=await setTimeZone(store,'Australia/Perth',NOW);assert.equal(moved.changed,true);assert.equal(moved.replanned,1);
 assert.equal((await ensureProfile(store)).lifeRhythm.timezone,'Australia/Perth');
 const waiting=(await store.list('reminders')).filter(r=>r.status==='scheduled'&&r.kind==='planned');assert.equal(waiting.length,1,'old reminder replaced, not duplicated');
 const hour=localParts(waiting[0].scheduledFor,'Australia/Perth').hour;assert.ok(hour>=7&&hour<22,'planned at a waking hour in Perth, not at night: '+hour);
 assert.equal((await store.list('reminders')).filter(r=>r.status==='cancelled').length>=1,true);
});

test('a bill reminder reads as a date people recognise, not a raw ISO date',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {task,bill}=await (async()=>{const {extraction}=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 28/11/2026. BPAY biller 12345 ref 998877',referenceYear:2026});return confirmBill(store,{extractionId:extraction.id,corrections:{biller:'AGL',amountDueCents:18460,dueDate:'2026-11-28',category:'electricity',isRecurring:false},confirmedFields:['biller','amountDueCents','dueDate','category','isRecurring'],allowDuplicate:false});})();
 const plan=await recommendPlan(store,bill,task,NOW);const [r]=await acceptPlan(store,{billId:bill.id,when:plan.suggested.when,label:plan.suggested.label,rationale:'',key:'bear',followUpIfUnpaid:true},NOW);
 assert.match(r.message,/28 November 2026/);assert.doesNotMatch(r.message,/2026-11-28/);
});

test('a freshly set-up list is priced straight away when the AI service is connected',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const provider=new FakeProvider(input=>({prices:input.text.split('\n').map(n=>({name:n,cents:1000}))}));
 const {extraction}=await createCapture(store,null,{method:'text',text:LIST,referenceYear:2026});
 const auto=await maybeAutoSetup(store,extraction,NOW,provider);
 assert.ok(auto.task.items.every(i=>i.estimatedCents===1000));assert.equal(auto.task.estimatedCents,7000,'2 bags + 1 + 3 + 1 = 7 units at $10 each');
 assert.equal(provider.calls.length,1);
});

import {firstName} from '../lib/bear/domain/names.ts';
test('the name comes from the login: first name from sign-up or Google, nothing invented',()=>{
 assert.equal(firstName({name:'Govind'}),'Govind');assert.equal(firstName({full_name:'Govind Kumar'}),'Govind');assert.equal(firstName({given_name:'Ava',full_name:'Ava Lee'}),'Ava');
 assert.equal(firstName({}),'');assert.equal(firstName(null),'');assert.equal(firstName({name:42}),'');
});

import {pickGreeting,greetingPool,eligible,partOfDay} from '../lib/bear/domain/greetings.ts';
import {banned} from '../lib/bear/domain/copy.ts';
import {existsSync} from 'node:fs';
test('the banner greeting changes each visit, suits the day, and only uses real artwork and kind words',()=>{
 for(const g of greetingPool){assert.ok(existsSync(`public/bear/art/${g.art}.webp`),g.art+' exists');assert.ok(!banned.test(g.line),g.line);assert.ok(g.line.length<=44,'short enough to fit the banner: '+g.line);}
 assert.equal(partOfDay(9),'morning');assert.equal(partOfDay(13),'afternoon');assert.equal(partOfDay(20),'evening');
 const seen=new Set();for(let i=0;i<40;i++)seen.add(pickGreeting({hour:9,mode:null,random:()=>i/40}).id);assert.ok(seen.size>=3,'varies: '+[...seen]);
 assert.notEqual(pickGreeting({hour:9,mode:null,last:'got-you',random:()=>0}).id,'got-you','never the same line twice running');
 for(const mode of ['wiped','chaos'])for(const h of [8,14,21])assert.ok(eligible(partOfDay(h),mode).every(g=>g.modes?.includes(mode)),'hard days get only gentle lines');
 assert.ok(eligible('evening',null).every(g=>!g.modes),'no mode-specific lines without a mode');
 assert.ok(eligible('morning','good').some(g=>g.id==='head-start'));
});

import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
test('app icons are full-bleed squares of the supplied artwork, the manifest points at real files and no old drawing remains',()=>{
 const manifest=JSON.parse(readFileSync('public/bear/manifest.webmanifest','utf8'));
 for(const i of manifest.icons){const file='public'+i.src.split('?')[0];assert.ok(existsSync(file),file+' exists');assert.ok(!file.endsWith('.svg'),'no old SVG drawing in the manifest');}
 assert.equal(existsSync('public/bear/icon.svg'),false);
 const layout=readFileSync('app/bear/layout.tsx','utf8');assert.match(layout,/icon-32\.png\?v=4/);assert.match(layout,/apple-touch-icon\.png\?v=4/);
 // Corners must be artwork, not the black left over from a rounded-corner export.
 const py="from PIL import Image\nimport sys\nfor f in sys.argv[1:]:\n im=Image.open(f).convert('RGB');w,h=im.size\n for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]:\n  r,g,b=im.getpixel(p)\n  print(f,p,'BLACK' if max(r,g,b)<12 else 'ok')\n";
 const out=execFileSync('python3',['-c',py,'public/bear/apple-touch-icon.png','public/bear/icon-192.png','public/bear/icon-512.png','public/bear/art/icon-master-square.png']).toString();
 assert.ok(!out.includes('BLACK'),'icon corners are clean:\n'+out);
});


import {answerAfford,wishlistView} from '../lib/bear/services/task-edit.ts';
import {dueReminders} from '../lib/bear/services/reminders.ts';
import {parseItemLine,formatItemLine,BIG_SPEND_CENTS} from '../lib/bear/domain/items.ts';

test('a price can be typed after an item and survives a round trip through the edit box',()=>{
 const i=parseItemLine('2 bags potting mix - $18.50 each');assert.deepEqual([i.name,i.quantity,i.estimatedCents],['potting mix','2 bags',1850]);
 assert.equal(formatItemLine(i),'2 bags potting mix $18.50');assert.equal(parseItemLine(formatItemLine(i)).estimatedCents,1850);
 assert.equal(formatItemLine({name:'drill',quantity:null,estimatedCents:2500}),'drill $25');assert.equal(parseItemLine('milk').estimatedCents,null);
});

async function bigList(store){
 const {auto}=await listTask(store);
 await updateTask(store,auto.task.id,{items:auto.task.items.map((i,k)=>({...i,estimatedCents:[9000,3000,2500,1500][k]}))});
 return store.get('tasks',auto.task.id);
}
test('a big spend asks when it is affordable: now keeps it current, a date or check-back moves it to the wishlist with one reminder',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);let task=await bigList(store);
 assert.ok(task.estimatedCents>=BIG_SPEND_CENTS,'above the threshold that triggers the question');
 // not sure → check back in 30 days
 task=await answerAfford(store,task.id,{mode:'check_back',days:30},NOW);
 assert.equal(task.wishlist.checkBackAt,'2026-12-10');assert.equal(task.buyWhen,null);
 const live=(await store.list('reminders')).filter(r=>r.status==='scheduled');assert.equal(live.length,1,'the earlier plan is replaced by one check-back');
 {const l=localParts(live[0].scheduledFor,'Australia/Sydney');assert.equal(l.date,'2026-12-10');assert.equal(l.hour,10,'10 am local');}assert.match(live[0].message,/Is now a good time to buy/);assert.match(live[0].message,/\$/);
 // off the busy screens
 const home=await homeView(store,NOW);assert.equal(home.needsYou.length,0);assert.equal(home.areas.find(a=>a.key==='home').open,0);assert.equal(home.wishlist.count,1);assert.equal(home.wishlist.next,'2026-12-10');
 assert.ok(!home.handling.lines.some(l=>/other thing/.test(l)),'not counted as held for you');
 assert.equal((await areaView(store,'home',NOW)).current.length,0);
 const wl=await wishlistView(store);assert.equal(wl.items.length,1);assert.equal(wl.items[0].checkBackAt,'2026-12-10');assert.equal(wl.items[0].areaKey,'home');
 // it comes back as one reminder on the check-back day
 const due=await dueReminders(store,new Date('2026-12-10T10:30:00+11:00'));assert.equal(due.length,1);assert.equal(due[0].reminder.taskId,task.id);
 // checking back: ready now → current again with a plan
 task=await answerAfford(store,task.id,{mode:'now'},new Date('2026-12-10T10:31:00+11:00'));assert.equal(task.wishlist,null);assert.equal(task.buyWhen,'now');
 assert.equal((await wishlistView(store)).items.length,0);assert.equal((await areaView(store,'home',NOW)).current.length,1);
});

test('a known date, or no date at all, are both valid wishlist answers; past dates are not',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const task=await bigList(store);
 await assert.rejects(answerAfford(store,task.id,{mode:'date',date:'2026-11-01'},NOW),e=>e.code==='invalid_date');
 await assert.rejects(answerAfford(store,task.id,{mode:'check_back'},NOW),e=>e.code==='invalid_days');
 const dated=await answerAfford(store,task.id,{mode:'date',date:'2027-02-14'},NOW);assert.equal(dated.wishlist.checkBackAt,'2027-02-14');
 const open=await answerAfford(store,task.id,{mode:'wishlist'},NOW);assert.equal(open.wishlist.checkBackAt,null);assert.equal(open.wishlist.since,dated.wishlist.since,'since is kept');
 assert.equal((await store.list('reminders')).filter(r=>r.status==='scheduled').length,0,'no date, no reminder: it simply waits on the wishlist');
 assert.equal((await homeView(store,NOW)).wishlist.next,null);
});

import {setRead,setNudge,ensureNudges,breakDownTask} from '../lib/bear/services/task-edit.ts';
import {understandWithRules} from '../lib/bear/ai/general-rules.ts';
const live=async store=>(await store.list('reminders')).filter(r=>r.status==='scheduled'||r.status==='snoozed');

test('Bear deduces how soon and how big: dates and appointments are time-sensitive, ideas can wait, projects are bigger',()=>{
 const a=understandWithRules('Look into new curtains for the lounge room',2026);assert.equal(a.timing.value,'flexible');assert.equal(a.size.value,'one_go');
 const b=understandWithRules('Return the permission form for Max by 12/11/2026',2026);assert.equal(b.timing.value,'time_sensitive');
 const c=understandWithRules('Book the dentist for Ava',2026);assert.equal(c.timing.value,'time_sensitive');
 const d=understandWithRules('Organise the garage and sort out the shed',2026);assert.equal(d.size.value,'bigger');assert.equal(d.timing.value,'flexible');
 const e=understandWithRules('Urgent: ring the plumber today',2026);assert.equal(e.timing.value,'time_sensitive');
});

test('a flexible task is held with no date, no time and no reminder, and the person chooses how to be reminded',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Look into new curtains for the lounge room',referenceYear:2026});
 const auto=await maybeAutoSetup(store,extraction,NOW);
 assert.equal(auto.task.timing,'flexible');assert.equal(auto.planned,false);assert.equal((await live(store)).length,0,'no reminder time is set for something that can wait');assert.equal(auto.task.nudgeChoice??null,null,'the choice is still the person’s to make');
 assert.equal((await homeView(store,NOW)).needsYou.length,0);
});

test('a time-sensitive task with no date is still planned, so it is not forgotten',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Urgent: ring the plumber today',referenceYear:2026});
 const auto=await maybeAutoSetup(store,extraction,NOW);assert.equal(auto.task.timing,'time_sensitive');assert.equal(auto.planned,true);assert.equal((await live(store)).length>=1,true);
});

test('changing how soon swaps planned reminders for gentle ones, and back',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);const {auto}=await listTask(store);
 assert.equal(auto.task.timing,'time_sensitive');assert.ok((await live(store)).length>=1);
 let r=await setRead(store,null,auto.task.id,{timing:'flexible'},NOW);assert.equal(r.task.timing,'flexible');assert.equal((await live(store)).length,0,'all dated reminders are gone');
 r=await setRead(store,null,auto.task.id,{timing:'time_sensitive'},NOW);assert.ok((await live(store)).some(x=>x.kind==='planned'),'planned again');
});

test('gentle reminders: a nudge every so often, never urgent, wording that does not press, and the next one lines itself up',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Look into new curtains for the lounge room',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);
 await assert.rejects(setNudge(store,task.id,{choice:'day',date:'2026-11-01'},NOW),e=>e.code==='invalid_date');
 await assert.rejects(setNudge(store,task.id,{choice:'every'},NOW),e=>e.code==='invalid_every');
 const t=await setNudge(store,task.id,{choice:'every',every:'fortnight'},NOW);assert.equal(t.nudgeChoice,'nudge');
 const [first]=await live(store);assert.equal(first.kind,'nudge');const l=localParts(first.scheduledFor,'Australia/Sydney');assert.equal(l.date,'2026-11-24');assert.equal(l.hour,10);
 assert.match(first.message,/^No rush\./);assert.ok(!banned.test(first.message));
 // it arrives gently, even on a day Bear is told nothing is urgent
 const due=await dueReminders(store,new Date('2026-11-24T10:45:00+11:00'));assert.equal(due.length,1);
 assert.equal(due[0].decision.essential,false);assert.deepEqual(due[0].decision.actions.map(a=>a.key),['help','another_time','stop_nudges']);assert.match(due[0].decision.message,/^No rush\./);
 // once it has gone, the next one is lined up a fortnight later
 await store.update('reminders',first.id,{status:'delivered',deliveredAt:'2026-11-24T10:46:00+11:00'});
 await ensureNudges(store,new Date('2026-11-24T11:00:00+11:00'));
 const [next]=await live(store);assert.equal(localParts(next.scheduledFor,'Australia/Sydney').date,'2026-12-08');
 // and the person can stop them entirely
 const stopped=await setNudge(store,task.id,{choice:'none'},NOW);assert.equal(stopped.nudgeChoice,'none');assert.equal((await live(store)).length,0);
 await ensureNudges(store,new Date('2026-12-20T09:00:00+11:00'));assert.equal((await live(store)).length,0,'nothing comes back once stopped');
});

test('a flexible task that mentions a date is never treated as urgent',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Return the permission form for Max by 12/11/2026',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);await setRead(store,null,task.id,{timing:'flexible'},NOW);
 const home=await homeView(store,new Date('2026-11-11T09:00:00+11:00'));assert.equal(home.needsYou.length,0,'no deadline protection for something marked no rush');
 assert.equal((await areaView(store,'family',NOW)).current[0].dueLabel,'No rush');
});

test('bigger tasks are broken into small steps by the AI service, only when asked or deduced, and never invented without it',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Organise the garage and sort out the shed',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);assert.equal(task.size,'bigger');
 await assert.rejects(breakDownTask(store,null,task.id),e=>e.code==='ai_unavailable');
 const provider=new FakeProvider(()=>({steps:['Clear a space to work','Sort into keep, donate, bin','Take the bin pile out','Shelve what is staying']}));
 const steps=await breakDownTask(store,provider,task.id);assert.equal(steps.length,4);assert.ok(steps.every(s=>s.dueAt===null&&s.timing==='flexible'),'no dates on the small steps of a flexible task');
 assert.equal((await store.list('task_dependencies',{where:[{column:'task_id',value:task.id}]})).length,4);
 await assert.rejects(breakDownTask(store,provider,task.id),e=>e.code==='already_steps');
 assert.equal((await areaView(store,'me',NOW)).current.length,1,'the steps stay inside the task');
});

test('choosing bigger on a task with no steps breaks it down when the AI service is connected',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Look into new curtains for the lounge room',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);const provider=new FakeProvider(()=>({steps:['Measure the windows','Choose a style','Compare prices']}));
 const r=await setRead(store,provider,task.id,{size:'bigger'},NOW);assert.equal(r.task.size,'bigger');assert.equal(r.brokeDown,true);
});

import {overdueDays,overdueLabel} from '../lib/bear/domain/overdue.ts';
test('overdue is calm, factual and only applies to things with a real date; no rush is never overdue',async()=>{
 assert.equal(overdueDays('2026-11-01','2026-11-10'),9);assert.equal(overdueDays('2026-11-10','2026-11-10'),0);assert.equal(overdueDays('2026-11-12','2026-11-10'),0);
 assert.equal(overdueDays('2026-11-01','2026-11-10','flexible'),0);assert.equal(overdueDays(null,'2026-11-10'),0);
 assert.equal(overdueLabel(1),'Overdue by a day');assert.equal(overdueLabel(9),'Overdue by 9 days');assert.equal(overdueLabel(0),'');assert.ok(!banned.test(overdueLabel(9)));
});
test('something already overdue is flagged at the top of My Bear, in its area and in Needs you, and clears when it is marked no rush or done',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'Return the library books by 1/11/2026',referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);assert.equal(task.dueAt,'2026-11-01');assert.equal(task.timing,'time_sensitive');
 const home=await homeView(store,NOW);assert.equal(home.overdue.length,1);assert.equal(home.overdue[0].days,9);assert.equal(home.overdue[0].label,'Overdue by 9 days');
 assert.equal(home.needsYou.find(n=>n.taskId===task.id).overdueDays,9);
 assert.equal((await areaView(store,'home',NOW)).current[0].dueLabel,'Overdue by 9 days');assert.equal((await areaView(store,'home',NOW)).current[0].overdueDays,9);
 await setRead(store,null,task.id,{timing:'flexible'},NOW);assert.equal((await homeView(store,NOW)).overdue.length,0,'no rush clears it');
 await setRead(store,null,task.id,{timing:'time_sensitive'},NOW);assert.equal((await homeView(store,NOW)).overdue.length,1);
 await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);assert.equal((await homeView(store,NOW)).overdue.length,0,'done clears it');
});
test('an overdue bill is flagged with its amount',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:'AGL electricity bill. Amount due $184.60. Due 5/11/2026. BPAY biller 12345 ref 998877',referenceYear:2026});
 await confirmBill(store,{extractionId:extraction.id,corrections:{biller:'AGL',amountDueCents:18460,dueDate:'2026-11-05',category:'electricity',isRecurring:false},confirmedFields:['biller','amountDueCents','dueDate','category','isRecurring'],allowDuplicate:false});
 const home=await homeView(store,NOW);assert.equal(home.overdue.length,1);assert.equal(home.overdue[0].title,'Electricity bill');assert.equal(home.overdue[0].amount,'$184.60');assert.equal(home.overdue[0].days,5);assert.ok(home.overdue[0].billId);
});

test('My Wins: each win carries its area for colour coding, and every number has a breakdown behind it; nothing is invented',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {auto}=await listTask(store);const {done}=await paidElectricityBill(store);
 await completeTask(store,{taskId:auto.task.id,method:null,expectNext:false},NOW);
 await setWinSaving(store,done.win.id,{cents:1500,reason:'early_discount_used'},NOW);
 const view=await winsView(store);
 assert.equal(view.cards.find(c=>c.title.includes('Bunnings')).areaKey,'home');assert.equal(view.cards.find(c=>c.title.includes('Bunnings')).areaLabel,'Home');
 assert.equal(view.cards.find(c=>/bill paid/.test(c.title)).areaKey,'money');
 assert.equal(view.breakdown.money.length,1);assert.deepEqual([view.breakdown.money[0].reason,view.breakdown.money[0].cents,view.breakdown.money[0].mine],['Early payment discount',1500,true]);
 assert.equal(view.totals.moneyCents,view.breakdown.money.reduce((s,m)=>s+m.cents,0),'the number equals the sum of what is listed');
 assert.deepEqual(view.breakdown.time,[],'no time is claimed that was not measured');
 assert.equal(view.totals.handled,view.cards.filter(c=>!c.isDemo).length);
 assert.ok(!view.reinforcement||!/got the rest/.test(view.reinforcement));
});
test('things for me counts real wins marked for the person, not guesses',async()=>{
 const store=new MemoryBackend().for(USER);await onboard(store);
 const {extraction}=await createCapture(store,null,{method:'text',text:"Book my GP appointment for 18 November 2026",referenceYear:2026});
 const {task}=await maybeAutoSetup(store,extraction,NOW);await completeTask(store,{taskId:task.id,method:null,expectNext:false},NOW);
 const view=await winsView(store);assert.equal(view.totals.forMe,view.breakdown.forMe.length);
});

import {sharedText} from '../lib/bear/domain/share.ts';
test('shared text is tidy: parts that repeat each other are only used once',()=>{
 assert.equal(sharedText({title:'Excursion',text:'Return the form by Friday https://school.example/form',url:'https://school.example/form'}),'Excursion\nReturn the form by Friday https://school.example/form');
 assert.equal(sharedText({title:'Hello',text:'Hello there',url:null}),'Hello there');
 assert.equal(sharedText({title:'  ',text:'',url:''}),'');assert.equal(sharedText({url:'https://a.example'}),'https://a.example');
 assert.equal(sharedText({text:'x'.repeat(30000)}).length,20000);
});
test('the web app manifest accepts shares from other apps and lands inside its own scope',()=>{
 const m=JSON.parse(readFileSync('public/bear/manifest.webmanifest','utf8'));
 assert.equal(m.share_target.action,'/bear/share');assert.ok(m.share_target.action.startsWith(m.scope));assert.equal(m.share_target.method,'GET');assert.deepEqual(Object.keys(m.share_target.params).sort(),['text','title','url']);
});
