// Browser walkthrough of the Brain Dump Board (interrupted-lives redesign), at phone and desktop width.
// Runs against the in-memory store: BEAR_DEV_STORE=memory. Screenshots land in BEAR_TEST_RESULTS (default .bear-board-results).
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
try{
 for(let i=0;i<120;i++){try{const r=await fetch(base+'/bear/welcome');if(r.ok)break;}catch{}await delay(1000);}
 const browser=await chromium.launch({executablePath:process.env.BEAR_TEST_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{try{if(!sessionStorage.getItem('bear-test-init')){sessionStorage.setItem('bear-test-init','1');localStorage.setItem('bear-home-open',JSON.stringify({dump:true}));}}catch{}});
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const shot=n=>page.screenshot({path:resolve(results,n+'.png'),fullPage:true});
 const step=async(name,fn)=>{try{await fn();console.log('ok -',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL -',name,e.message);await (globalThis.p||page).screenshot({path:resolve(results,'fail-'+name.replace(/\W+/g,'-').slice(0,40)+'.png'),fullPage:false}).catch(()=>{});}};
 const api=(path,body,method='POST')=>page.evaluate(async([p,b,m])=>{const r=await fetch(p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});return r.json();},[path,body,method]);
 await page.goto(base+'/bear/welcome');
 await api('/api/bear/profile',{name:'Sarah',onboardingComplete:true,areas:['family','home','money']},'PUT');
 const rows=async()=>page.$$eval('[data-drop="inbox"] .b-row:not(.add) .b-title',e=>e.map(x=>x.textContent));

 await step('home is the Brain Dump Board: greeting, Mama Bear, one input, My Brain Dump, My Lists with the six starters',async()=>{
  await page.goto(base+'/bear/home');await page.waitForSelector('#dump-text');
  const g=await page.textContent('.board-hello');assert.match(g,/Good (morning|afternoon|evening), Sarah\./);assert.equal((await page.textContent('.board-ask')).trim(),'What’s on your mind?');
  assert.ok(await page.isVisible('.board-hero-img'),'Mama Bear');assert.equal(await page.getAttribute('#dump-text','placeholder'),'Brain dump it here…');
  assert.match(await page.textContent('.dump-card .home-card-text'),/My Brain DumpNothing yet/);assert.match(await page.textContent('.moment .home-card-text'),/Got a moment\?Find something you can tackle now/);
  const lists=await page.$$eval('.list-title',e=>e.map(x=>x.textContent));
  assert.deepEqual(lists,['Nighttime Tasks','Phone Calls','Aspirational','Organise – Follow-up','Organise – Time Permitting','This Week/Weekend']);
  const nav=await page.$$eval('.bear-nav a:not(.nav-brand) span',e=>e.map(x=>x.textContent));assert.deepEqual(nav,['Home','Shared','Bear Helps','Settings']);
  await shot('b01-empty');
 });
 await step('unloading eight things gives eight checklist items in My Brain Dump, with quiet suggestions, nothing filed',async()=>{
  await page.fill('#dump-text','I need to pay the electricity bill, order school lunches, call the possum man, book the podiatrist, follow up with the builder, organise Christmas presents, fix the bathroom mould and eventually build a new chicken pen.');
  await page.click('button:has-text("Unload")');await page.waitForSelector('.undo-toast:has-text("Got all")');
  const r=await rows();assert.equal(r.length,8,r.join(' | '));
  assert.equal(await page.$$eval('.list-title + .faint',e=>e.filter(x=>x.textContent.trim()).length),0,'no list has anything');
  assert.ok(await page.$('.b-sug:has-text("Nighttime Tasks")'));assert.ok(await page.$('.b-sug:has-text("Phone Calls")'));assert.ok(await page.$('.b-sug:has-text("Aspirational")'));
  assert.equal(await page.inputValue('#dump-text'),'','box cleared');
  await shot('b02-unloaded');
 });
 await step('Scenario 1: close the app before sorting; everything is still there',async()=>{const before=await rows();await page.close();const p2=await ctx.newPage();await p2.goto(base+'/bear/home');await p2.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');const after=await p2.$$eval('[data-drop="inbox"] .b-row:not(.add) .b-title',e=>e.map(x=>x.textContent));assert.deepEqual(after,before);globalThis.p=p2;});
 const pg=()=>globalThis.p;
 await step('typed-but-not-unloaded words survive a reload',async()=>{const p=pg();await p.fill('#dump-text','half a thought about the dentist');await p.waitForTimeout(200);await p.reload();await p.waitForSelector('#dump-text');assert.equal(await p.inputValue('#dump-text'),'half a thought about the dentist');await p.fill('#dump-text','');});
 await step('accept a suggestion: it moves into the list; ignore one: it stays, without the suggestion',async()=>{
  const p=pg();await p.click('.b-sug button:has-text("Phone Calls")');await p.waitForSelector('.undo-toast:has-text("Moved to")');
  await p.click('.list-head:has-text("Phone Calls")');await p.waitForSelector('[data-drop="calls"] .b-row:not(.add)');
  assert.ok((await p.textContent('[data-drop="calls"]')).match(/possum/i));
  const n=await p.$$eval('[data-drop="inbox"] .b-sug',e=>e.length);await Promise.all([p.waitForResponse(r=>r.url().includes('/ignore')),p.click('[data-drop="inbox"] .b-sug-x >> nth=0')]);await p.waitForFunction(k=>document.querySelectorAll('[data-drop="inbox"] .b-sug').length===k-1,n);
  await p.reload();await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');assert.equal(await p.$$eval('[data-drop="inbox"] .b-sug',e=>e.length),n-1,'ignore is saved');
 });
 await step('Scenario 2 and 6: move by menu into Nighttime and Aspirational, no dates asked for',async()=>{
  const p=pg();const row=p.locator('[data-drop="inbox"] .b-row:has-text("chicken")');await row.locator('.b-more').click();await p.click('.menu-list button:has-text("Move to list")');await p.click('.menu-list button:has-text("Aspirational")');
  await p.waitForSelector('.undo-toast:has-text("Aspirational")');assert.ok(!(await p.textContent('body')).match(/when.*(due|by)\?/i));
  await p.click('.list-head:has-text("Aspirational")');await p.waitForSelector('[data-drop="aspire"] .b-row:has-text("chicken")');
  assert.equal(await p.$$eval('[data-drop="aspire"] .b-row:has-text("chicken") .b-meta span:not(.b-tag)',e=>e.length),0,'no date shown');
 });
 await step('drag and drop: drag a row onto a list to move it there',async()=>{
  const p=pg();await p.click('.list-head:has-text("Nighttime Tasks")');
  const src=p.locator('[data-drop="inbox"] .b-row:has-text("electricity") .b-handle');const dst=p.locator('[data-drop="night"] .list-head');
  const a=await src.boundingBox();const b=await dst.boundingBox();
  await src.dispatchEvent('pointerdown',{pointerId:1,clientX:a.x+5,clientY:a.y+5,isPrimary:true,button:0});
  await p.evaluate(([x,y])=>{for(let i=1;i<=8;i++)window.dispatchEvent(new PointerEvent('pointermove',{pointerId:1,clientX:x,clientY:y*i/8,bubbles:true}));},[b.x+20,b.y+10]);
  await p.evaluate(([x,y])=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,clientX:x,clientY:y,bubbles:true})),[b.x+20,b.y+10]);
  await p.waitForSelector('[data-drop="night"] .b-row:has-text("electricity")');await shot2(p,'b03-sorted');
 });
 async function shot2(p,n){await p.screenshot({path:resolve(results,n+'.png'),fullPage:true});}
 await step('inline edit, complete with undo, delete with undo',async()=>{
  const p=pg();await p.click('[data-drop="inbox"] .b-row:has-text("podiatrist") .b-title');await p.fill('.b-edit','Book podiatrist for Sarah');await Promise.all([p.waitForResponse(r=>r.request().method()==='PATCH'),p.keyboard.press('Enter')]);
  await p.reload();await p.waitForSelector('text=Book podiatrist for Sarah');
  await p.click('[data-drop="inbox"] .b-row:has-text("lunches") .b-check');await p.waitForSelector('.undo-toast:has-text("Done: ")');await p.click('.undo-toast button:has-text("Undo")');await p.waitForSelector('[data-drop="inbox"] .b-row:has-text("lunches")');
  await p.locator('[data-drop="inbox"] .b-row:has-text("mould") .b-more').click();await p.click('.menu-list .danger');await p.waitForSelector('.undo-toast:has-text("Deleted")');await p.click('.undo-toast button:has-text("Undo")');
  await p.waitForSelector('[data-drop="inbox"] .b-row:has-text("mould")');await p.waitForTimeout(6500);await p.reload();await p.waitForSelector('[data-drop="inbox"] .b-row:has-text("mould")');
 });
 await step('Scenario 3: “Got a moment? 10 min” offers at most three things that fit, not the whole list',async()=>{
  const p=pg();if(!(await p.isVisible('.moment .chip')))await p.click('.moment .home-card-head');await p.click('.moment .chip:has-text("10 min")');await p.waitForSelector('.moment-out');
  const picks=await p.$$eval('.moment-out .b-row',e=>e.length);assert.ok(picks>=1&&picks<=3,`picks ${picks}`);
  assert.ok(!(await p.textContent('.moment-out')).match(/chicken/i));await shot2(p,'b04-moment');
 });
 await step('Scenario 4: start the builder follow-up, leave, come back: the draft and next step are there',async()=>{
  const p=pg();await p.locator('[data-drop="inbox"] .b-row:has-text("builder") .b-more').click();await p.click('.menu-list a:has-text("help me")');
  await p.waitForSelector('text=A follow-up message is drafted');const body=p.locator('textarea').first();assert.match(await body.inputValue(),/following up/i);
  await body.fill('Hi Dave,\n\nAny news on the quote for the deck?');await p.fill('input[placeholder^="e.g."]','Wait for Dave’s quote');await p.waitForSelector('text=Saved. You can stop any time.');
  await shot2(p,'b05-help');
  await p.goto(base+'/bear/home');await p.waitForSelector('.resume:has-text("Pick up where you left off")');assert.match(await p.textContent('.resume'),/Wait for Dave/);
  await p.click('.resume');await p.waitForURL(/\/bear\/help\//);await p.waitForSelector('text=Anything you type here is saved as you go.');assert.match(await p.locator('textarea').first().inputValue(),/Any news on the quote/);
  assert.match(await p.getAttribute('a:has-text("Open in Mail")','href'),/^mailto:/);
 });
 await step('Bear Helps lists things Bear can prepare, started first',async()=>{const p=pg();await p.goto(base+'/bear/helps');await p.waitForSelector('h1:has-text("Bear Helps")');const t=await p.textContent('main');assert.match(t,/Pick up where you left off[\s\S]*builder/i);assert.match(t,/Call notes|Bill details|Email drafted/);await shot2(p,'b06-helps');});
 await step('Scenario 5: Share Bear: make a transfer link, and the other person can open it',async()=>{
  const p=pg();await p.goto(base+'/bear/home');await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');
  await p.locator('[data-drop="inbox"] .b-row:has-text("Christmas") .b-more').click();await p.click('.menu-list button:has-text("Share Bear")');
  await p.fill('input[placeholder="James"]','James');await p.click('button[role="radio"]:has-text("Hand it over")');await p.click('button:has-text("Make a link to send")');
  await p.waitForSelector('text=Send the link');const link=await p.textContent('.tiny.muted[style*="break-all"]');assert.match(link,/\/bear\/shared\/join\/[A-Za-z0-9_-]{20,}/);
  await shot2(p,'b07-share');
  // Same person opening their own link is told so (the second account is covered by the unit tests).
  await p.goto(link.replace(/^https?:\/\/[^/]+/,base));await p.waitForSelector('text=This is your own link');
  await p.goto(base+'/bear/shared');await p.waitForSelector('text=You shared');assert.match(await p.textContent('main'),/Handed over[\s\S]*Christmas[\s\S]*Waiting for them to open the link/);
 });
 await step('Scenario 7: moving a school form against Bear’s suggestion teaches it',async()=>{
  const p=pg();await p.goto(base+'/bear/home');await p.fill('#dump-text','School excursion permission form for the weekend');await p.click('button:has-text("Unload")');await p.waitForSelector('.b-row:has-text("permission") .b-sug:has-text("This Week")');
  await p.locator('.b-row:has-text("permission") .b-more').click();await p.click('.menu-list button:has-text("Move to list")');await p.click('.menu-list button:has-text("Nighttime")');await p.waitForSelector('.undo-toast:has-text("Nighttime")');
  await p.fill('#dump-text','Sign the school permission slip');await p.click('button:has-text("Unload")');await p.waitForSelector('.b-row:has-text("permission slip") .b-sug button[aria-label^="You usually put this in Nighttime Tasks"]');
 });
 await step('lists: rename, add, delete a list without losing its tasks',async()=>{
  const p=pg();await p.goto(base+'/bear/me/lists');await p.waitForSelector('input[aria-label="List name"]');
  await p.locator('input[aria-label="List name"]').nth(1).fill('Calls to make');await p.click('button[aria-label="Remove Aspirational"]');await p.click('button:has-text("Add a list")');await p.locator('input[aria-label="List name"]').last().fill('Garden');
  await p.click('button:has-text("Save")');await p.waitForSelector('text=went back to My Brain Dump');await shot2(p,'b08-lists');
  await p.goto(base+'/bear/home');await p.waitForSelector('.list-title:has-text("Calls to make")');assert.ok(await p.$('.list-title:has-text("Garden")'));assert.ok(!(await p.$('.list-title:has-text("Aspirational")')));
  assert.ok(await p.$('[data-drop="inbox"] .b-row:has-text("chicken")'),'the chicken pen came back to the Brain Dump');
 });
 await step('Scenario 8: no AI configured, and everything above still worked; a manual add works too',async()=>{const p=pg();await p.fill('[data-drop="inbox"] .b-row.add input','Buy birthday card');await p.keyboard.press('Enter');await p.waitForSelector('[data-drop="inbox"] .b-row:has-text("Buy birthday card")');});
 await step('keyboard: arrow keys on the handle reorder within a list, focus stays on the row, and the order is saved',async()=>{
  const p=pg();await p.goto(base+'/bear/home');await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');
  const before=await p.$$eval('[data-drop="inbox"] .b-row:not(.add) .b-title',e=>e.map(x=>x.textContent));
  await p.focus('[data-drop="inbox"] .b-row:not(.add) >> nth=1 >> .b-handle');
  await Promise.all([p.waitForResponse(r=>r.url().includes('/move')),p.keyboard.press('ArrowUp')]);
  await p.waitForSelector(`.undo-toast:has-text("Moved up: ${before[1]}")`);
  const focused=await p.evaluate(()=>document.activeElement?.closest('.b-row')?.querySelector('.b-title')?.textContent);assert.equal(focused,before[1],'focus followed the row');
  await p.reload();await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');
  const after=await p.$$eval('[data-drop="inbox"] .b-row:not(.add) .b-title',e=>e.map(x=>x.textContent));assert.deepEqual(after.slice(0,2),[before[1],before[0]]);
  await p.locator('[data-drop="inbox"] .b-row:not(.add) >> nth=0 >> .b-more').click();await p.waitForSelector('.menu-list');assert.ok(await p.$('.menu-list button:has-text("Move down")'));assert.ok(!(await p.$('.menu-list button:has-text("Move up")')),'no Move up for the first row');await p.keyboard.press('Escape');
 });
 await step('household: the person she shared with is remembered; add an email, then share again with one tap and email the link',async()=>{
  const p=pg();await p.goto(base+'/bear/me/household');await p.waitForSelector('input[aria-label="Name"]');
  assert.equal(await p.inputValue('input[aria-label="Name"] >> nth=0'),'James','James was added when she shared with him');
  await p.fill('input[type="email"] >> nth=0','james@example.com');await p.click('button:has-text("Save")');await p.waitForSelector('text=Saved.');await shot2(p,'b11-household');
  await p.goto(base+'/bear/home');await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');
  await p.locator('[data-drop="inbox"] .b-row:has-text("birthday card") .b-more').click();await p.click('.menu-list button:has-text("Share Bear")');
  await p.click('[aria-label="Your household"] button:has-text("James")');await p.click('button:has-text("Make a link to send")');
  const href=await p.getAttribute('a:has-text("Email it to James")','href');assert.match(href,/^mailto:james%40example\.com\?subject=Load%20Bear/);assert.match(decodeURIComponent(href),/\/bear\/shared\/join\//);
  await shot2(p,'b12-share-household');await p.keyboard.press('Escape');
 });
 await step('her own time estimate: change it on the work page; without an AI key the "Ask Bear to write it" button is not offered',async()=>{
  const p=pg();await p.goto(base+'/bear/home');await p.waitForSelector('[data-drop="inbox"] .b-row:not(.add)');
  await p.locator('[data-drop="inbox"] .b-row:has-text("birthday card") .b-more').click();await p.click('.menu-list a:has-text("help me")');await p.waitForURL(/\/bear\/help\//);
  await p.click('button:has-text("(a guess)")');await p.click('[aria-label="How long does it take?"] button:has-text("30 min")');
  await p.waitForSelector('button.link-btn:has-text("About 30 min")');assert.ok(!(await p.textContent('main')).includes('(a guess)'));
  assert.equal(await p.$('button:has-text("Ask Bear to")'),null,'no AI button without an AI key');
 });
 await step('desktop: a quiet sidebar on the left, and Brain Dump and My Lists side by side',async()=>{const p=pg();await p.setViewportSize({width:1280,height:900});await p.goto(base+'/bear/home');await p.waitForSelector('.board-cols');const cols=await p.$$eval('.board-col',e=>e.map(x=>Math.round(x.getBoundingClientRect().left)));assert.ok(cols[1]>cols[0]+300,`columns ${cols}`);
  const nav=await p.$eval('.bear-nav .bar',e=>{const r=e.getBoundingClientRect();return {left:r.left,width:r.width,height:r.height};});assert.ok(nav.left<40&&nav.width<260&&nav.height>600,'sidebar: '+JSON.stringify(nav));assert.ok(await p.isVisible('.nav-brand'));
  const main=await p.$eval('.board-screen',e=>e.getBoundingClientRect().left+parseFloat(getComputedStyle(e).paddingLeft));assert.ok(main>=256,'content clears the sidebar: '+main);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no sideways scroll on desktop');await shot2(p,'b09-desktop');await p.setViewportSize({width:390,height:844});});
 await step('no page errors and no horizontal scroll on the phone',async()=>{const p=pg();await p.goto(base+'/bear/home');await p.waitForSelector('#dump-text');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'no sideways scroll');assert.deepEqual(errors,[]);await shot2(p,'b10-phone');});
 await browser.close();
}finally{server.kill('SIGTERM');}
if(failures.length){console.log('\n'+failures.length+' failed:\n- '+failures.join('\n- '));if(process.env.BEAR_TEST_LOG)console.log(log.slice(-4000));process.exit(1);}
console.log('\nall ok');
