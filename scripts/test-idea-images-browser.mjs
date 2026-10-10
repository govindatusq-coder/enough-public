// Local production-browser integration test. Provider, auth and storage are
// fixtures, not a claim that a real OpenAI/Supabase round trip was tested.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {catalogue} from '../lib/ideas.ts';
import {emptyState,STORAGE_KEY} from '../lib/journey.ts';
import {createIdeaImageHandlers} from '../lib/idea-image-http.ts';
import {IdeaImageError,prepareIdeaImageBatch} from '../lib/idea-image-service.ts';

const {chromium}=await import(process.env.ENOUGH_TEST_PLAYWRIGHT_MODULE||'playwright');
const {default:sharp}=await import('sharp');
const port=Number(process.env.ENOUGH_TEST_PORT||3058),base='http://127.0.0.1:'+port;
const results=resolve(process.env.ENOUGH_TEST_RESULTS||'.idea-image-browser-results');
await mkdir(results,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let output='';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
server.stdout.on('data',data=>output+=data);server.stderr.on('data',data=>output+=data);
let browser;
const launch={headless:true};
if(process.env.ENOUGH_TEST_CHROMIUM_PATH)launch.executablePath=process.env.ENOUGH_TEST_CHROMIUM_PATH;
if(process.env.ENOUGH_TEST_CHROMIUM_FLAGS_MODULE){const {default:flags}=await import(pathToFileURL(process.env.ENOUGH_TEST_CHROMIUM_FLAGS_MODULE).href);flags.setGraphicsMode=false;launch.args=flags.args.filter(flag=>!['--in-process-gpu','--disable-web-security','--allow-running-insecure-content','--disable-site-isolation-trials'].includes(flag));}

const source=catalogue.find(i=>i.key==='break-stretch');
function makeIdea(id,movement,title){return {...source,id,key:'ai-'+id,title:'Image test · '+title,body:'Use an existing pause for '+title.toLowerCase()+'. Choose a comfortable pace.',usual:'Sit through the same pause',minutes:12,movementMode:movement,source:'ai',outdoor:movement==='run'||movement==='walk',effort:'gentle',brief:'A warm everyday scene showing '+title.toLowerCase()+'.',safety:movement==='stairs'?'Use the handrail.':'Choose a safe, familiar setting.'};}
const initial=[makeIdea(1001,'seated','Seated movement'),makeIdea(1002,'stairs','Taking the stairs'),makeIdea(1003,'run','A short run'),makeIdea(1004,'walk','A familiar walk')];
const batch=Array.from({length:10},(_,n)=>makeIdea(1100+n,n%2?'stairs':'seated','Fresh idea '+(n+1)));
const state=emptyState();Object.assign(state.profile,{preferences:['Nothing to add'],interests:['Nothing to add'],needs:['Nothing to add'],strengths:['Nothing to add'],activity:'Every day is different',rhythms:['Calls'],window:'It varies',complete:true});state.generated=initial;
const picture=await sharp(await readFile('public/images/call.webp')).resize(1536,1024).jpeg({quality:80}).toBuffer();
const storeObjects=new Map(),store={async read(key){return storeObjects.get(key)?.bytes||null;},async createdAt(key){return storeObjects.get(key)?.created??null;},async create(key,bytes){if(storeObjects.has(key))return false;storeObjects.set(key,{bytes,created:Date.now()});return true;},async remove(key){storeObjects.delete(key);}};
let accountState=structuredClone(state),revision=1,failProvider=true,failDownload=true;
const generation=new Map(),attempts=[],errors=[];
const generate=async idea=>{generation.set(idea.id,(generation.get(idea.id)||0)+1);await delay(100);if(idea.id===1004&&failProvider)throw new IdeaImageError('AI pictures are busy right now. Please try again later.',429);return picture;};
const api=createIdeaImageHandlers({account:async()=>({owner:'browser-test-owner',ideas:accountState.generated||[],store,takeSlot:async()=>true}),licensed:async()=>null,generate});
let assertions=0;const check=(condition,message)=>{assert.ok(condition,message);assertions++;};
try{
 await prepareIdeaImageBatch(initial,'browser-test-owner',store,generate);
 for(let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}if(server.exitCode!==null)throw Error(output);await delay(100);if(n===99)throw Error('Production server did not start: '+output);}
 browser=await chromium.launch(launch);
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC'}),page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base)return route.abort();
  if(url.pathname==='/api/account'){
   if(request.method()==='PUT'){const input=request.postDataJSON();await delay(180);accountState=input.state;revision++;return route.fulfill({json:{revision}});}
   return route.fulfill({json:{user:{email:'browser-test@example.invalid',name:''},state:accountState,revision,signIn:'/signin'}});
  }
  if(url.pathname==='/api/ideas'){if(request.method()==='POST'){await prepareIdeaImageBatch(batch,'browser-test-owner',store,generate);return route.fulfill({json:{ideas:batch}});}return route.fulfill({json:{available:true}});}
  if(url.pathname==='/api/idea-image'){
   if(Number(url.searchParams.get('id'))>=1000)attempts.push({id:Number(url.searchParams.get('id')),method:request.method(),saved:(accountState.generated||[]).some(i=>i.id===Number(url.searchParams.get('id')))});
   if(url.searchParams.get('image')==='1'&&Number(url.searchParams.get('id'))===1003&&failDownload){failDownload=false;return route.fulfill({status:503,body:'Image download fixture failure'});}
   const req=new Request(request.url(),{method:request.method(),headers:request.headers()}),response=await api[request.method()](req);
   return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  }
  if(url.pathname==='/api/photos')return route.fulfill({json:{photos:[]}});
  const response=await fetch(request.url(),{method:request.method()});
  const headers=Object.fromEntries([...response.headers].filter(([name])=>!['content-encoding','content-length','transfer-encoding'].includes(name)));
  return route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
 });
 await page.goto(base+'/#moves');await page.getByRole('searchbox',{name:'Search ideas'}).fill('Image test');
 await page.getByRole('button',{name:'Card grid',exact:true}).click();
 await page.locator('.move-idea-card').filter({hasText:'A familiar walk'}).getByRole('button',{name:'Retry picture'}).waitFor();
 check(initial.every(i=>generation.get(i.id)===1),'Every idea in the initial AI batch prepared exactly one picture');
 const runCard=page.locator('.move-idea-card').filter({hasText:'A short run'});
 await runCard.getByRole('button',{name:'Retry picture'}).click();
 await runCard.locator('img.generated-idea-picture').waitFor();
 check(generation.get(1003)===1,'A failed download retries the cached image, not the model');
 failProvider=false;
 await page.locator('.move-idea-card').filter({hasText:'A familiar walk'}).getByRole('button',{name:'Retry picture'}).click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.moves-card-list img.generated-idea-picture')].filter(i=>i.complete&&i.naturalWidth>0).length===4);
 check(generation.get(1004)===2,'A provider error recovers only after an explicit retry');
 await page.screenshot({path:resolve(results,'desktop-generated-card-grid.png'),fullPage:true});
 await page.getByRole('button',{name:'Explore Image test · Taking the stairs',exact:true}).click();
 await page.locator('.move-card img.generated-idea-picture').waitFor();
 const cardSource=await page.locator('.move-card img.generated-idea-picture').getAttribute('src');
 check(await page.locator('.move-card').evaluate((element,source)=>getComputedStyle(element).backgroundImage.includes(source),cardSource),'Detailed browser uses the same generated image');
 check(generation.get(1002)===1,'Card-to-detail navigation does not regenerate');
 await page.getByRole('button',{name:'Save this idea',exact:true}).click();
 await page.getByRole('button',{name:'Back to all ideas',exact:true}).click();
 await page.getByRole('button',{name:/^Saved(?: \(\d+\))?$/}).click();
 await page.getByRole('heading',{name:'Image test · Taking the stairs',exact:true}).waitFor();
 check(true,'Saved navigation retains the idea');
 await page.getByRole('button',{name:'Planned',exact:true}).click();
 await page.getByRole('button',{name:'Explore',exact:true}).click();
 await page.getByRole('button',{name:'Generate fresh ideas',exact:true}).click();
 for(let n=0;n<100&&!batch.every(i=>generation.get(i.id)===1);n++)await delay(100);
 check(batch.every(i=>generation.get(i.id)===1),'All ten fresh ideas generate pictures, including cards outside the visible eight');
 await page.getByRole('searchbox',{name:'Search ideas'}).fill('Image test');
 // Provider calls start before the batch response and cloud-save acknowledgement.
 // Wait for the actual UI update, rather than racing the batch with a count().
 const more=page.getByRole('button',{name:'Show more ideas',exact:true});await more.waitFor();await more.click();
 await page.waitForFunction(()=>[...document.querySelectorAll('.moves-card-list img.generated-idea-picture')].filter(i=>i.complete&&i.naturalWidth>0).length===14);
 check(batch.every(i=>attempts.some(a=>a.id===i.id))&&attempts.every(a=>a.saved),'Every fresh picture is read only after its cloud-save acknowledgement');
 check(attempts.filter(a=>a.method==='POST').length===2,'Only the two explicit retry clicks POST image requests');
 await page.getByRole('button',{name:'Card grid',exact:true}).click();
 const desktop=await page.locator('.moves-card-list img.generated-idea-picture').evaluateAll(images=>images.map(image=>({width:image.getBoundingClientRect().width,naturalWidth:image.naturalWidth,fit:getComputedStyle(image).objectFit})));
 check(desktop.every(i=>i.width>100&&i.naturalWidth===1536&&i.fit==='cover'),'Desktop cards display decoded landscape pictures');
 await page.setViewportSize({width:390,height:844});
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'390px mobile has no horizontal page overflow');
 check(await page.locator('.moves-card-list img.generated-idea-picture').evaluateAll(images=>images.every(image=>image.getBoundingClientRect().width>200&&getComputedStyle(image).objectFit==='cover')),'Mobile images fill their cards');
 await page.locator('.move-idea-card').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(results,'mobile-generated-card-grid.png')});
 await page.getByRole('button',{name:'Card row',exact:true}).click();
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile card row scrolls within its rail, not the page');
 await page.locator('.move-idea-card').first().scrollIntoViewIfNeeded();
 await page.screenshot({path:resolve(results,'mobile-generated-card-row.png')});
 const counts=Object.fromEntries(generation);await page.reload();await page.getByRole('searchbox',{name:'Search ideas'}).fill('Image test');
 await page.waitForFunction(()=>document.querySelectorAll('.moves-card-list img.generated-idea-picture').length===8);
 await delay(400);check(JSON.stringify(Object.fromEntries(generation))===JSON.stringify(counts),'Reload reuses private cached pictures');
 check(errors.length===0,'No React/browser JavaScript errors');
 await context.close();
 // Some constrained serverless Chromium builds use --single-process, which
 // exits when its last context closes. Use a clean browser for the guest check.
 await browser.close();browser=await chromium.launch(launch);
 const guestContext=await browser.newContext(),guest=await guestContext.newPage();let guestImageCalls=0;
 await guest.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:STORAGE_KEY,state});
 await guest.route('**/*',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/account')return route.fulfill({json:{user:null,state:null,revision:0,signIn:'/signin'}});if(url.pathname==='/api/ideas')return route.fulfill({json:{available:true}});if(url.pathname==='/api/idea-image'){if(Number(url.searchParams.get('id'))>=1000)guestImageCalls++;return route.fulfill({status:404,json:{error:'No picture fixture'}});}if(url.origin!==base)return route.abort();const response=await fetch(route.request().url());return route.fulfill({status:response.status,headers:Object.fromEntries([...response.headers].filter(([n])=>!['content-encoding','content-length','transfer-encoding'].includes(n))),body:Buffer.from(await response.arrayBuffer())});});
 await guest.goto(base+'/#moves');await guest.getByRole('searchbox',{name:'Search ideas'}).fill('Image test');await delay(500);check(await guest.locator('.move-idea-card').count()===4,'Signed-out fixture restores its AI ideas without cloud access');
 check(guestImageCalls===0,'A signed-out profile does not request private AI pictures');
 await guestContext.close();
 console.log(JSON.stringify({passed:true,assertions,desktop:'1440×1000',mobile:'390×844',freshBatch:10,pictures:14,providerAndAuth:'FIXTURES',browserErrors:errors,results},null,2));
}catch(error){if(browser){const pages=browser.contexts().flatMap(c=>c.pages());if(pages[0]){await pages[0].screenshot({path:resolve(results,'failure.png'),fullPage:true}).catch(()=>{});console.error((await pages[0].locator('body').innerText()).slice(0,6000));}}throw error;}
finally{await browser?.close();server.kill('SIGTERM');}
