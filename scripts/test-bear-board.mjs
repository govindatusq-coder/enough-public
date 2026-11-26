// Browser walkthrough of Load Bear v2: Drop Bear, Got a Moment?, Bear Brain, the responsibility page, and the features
// that carried over (sharing, categories, what Bear has learned), at phone and desktop width. In-memory store, no AI key.
// Screenshots land in BEAR_TEST_RESULTS (default .bear-board-results).
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const port=Number(process.env.BEAR_TEST_PORT||3078),base='http://localhost:'+port;
const results=resolve(process.env.BEAR_TEST_RESULTS||'.bear-board-results');await mkdir(results,{recursive:true});
const mode=process.env.BEAR_TEST_MODE||'dev';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,'--hostname','localhost','--port',String(port)],{cwd:process.cwd(),env:{...process.env,BEAR_DEV_STORE:'memory',NEXT_TELEMETRY_DISABLED:'1',ANTHROPIC_API_KEY:''},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',d=>log+=d);server.stderr.on('data',d=>log+=d);
const failures=[];
// A date a week away, said the way people say it ("by 23 November"), so the scrunchie can still be delivered.
const week=new Date(Date.now()+7*86400000);const byDate=`by ${week.getDate()} ${week.toLocaleString('en-AU',{month:'long'})}`;
try{
 for(let i=0;i<120;i++){try{const r=await fetch(base+'/bear/welcome');if(r.ok)break;}catch{}await delay(1000);}
 const browser=await chromium.launch({executablePath:process.env.BEAR_TEST_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>p.screenshot({path:resolve(results,n+'.png'),fullPage:true});
 const step=async(name,fn)=>{try{await fn();console.log('ok -',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL -',name,e.message);await p.screenshot({path:resolve(results,'fail-'+name.replace(/\W+/g,'-').slice(0,40)+'.png')}).catch(()=>{});}};
 const api=(path,body,method='POST')=>p.evaluate(async([u,b,m])=>{const r=await fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json();},[path,body,method]);
 await p.goto(base+'/bear/welcome');
 await api('/api/bear/profile',{name:'Sarah',onboardingComplete:true,areas:['family','home','money'],family:[{name:'Sarah',relation:'child',age:7,yearLevel:null,school:null,allergies:null,notes:null},{name:'James',relation:'partner',age:null,yearLevel:null,school:null,allergies:null,notes:null}]},'PUT');

 await step('Drop Bear: Load Bear, Mama Bear, settings, greeting, one big input with photo and send, three tabs',async()=>{
  await p.goto(base+'/bear/home');await p.waitForSelector('#dump-text');
  assert.equal(await p.getAttribute('.v2-logo img','alt'),'Load Bear');assert.ok(await p.isVisible('.v2-logo-img'),'the Load Bear logo is in the header');assert.ok(await p.isVisible('.v2-bear-img'),'Mama Bear');assert.ok(await p.$('.v2-gear[href="/bear/me"]'),'settings in the header');
  assert.match(await p.textContent('.v2-hello'),/^(Morning|Afternoon|Evening), Sarah\.$/);assert.equal((await p.textContent('.v2-ask')).trim(),'What’s on your mind?');
  assert.equal(await p.getAttribute('#dump-text','placeholder'),'Drop it here. I’ll sort it, plan it and get it moving.');
  assert.ok(await p.$('button[aria-label="Add a photo or PDF"]'));assert.ok(await p.$('.drop-card .dump-go'));
  assert.ok(await p.$('.drop-card .dump-mic:not(.drop-attach)'),'the microphone is always there');
  assert.deepEqual(await p.$$eval('.bear-nav a:not(.nav-brand) span',e=>e.map(x=>x.textContent)),['Drop Bear','Got a Moment?','Bear Brain']);
  assert.equal(await p.getAttribute('.bear-nav a:not(.nav-brand)[href="/bear/home"]','aria-current'),'page');
  assert.equal(await p.$('.list-block, .dump-card, .sort-btn'),null,'no task-management controls on Drop Bear');
  await shot('v01-drop-bear');
 });
 await step('microphone: it listens and the words appear; if the phone refuses, Bear says why and opens the keyboard microphone',async()=>{
  const fake=(mode)=>`(()=>{class R{start(){setTimeout(()=>{if('${mode}'==='ok'){this.onresult&&this.onresult({resultIndex:0,results:[Object.assign([{transcript:'Call the plumber'}],{isFinal:true})]});this.onend&&this.onend();}else{this.onerror&&this.onerror({error:'${mode}'});this.onend&&this.onend();}},200);}stop(){this.onend&&this.onend();}abort(){}}window.webkitSpeechRecognition=R;window.SpeechRecognition=R;})()`;
  for(const [mode,expect] of [['ok',null],['service-not-allowed','Your phone doesn’t let Load Bear listen directly here.'],['none','Tap the microphone on your keyboard']]){
   const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await c.addInitScript(mode==='none'?'delete window.webkitSpeechRecognition;delete window.SpeechRecognition;try{localStorage.removeItem("bear-speech")}catch{}':fake(mode));
   const q=await c.newPage();await q.goto(base+'/bear/home');await q.waitForSelector('#dump-text');await q.fill('#dump-text','');
   await q.click('.drop-card .dump-mic:not(.drop-attach)');
   if(mode==='ok'){await q.waitForFunction(()=>document.querySelector('#dump-text').value==='Call the plumber');}
   else{await q.waitForSelector(`.dump-hint:has-text("${expect}")`);assert.equal(await q.evaluate(()=>document.activeElement?.id),'dump-text','the box is ready for the keyboard microphone');
    if(mode==='service-not-allowed')assert.equal(await q.evaluate(()=>localStorage.getItem('bear-speech')),'keyboard','next time it goes straight to the keyboard');}
   await c.close();
  }
 });
 await step('Drop four things at once: four responsibilities, a short acknowledgement',async()=>{
  await p.fill('#dump-text','I need to get Sarah’s scrunchie, organise Christmas presents, book the dentist and follow up with the school.');
  await p.click('.drop-card .dump-go');await p.waitForSelector('.v2-ack');assert.match(await p.textContent('.v2-ack'),/I’ve got those four things\. I’ll work out what needs attention and what I can help with\./);
  assert.equal(await p.$('.v2-tip'),null,'nothing here is time-sensitive enough to mention straight away');
  // The result takes the box's place; one tap goes back to a clean Drop Bear.
  assert.ok(!(await p.isVisible('.drop-card')),'the box steps aside for the result');
  await p.click('.v2-result button:has-text("Back to Drop Bear")');await p.waitForSelector('#dump-text');assert.equal(await p.$('.v2-result'),null);
 });
 await step('Scrunchie: a tip worth knowing, Give it to Bear, Bear prepares, she orders, Bear waits, it arrives',async()=>{
  await p.fill('#dump-text',`Sarah needs a red scrunchie ${byDate}`);await p.click('.drop-card .dump-go');
  await p.waitForSelector('.v2-tip:has-text("scrunchie")');assert.equal((await p.textContent('.v2-tip')).trim(),'One thing worth knowing: ordering Sarah’s red scrunchie today could save you a shopping trip.');await shot('v02-tip');
  await p.click('.v2-ack button:has-text("Give it to Bear")');await p.waitForURL(/\/bear\/brain\/[0-9a-f-]{36}$/);
  await p.waitForSelector('text=Where to order a red scrunchie');assert.match(await p.textContent('main'),/doesn’t buy anything/);
  assert.match(await p.getAttribute('a:has-text("Search shops")','href'),/^https:\/\/www\.google\.com\/search\?tbm=shop/);
  assert.equal((await p.textContent('.v2-status')).trim(),'Ready for you to check');await shot('v03-prepared');
  await p.click('button:has-text("I’ve ordered it")');await p.waitForSelector('.v2-status:has-text("Waiting for delivery")');assert.match(await p.textContent('main'),/Bear will check back then/);
  await p.click('button:has-text("It’s arrived")');await p.waitForSelector('text=Done.');assert.equal((await p.textContent('.v2-status')).trim(),'Completed');
 });
 await step('Got a Moment?: exactly three choices; Need a Break (time, one idea, a different one, Sounds good); Talk It Out opens the chat with no time question; Finish or share a task (real task, Ask someone or Let’s do it, Bear prepares, Mark as done)',async()=>{
  await p.click('.bear-nav a[href="/bear/moment"]');await p.waitForSelector('.gm-choices');
  assert.equal((await p.textContent('.gm-title')).trim(),'Got a Moment?');assert.equal((await p.textContent('.gm-headline')).trim(),'What do you need right now?');
  assert.deepEqual(await p.$$eval('.gm-choice strong',e=>e.map(x=>x.textContent)),['Need a Break','Talk It Out','Finish or share a task']);
  assert.deepEqual(await p.$$eval('.gm-choice-text span',e=>e.map(x=>x.textContent)),['A little time just for you','Get something off your chest','Get something off your list']);
  for(const none of ['.v2-pill','.chip','textarea','.v2-reco'])assert.equal(await p.$$eval(none,e=>e.length),0,`no ${none} on the opening screen`);
  assert.equal(await p.getAttribute('.bear-nav a[href="/bear/moment"]','aria-current'),'page');await shot('v04-moment');
  // Need a Break
  await p.click('.gm-choice:has-text("Need a Break")');await p.waitForSelector('.gm-h:has-text("Let’s find you a little breathing room.")');
  assert.deepEqual(await p.$$eval('.gm-time',e=>e.map(x=>x.textContent)),['2 min','5 min','10 min','20 min']);
  await p.click('.gm-time:has-text("5 min")');await p.waitForSelector('.gm-card-title');const first=(await p.textContent('.gm-card-title')).trim();
  await p.click('button:has-text("Another idea")');await p.waitForFunction(t=>document.querySelector('.gm-card-title')?.textContent.trim()!==t,first);
  await shot('v04b-break');await p.click('button:has-text("Sounds good")');await p.waitForSelector('.gm-enjoy');
  await p.click('button:has-text("Back to Got a Moment")');await p.waitForSelector('.gm-choices');
  // Talk It Out: straight into the conversation
  await p.click('.gm-choice:has-text("Talk It Out")');await p.waitForSelector('.mc-chat');
  // Bear's opening line shows once the kept conversation has loaded (a fresh sitting), so wait for it rather than racing it.
  await p.waitForSelector('.mc-thread .mc-bubble.mc-b:has-text("I’m listening. What’s on your mind?")');assert.equal(await p.$$eval('.gm-time',e=>e.length),0,'no time question');
  await p.fill('#mc-text','Rough day');await p.click('.mc-send');await p.waitForSelector('.mc-bubble.mc-b:has-text("thinking service isn’t connected")');
  await p.click('.mc-top button[aria-label="Back"]');await p.waitForSelector('.gm-choices');
  // Finish or share a task: a real task from Bear Brain, one at a time; handing off is offered without an extra question
  await p.click('.gm-choice:has-text("Finish or share a task")');await p.waitForSelector('.gm-h:has-text("Let’s get something off your list.")');
  assert.ok(await p.isVisible('button.gm-handoff:has-text("No time? Hand something off")'));await shot('v04b2-task-time');
  await p.click('.gm-time:has-text("10 min")');await p.waitForSelector('.gm-card-title');
  assert.equal((await p.textContent('.gm-card .v2-label')).trim(),'Worth doing now');assert.equal((await p.textContent('.gm-card-title')).trim(),'Review Christmas gift shortlist');
  assert.match(await p.textContent('.gm-card'),/Choosing a few now could avoid last-minute shopping/);await shot('v04c-task');
  // Ask someone sits beside Let's do it, and opens Share Bear on this task; Cancel closes it and leaves the suggestion as it was.
  // The main button says what happens: Bear prepares the gift ideas first, so it's "Give it to Bear".
  assert.equal((await p.textContent('.gm-pair .btn.coral')).trim(),'Give it to Bear');assert.ok(await p.isVisible('.gm-pair button:has-text("Ask someone")'));
  await p.click('.gm-pair button:has-text("Ask someone")');await p.waitForSelector('.sb-h:has-text("Who can help with this?")');
  await p.click('.sb-sheet button:has-text("Cancel")');await p.waitForSelector('.sb-sheet',{state:'detached'});assert.equal((await p.textContent('.gm-card-title')).trim(),'Review Christmas gift shortlist');
  await p.click('.gm-pair .btn.coral');await p.waitForSelector('.gm-do');assert.match(await p.textContent('.gm-do'),/Sarah: \(add a few ideas\)/);
  assert.ok(await p.isVisible('button:has-text("Mark as done")'));assert.ok(await p.isVisible('button:has-text("Ask someone to do it")'));
  // Back steps back through the flow, not out of it.
  await p.click('.gm-back');await p.waitForSelector('.gm-card-title:has-text("Review Christmas gift shortlist")');
  // Ticking one off: its own task, so the Christmas task stays as it is for the steps after this.
  await api('/api/bear/board/dump',{text:'Return the library book',via:'text'});
  await p.click('.gm-back');await p.click('.gm-time:has-text("20 min")');await p.waitForSelector('.gm-card-title');
  for(let k=0;k<8&&!/library/i.test(await p.textContent('.gm-card-title'));k++){const t=await p.textContent('.gm-card-title');await p.click('button:has-text("Another task")');await p.waitForFunction(x=>document.querySelector('.gm-card-title')?.textContent!==x||document.querySelector('.gm-card h1')?.textContent.startsWith('Nothing'),t);}
  assert.match(await p.textContent('.gm-card-title'),/library/i);
  await p.click('.gm-pair .btn.coral');await p.waitForSelector('.gm-do');await p.click('button:has-text("Mark as done")');
  await p.waitForSelector('.gm-done:has-text("One less thing on your mind.")');assert.match(await p.textContent('.gm-crossed .crossed-off'),/library/i,'the task, crossed off');await shot('v04d-done');
  const bd=(await api('/api/bear/board',null,'GET')).board;assert.ok(![...bd.inbox,...Object.values(bd.byList).flat()].some(t=>/library/i.test(t.title)),'done in Bear Brain straight away');
  await p.click('button:has-text("Back to Got a Moment")');await p.waitForSelector('.gm-choices');
 });
 await step('Bear Brain: title, All Tasks count, Priority Actions, the six categories in order with counts',async()=>{
  await p.click('.bear-nav a[href="/bear/brain"]');await p.waitForSelector('.v2-brain-head');
  assert.equal((await p.textContent('.v2-brain-titles h1')).trim(),'Bear Brain');assert.equal((await p.textContent('.v2-brain-titles p')).trim(),'All your tasks, plans and progress.');
  const allOpt=await p.textContent('.v2-fold-head:has-text("All Tasks") span');const total=Number(allOpt.match(/^All Tasks \((\d+)\)$/)[1]);
  const counts=await p.$$eval('.v2-cat-count',e=>e.map(x=>Number(x.textContent)));assert.equal(counts.reduce((a,b)=>a+b,0),total,'the count is real');
  assert.deepEqual(await p.$$eval('.v2-cat-title',e=>e.map(x=>x.textContent)),['Night Time','Phone Calls','Organise Follow-Up','Organise Time-Permitting','This Week & Weekend','Aspirations']);
  assert.ok(await p.$('#pa-h:has-text("Priority Actions")'));
  // Both fold away until tapped.
  assert.equal(await p.$$eval('.v2-fold .v2-plist',e=>e.length),0,'All Tasks and Priority Actions start closed');await shot('v05-brain');
  await p.click('.v2-fold-head:has-text("All Tasks")');await p.waitForSelector('.v2-fold .v2-plist');assert.equal(await p.$$eval('.v2-fold .v2-plist .v2-prow',e=>e.length),total,'All Tasks shows every task');
  await p.click('.v2-fold-head:has-text("All Tasks")');await p.click('.v2-fold-head:has-text("Priority Actions")');await p.waitForSelector('.v2-fold .v2-plist .v2-prow:has-text("Christmas")');await p.click('.v2-fold-head:has-text("Priority Actions")');
 });
 await step('Bear Brain: open a category, open a task, correct its category, and it stays corrected',async()=>{
  await p.click('.v2-cat-head:has-text("Phone Calls")');await p.waitForSelector('[data-drop="calls"] .b-row:has-text("dentist")');
  await p.click('[data-drop="calls"] .b-row:has-text("dentist") .b-detail');await p.waitForURL(/\/bear\/brain\/[0-9a-f-]{36}$/);
  await p.waitForSelector('text=Bear filed this here');assert.match(await p.textContent('main'),/The appointment is booked/);
  await p.selectOption('.v2-sec select','night');await p.waitForSelector('text=Category changed');await p.waitForSelector('text=You put this here.');
  await p.goto(base+'/bear/brain');await p.click('.v2-cat-head:has-text("Night Time")');await p.waitForSelector('[data-drop="night"] .b-row:has-text("dentist")');
 });
 await step('Bear Brain: search and filter',async()=>{
  await p.click('button[aria-label="Search"]');await p.fill('.v2-search','school');await p.waitForSelector('.v2-prow:has-text("school")');await p.click('button[aria-label="Search"]');
  await p.click('.v2-fold-head:has-text("All Tasks")');await p.click('.v2-filters .chip:has-text("Ready to check")');await p.waitForSelector('.v2-fold .v2-prow:has-text("Christmas")');
  assert.ok(!(await p.textContent('.v2-fold .v2-plist')).includes('dentist'),'filtered');await p.click('.v2-filters .chip:has-text("All (")');await p.click('.v2-fold-head:has-text("All Tasks")');await p.waitForSelector('.v2-cat');
 });
 await step('Kept from before: Share Bear from a task’s menu, categories you can rename, what Bear has learned',async()=>{
  await p.click('.v2-cat-head:has-text("Organise Follow-Up")');await p.waitForSelector('[data-drop="followup"] .b-row:has-text("school")');
  await p.locator('[data-drop="followup"] .b-row:has-text("school") .b-more:not(.b-detail)').click();await p.click('.menu-list button:has-text("Share Bear")');
  await p.fill('input[placeholder="James"]','James');await p.click('button:has-text("Make a link to send")');await p.waitForSelector('text=Send this link to James');await p.keyboard.press('Escape');
  await p.goto(base+'/bear/me/lists');await p.waitForSelector('input[aria-label="List name"]');assert.equal(await p.inputValue('input[aria-label="List name"] >> nth=0'),'Night Time');
  await p.goto(base+'/bear/me/learned');await p.click('button:has-text("I like to buy in person")');await p.waitForSelector('text=Prefers buying things in person');await p.click('button:has-text("Forget")');await p.waitForSelector('text=Nothing yet.');
 });
 await step('Got a Moment? Finish or share a task with very little time: one real task or an honest "nothing fits", never an invented one',async()=>{
  const ctx2=await browser.newContext({viewport:{width:390,height:844}});const q=await ctx2.newPage();
  await q.goto(base+'/bear/moment');await q.waitForSelector('.gm-choices,.gm-h,.gm-card');
  if(await q.$('.gm-back'))await q.click('.gm-back');await q.waitForSelector('.gm-choices');
  await q.click('.gm-choice:has-text("Finish or share a task")');await q.click('.gm-time:has-text("2 min")');await q.waitForSelector('.gm-card');
  const txt=await q.textContent('.gm-card');assert.ok(/Nothing on your list looks like a good fit for the time you’ve got\./.test(txt)||/You could get this sorted\./.test(txt),txt);
  if(/Nothing on your list/.test(txt))assert.ok(await q.isVisible('a:has-text("See my tasks")'));await ctx2.close();
 });
 await step('Got a Moment? No time? Hand something off: no time question, one task someone else could do, Ask someone opens Share Bear, never a present or her own appointment',async()=>{
  await api('/api/bear/board/dump',{text:'Pick up the dry cleaning on Thursday\nBook my dentist appointment',via:'text'});
  const ctx3=await browser.newContext({viewport:{width:390,height:844}});const q=await ctx3.newPage();
  await q.goto(base+'/bear/moment');await q.waitForSelector('.gm-choices,.gm-h,.gm-card');
  while(await q.$('.gm-back')){await q.click('.gm-back');await q.waitForTimeout(150);}await q.waitForSelector('.gm-choices');
  await q.click('.gm-choice:has-text("Finish or share a task")');await q.click('button.gm-handoff');await q.waitForSelector('.gm-card');
  assert.equal(await q.$$eval('.gm-time',e=>e.length),0,'no time question');
  const seen=[];
  for(let k=0;k<10;k++){const txt=await q.textContent('.gm-card');if(/Nothing on your list looks easy/.test(txt))break;
   assert.match(txt,/Someone else could take this\./);const t=(await q.textContent('.gm-card-title')).trim();seen.push(t);if(/dry cleaning/i.test(t))break;
   await q.click('.gm-card button:has-text("Another one")');await q.waitForFunction(x=>document.querySelector('.gm-card-title')?.textContent.trim()!==x||/Nothing on your list/.test(document.querySelector('.gm-card')?.textContent||''),t);}
  assert.ok(seen.some(t=>/dry cleaning/i.test(t)),'the dry cleaning is offered: '+seen.join(' | '));
  assert.ok(!seen.some(t=>/dentist|christmas|gift/i.test(t)),'never her own appointment or a present: '+seen.join(' | '));
  await q.screenshot({path:resolve(results,'v04e-handoff.png'),fullPage:true});
  await q.click('.gm-card button:has-text("Ask someone")');await q.waitForSelector('.sb-h:has-text("Who can help with this?")');
  await q.click('.sheet-backdrop',{position:{x:40,y:40}});await q.waitForSelector('.sb-sheet',{state:'detached'});
  await q.click('.gm-card button:has-text("Not now")');await q.waitForSelector('.gm-choices');await ctx3.close();
 });
 await step('Crossing off in Bear Brain (box fills, line through, then it goes, Undo still there); My Wins counts it, from a small link',async()=>{
  await api('/api/bear/board/dump',{text:'Water the pot plants',via:'text'});
  const before=(await api('/api/bear/wins/summary',null,'GET')).total;
  const brain=await api('/api/bear/rre/brain',null,'GET');const cat=brain.categories.find(c=>c.items.some(i=>/pot plants/i.test(i.title)));
  await p.goto(base+'/bear/brain');await p.waitForSelector(`.v2-cat-head:has-text("${cat.title}")`);
  await p.waitForSelector(`.board-links a.brain-wins:has-text("My Wins (${before})")`);
  await p.click(`.v2-cat-head:has-text("${cat.title}")`);const row=p.locator('.b-row:has-text("Water the pot plants")');await row.waitFor();
  await row.locator('.b-check').click();
  await p.waitForSelector('.b-row.crossing:has-text("Water the pot plants") .b-check.on');
  assert.equal(await p.$eval('.b-row.crossing .b-title-text',e=>getComputedStyle(e).backgroundImage.includes('gradient')),true,'a line draws through the title');
  await p.waitForSelector('.b-row:has-text("Water the pot plants")',{state:'detached'});await p.waitForSelector('.undo-toast:has-text("Done: Water the pot plants") button:has-text("Undo")');
  await p.click('.board-links a.brain-wins');await p.waitForSelector('.mw-count');
  assert.equal(Number(await p.textContent('.mw-count b')),before+1);assert.match(await p.textContent('.mw-count p'),/^This week \d+ · This month \d+$/);
  assert.match(await p.textContent('.mw-recent li:first-child .mw-done'),/Water the pot plants/);await shot('v08-my-wins');
  await p.click('.mw-more a');await p.waitForSelector('h1:has-text("What Bear has protected")');
 });
 await step('Share Bear by text: ask from the task, exact preview, test-mode send, Daniel answers without an account, she hears back, done',async()=>{
  await api('/api/bear/board/dump',{text:'Pick up Ella’s birthday cake on Friday before 3 pm',via:'text'});
  const bd=(await api('/api/bear/board',null,'GET')).board;const task=[...bd.inbox,...Object.values(bd.byList).flat()].find(t=>/cake/.test(t.title));
  await p.goto(base+'/bear/brain/'+task.id);await p.click('.sb-entry');await p.waitForSelector('.sb-h:has-text("Who can help with this?")');
  await p.click('button:has-text("Enter mobile number")');await p.fill('.sb-field:has-text("Their name") input','Daniel');await p.fill('.sb-field:has-text("Mobile number") input','0412 345');
  await p.click('.sb-actions button:has-text("Next")');await p.waitForSelector('.sb-sheet .note.coral');assert.match(await p.textContent('.sb-sheet .note.coral'),/Australian mobile|Check the number/);
  await p.fill('.sb-field:has-text("Mobile number") input','0412 345 678');await p.click('.sb-actions button:has-text("Next")');await p.waitForSelector('.sb-h:has-text("Ask Daniel for help?")');
  await p.click('.sb-exact summary');const exact=await p.textContent('.sb-exact p');assert.match(exact,/^🐻 Sarah wants your help with this:\nPick up Ella’s birthday cake by Friday \d+ \w+, 3 pm\.\nCan you take care of it\?/);
  assert.ok(await p.isVisible('text=Test mode: no real text will be sent.'));await shot('v07-sharebear-preview');
  await p.click('button:has-text("Send request")');await p.waitForSelector('.sb-testlink');const link=await p.getAttribute('.sb-testlink','href');
  await p.click('.sb-actions button:has-text("Done")');await p.waitForSelector('.sb-panel:has-text("Waiting")');assert.equal(await p.$$eval('.sb-entry',e=>e.length),0,'no second request while one is out');
  const c3=await browser.newContext({viewport:{width:375,height:667},isMobile:true,hasTouch:true});const q=await c3.newPage();
  await q.goto(link);await q.waitForSelector('.hr-h');assert.equal((await q.textContent('.hr-h')).trim(),'🐻 Sarah needs a hand');
  assert.ok((await q.$$eval('.hr-btn',e=>e.map(x=>x.getBoundingClientRect().height))).every(h=>h>=44),'big enough to tap');
  await q.click('button:has-text("Yes, I’ll do it")');await q.waitForSelector('.hr-h:has-text("You’ve got this!")');assert.ok(await q.isVisible('a:has-text("Get Load Bear")'));
  await p.goto(base+'/bear/home');await p.waitForSelector('.note.teal:has-text("Daniel’s got this!")');
  await p.goto(base+'/bear/brain');await p.click('.v2-fold-head:has-text("Shared with others")');await p.waitForSelector('.v2-prow:has-text("Daniel")');
  await q.reload();await q.click('button:has-text("Mark as done")');await q.click('button:has-text("Yes, it’s done")');await q.waitForSelector('.hr-h:has-text("All taken care of!")');
  await p.goto(base+'/bear/brain/'+task.id);await p.waitForSelector('.sb-panel:has-text("Bear hasn’t checked it")');
  const q2=await c3.newPage();await q2.goto(base+'/bear/r/'+'A'.repeat(43));await q2.waitForSelector('.hr-h');assert.equal((await q2.textContent('.hr-h')).trim(),'This request is no longer active.');await c3.close();
 });
 await step('desktop: three tabs in a sidebar, Bear Brain readable, no sideways scroll',async()=>{
  await p.setViewportSize({width:1280,height:900});await p.goto(base+'/bear/brain');await p.waitForSelector('.v2-cat');
  const nav=await p.$eval('.bear-nav .bar',e=>{const r=e.getBoundingClientRect();return {left:r.left,width:r.width,height:r.height};});assert.ok(nav.left<40&&nav.width<260&&nav.height>500,JSON.stringify(nav));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('v06-desktop');await p.setViewportSize({width:390,height:844});
 });
 await step('no page errors, no sideways scroll on the phone',async()=>{for(const path of ['/bear/home','/bear/moment','/bear/brain']){await p.goto(base+path);await p.waitForTimeout(600);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path);}assert.deepEqual(errors,[]);});
 await browser.close();
}finally{server.kill('SIGTERM');}
if(failures.length){console.log('\n'+failures.length+' failed:\n- '+failures.join('\n- '));if(process.env.BEAR_TEST_LOG)console.log(log.slice(-4000));process.exit(1);}
console.log('\nall ok');
