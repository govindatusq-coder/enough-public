// Load Bear browser walk-through against `next dev` with the in-memory dev store.
// Drives the full P0 flow: onboarding → example bill → verify → plan → assistance → paid → wins.
// Screenshots land in BEAR_TEST_RESULTS (default .bear-browser-results).
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from 'playwright-core';

const port=Number(process.env.BEAR_TEST_PORT||3077),base='http://127.0.0.1:'+port;
const results=resolve(process.env.BEAR_TEST_RESULTS||'.bear-browser-results');await mkdir(results,{recursive:true});
const executablePath=process.env.BEAR_TEST_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const mode=process.env.BEAR_TEST_MODE||'dev';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next',mode,'--hostname','localhost','--port',String(port)],{cwd:process.cwd(),env:{...process.env,BEAR_DEV_STORE:'memory',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
let log='';server.stdout.on('data',d=>{log+=d;});server.stderr.on('data',d=>{log+=d;});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitForServer(){for(let i=0;i<120;i++){try{const r=await fetch(base+'/bear/welcome');if(r.ok)return;}catch{}await delay(1000);}throw new Error('Server did not start:\n'+log);}
let browser;const failures=[];let billUrl=null;
try{
 await waitForServer();
 browser=await chromium.launch({executablePath,headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,locale:'en-AU',timezoneId:'Australia/Sydney'});
 context.setDefaultTimeout(10000);const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.status()>=400&&!/favicon|manifest/.test(r.url()))console.log('HTTP',r.status(),r.request().method(),r.url(),r.request().headers()['origin']);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const shot=async(name)=>{await page.screenshot({path:resolve(results,name+'.png'),fullPage:true});};
 const step=async(name,fn)=>{try{await fn();console.log('ok -',name);}catch(e){failures.push(name+': '+e.message);console.log('FAIL -',name,e.message);await shot('fail-'+name.replace(/\W+/g,'-'));}};

 await step('welcome renders the brand',async()=>{await page.goto(base+'/bear/welcome');await page.waitForSelector('text=Give it to Bear');assert.ok(await page.textContent('body').then(t=>t.includes('Your mental load is')));await shot('01-welcome');});
 await step('root routes a new user to onboarding',async()=>{await page.goto(base+'/bear');await page.waitForURL(/\/bear\/onboarding/);await page.waitForSelector('text=What’s in your life?');await shot('02-areas');});
 await step('areas multi-select with nothing preselected',async()=>{const pressed=await page.$$eval('.tile[aria-pressed="true"]',e=>e.length);assert.equal(pressed,0);await page.click('button.tile:has-text("Money")');await page.click('button.tile:has-text("Family")');assert.equal(await page.$$eval('.tile[aria-pressed="true"]',e=>e.length),2);await shot('03-areas-selected');await page.click('button:has-text("Next")');await page.waitForSelector('text=Who do you carry things for?');});
 await step('people with names',async()=>{await page.click('button.chip:has-text("Children")');await page.fill('#n-child','Ava');await page.fill('#myname','Sarah');await shot('04-people');await page.click('button:has-text("Next")');await page.waitForSelector('text=Where would another brain help?');});
 await step('needs, interests, strengths',async()=>{await page.click('button.tile:has-text("Bills & money")');await shot('05-needs');await page.click('button:has-text("Next")');await page.waitForSelector('text=What do you want more room for?');await page.click('button.tile:has-text("Family time")');await page.click('button:has-text("Next")');await page.waitForSelector("text=You’ve already got a lot working.");await page.click('button.tile:has-text("Keeping calm in chaos")');await shot('06-strengths');await page.click('button:has-text("Next")');await page.waitForSelector('text=How do you like to get things done?');});
 await step('preferences',async()=>{await page.click('button.chip:has-text("A little cheeky")');await shot('07-preferences');await page.click('button:has-text("Next")');await page.waitForSelector('text=What’s a normal week like?');});
 await step('life rhythm timeline',async()=>{for(const l of ['Morning rush','Work','School run','Dinner','Bedtime','Admin time','Sleep'])await page.click(`button.chip:has-text("${l}")`);await page.click('.daybar button >> nth=1');assert.ok(await page.$$eval('.rhythm .block',b=>b.length)>=4);await shot('08-rhythm');await page.click('button:has-text("Next")');await page.waitForSelector('text=running on empty');});
 await step('capacity and done',async()=>{await page.click('button.chip:has-text("Morning scramble")');await page.click('button.chip:has-text("Dinner / bedtime")');await shot('09-capacity');await page.click('button:has-text("That’s me")');await page.waitForSelector('text=You’re all set');await shot('10-done');await page.click('button:has-text("Have a look around first")');await page.waitForURL(/\/bear\/home/);});
 await step('home empty state and example bill offer',async()=>{await page.waitForSelector('text=Nothing needs you right now.');assert.ok((await page.textContent('body')).includes('Good '));await shot('11-home-empty');await page.click('button:has-text("Try the example bill")');await page.waitForURL(/\/bear\/verify\//);});
 await step('verification shows demo data and a specific question',async()=>{await page.waitForSelector('text=Have I got this right?');const body=await page.textContent('body');assert.ok(body.includes('Example data'));assert.ok(body.includes('$184.60'));assert.ok(body.includes('Energy Australia'));await shot('12-verify');});
 await step('confirm the bill',async()=>{const q=await page.$('text=Is ');if(q){const yes=await page.$('.glass button:has-text("Yes")');if(yes)await yes.click();}await page.click('button:has-text("Yep, Bear\'s got it")');await page.waitForURL(/\/bear\/bills\//);billUrl=page.url().split('?')[0];await page.waitForSelector('text=When should I bring this back?');await shot('13-plan');});
 await step('accept Bear’s plan',async()=>{await page.click('button:has-text("Sounds good")');await page.waitForSelector('text=Bringing it back');await shot('14-bill');});
 await step('assistance options exist and nothing is auto-paid',async()=>{const body=await page.textContent('body');assert.ok(body.includes('Show BPAY details'));assert.ok(body.includes('Open payment page'));assert.ok(body.includes('You make the payment'));await page.click('button:has-text("Explain this bill")');await page.waitForSelector('text=late fee');});
 await step('home shows Bear handling it',async()=>{await page.goto(base+'/bear/home');await page.waitForSelector('text=1 bill being watched');await shot('15-home-watching');});
 await step('chaos mode',async()=>{await page.click('button.chip:has-text("Chaos")');await page.waitForSelector("text=I'll only bring you things that genuinely can't wait.");await shot('16-chaos');await page.click('button.chip:has-text("Chaos")');});
 await step('bear ideas',async()=>{await page.goto(base+'/bear/ideas');await page.waitForSelector('text=Bear noticed');await page.waitForSelector('.card');await shot('17-ideas');});
 await step('mark paid and see the win',async()=>{await page.goto(billUrl);await page.waitForSelector('button:has-text("I’ve paid it")');await page.click('button:has-text("I’ve paid it")');await page.waitForSelector('text=Paid? Lovely.');await shot('18-paid-sheet');const yes=await page.$('button:has-text("Yes please")');if(yes)await yes.click();await page.click('button:has-text("Yep, it\'s paid")');await page.waitForURL(/\/bear\/wins/);await page.waitForSelector('text=Electricity bill paid');const body=await page.textContent('body');assert.ok(body.includes('late fee avoided'),'defensible wealth entry shown');await shot('19-wins');});
 await step('home ledgers after paying',async()=>{await page.goto(base+'/bear/home');await page.waitForSelector('text=protected this month');await shot('20-home-after');});
 await step('capture sheet',async()=>{await page.goto(base+'/bear/capture');await page.waitForSelector('text=Give it to Bear.');const body=await page.textContent('body');assert.ok(body.includes('Needs the AI service connected'),'image capture visibly unavailable without a key');await shot('21-capture');await page.click('button:has-text("Paste the bill text")');await page.fill('#billtext','Sydney Water\nTotal amount due: $210.40\nDue date: 15/12/2026\nBPAY Biller code: 5555 Ref: 9988776655');await page.click('button[type="submit"]:has-text("Give it to Bear")');await page.waitForSelector("text=Bear’s working this out");await shot('22-thinking');await page.waitForURL(/\/bear\/verify\//,{timeout:15000});await page.waitForSelector('text=$210.40');await shot('23-verify-text');});
 await step('me screen',async()=>{await page.goto(base+'/bear/me');await page.waitForSelector('text=Reminders');await shot('24-me');});
 await step('no console errors',async()=>{const real=errors.filter(e=>!/favicon|manifest|404|hydrat|Download the React DevTools/i.test(e));assert.deepEqual(real,[]);});
}finally{await browser?.close();server.kill('SIGTERM');}
if(failures.length){console.error('\nFailures:\n'+failures.join('\n'));process.exit(1);}
console.log('\nBear browser walk-through passed. Screenshots in',results);
