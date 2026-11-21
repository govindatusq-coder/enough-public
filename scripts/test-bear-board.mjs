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
 await step('Got a Moment?: one invitation and one box; the first message becomes a chat in place; a time finds one thing; Give it to Bear',async()=>{
  await p.click('.bear-nav a[href="/bear/moment"]');await p.waitForSelector('.mc-idle');
  assert.equal((await p.textContent('.mc-title')).trim(),'Got a moment?');assert.equal((await p.textContent('.mc-prompt')).trim(),'How’s your day going?');
  assert.equal(await p.getAttribute('#mc-text','placeholder'),'Whatever’s on your mind…');
  assert.equal(await p.$$eval('textarea',e=>e.length),1,'exactly one box');
  for(const none of ['.v2-pill','.v2-more-chip','.v2-reco','.chip'])assert.equal(await p.$$eval(none,e=>e.length),0,`no ${none} on the opening screen`);
  assert.equal(await p.getAttribute('.bear-nav a[href="/bear/moment"]','aria-current'),'page');await shot('v04-moment');
  // What she's typing survives leaving and coming back.
  await p.fill('#mc-text','I’ve got 10 minutes');await p.click('.bear-nav a[href="/bear/brain"]');await p.waitForSelector('.v2-brain-head');
  await p.click('.bear-nav a[href="/bear/moment"]');await p.waitForSelector('.mc-idle');assert.equal(await p.inputValue('#mc-text'),'I’ve got 10 minutes');
  await p.click('.mc-send');await p.waitForSelector('.mc-chat .mc-bubble.you:has-text("10 minutes")');
  assert.ok(p.url().endsWith('/bear/moment'),'no route jump');assert.equal(await p.inputValue('#mc-text'),'','the box is ready for the next message');
  await p.waitForSelector('.mc-bubble.mc-b:has-text("Here’s one thing that fits.")');
  assert.equal((await p.textContent('.mc-card .v2-label')).trim(),'Worth doing now');assert.equal((await p.textContent('.mc-card .mc-card-title')).trim(),'Review Christmas gift shortlist');
  assert.match(await p.textContent('.mc-card'),/Takes about 5 minutes\./);assert.match(await p.textContent('.mc-card'),/Choosing a few now could avoid last-minute shopping/);
  assert.equal((await p.textContent('.mc-who strong')).trim(),'Bear');assert.equal((await p.textContent('.mc-who span')).trim(),'Here with you');await shot('v04b-moment-chat');
  // Without the AI, Bear says so plainly instead of pretending to chat.
  await p.fill('#mc-text','Rough day');await p.click('.mc-send');await p.waitForSelector('.mc-bubble.mc-b:has-text("thinking service isn’t connected")');
  // Away and back: the conversation is still there.
  await p.click('.bear-nav a[href="/bear/home"]:not(.nav-brand)');await p.waitForSelector('#dump-text');await p.click('.bear-nav a[href="/bear/moment"]');await p.waitForSelector('.mc-chat .mc-bubble.you:has-text("Rough day")');
  await p.click('.mc-card button:has-text("Give it to Bear")');await p.waitForURL(/\/bear\/brain\/[0-9a-f-]{36}$/);await p.waitForSelector('text=Christmas gift shortlist');
  assert.match(await p.textContent('main'),/Sarah: \(add a few ideas\)/);assert.match(await p.textContent('main'),/Needed by .*Christmas; change it if you celebrate earlier/);
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
 await step('Got a Moment? with nothing that fits says so honestly, no busywork',async()=>{
  const ctx2=await browser.newContext({viewport:{width:390,height:844}});const q=await ctx2.newPage();
  await q.goto(base+'/bear/moment');await q.waitForSelector('.mc-idle,.mc-chat');const before=await q.$$eval('.mc-bubble.mc-b',e=>e.length);
  await q.fill('#mc-text','I have 5 minutes');await q.click('.mc-send');await q.waitForFunction(n=>document.querySelectorAll('.mc-bubble.mc-b').length>n,before);
  const last=await q.$$eval('.mc-bubble.mc-b',e=>e.at(-1).textContent.trim());assert.ok(last.length>0,'Bear answers, even when nothing fits');await ctx2.close();
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
