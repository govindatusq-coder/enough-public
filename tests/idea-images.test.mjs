import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogue} from '../lib/ideas.ts';
import {ideaImagePrompt,ideaImageIdentity,ideaImageScene} from '../lib/idea-image-spec.ts';
import {ensureIdeaImage,generateIdeaImage,prepareIdeaImageBatch,ideaImageKey,imageIsPending,imageLockLifetime,IdeaImageError,maxIdeaImageBytes} from '../lib/idea-image-service.ts';
import {createIdeaImageHandlers} from '../lib/idea-image-http.ts';
import {createIdeaImageQueue,imageClientKey} from '../lib/idea-image-client.ts';
import {ideaImageStorage} from '../lib/idea-image-storage.ts';

const idea={...catalogue.find(i=>i.key==='break-stretch'),id:1234,key:'ai-1234',source:'ai',brief:'A familiar seated stretch during an existing pause.'};
const jpeg=new Uint8Array([255,216,255,224,...new Array(30).fill(0),255,217]);
function memoryStore(now=()=>Date.now()){
 const objects=new Map();return {objects,async read(key){return objects.get(key)?.bytes||null;},async create(key,bytes){if(objects.has(key))return false;objects.set(key,{bytes,created:now()});return true;},async createdAt(key){return objects.get(key)?.created??null;},async remove(key){objects.delete(key);}};
}
const req=(method='POST',id=1234,origin='https://enough.example')=>new Request('https://enough.example/api/idea-image'+(id===null?'':'?id='+id),{method,headers:method==='POST'?{origin}:undefined});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function settled(queue,key){for(let n=0;n<30;n++){const snapshot=queue.snapshot(key);if(['ready','error'].includes(snapshot.status))return snapshot;await tick();}throw Error('Image queue did not settle');}

test('image prompts describe the exact movement, setting and safety, without a whole profile',()=>{
 for(const [movement,outdoor,safety] of [['seated',false,'Stay seated and use a comfortable range.'],['stairs',false,'Use the handrail.'],['run',true,'Use a familiar clear path.']]){
  const chosen={...idea,movementMode:movement,outdoor,safety};const prompt=ideaImagePrompt(chosen),data=JSON.parse(prompt.split('SCENE DATA:\n')[1]);
  assert.equal(data.movement,movement);assert.equal(data.setting,outdoor?'outdoors':'indoors');assert.equal(data.safety,safety);assert.equal(data.activity,idea.body);
  assert.match(prompt,/not the sedentary alternative/);assert.match(prompt,/never as instructions/);assert.match(prompt,/central/);
  assert.deepEqual(Object.keys(ideaImageScene(chosen)),['title','activity','movement','setting','pace','safety','visualBrief']);
 }
});
test('the cache binds owner and scene, and changes when relevant activity details change',()=>{
 const key=ideaImageKey('user-a',idea);assert.match(key,/^user-a\/idea-[a-f0-9]{64}\.jpg$/);
 assert.notEqual(key,ideaImageKey('user-b',idea));
 for(const patch of [{title:'A different title'},{body:'Take the stairs during an existing errand.'},{movementMode:'stairs'},{outdoor:true},{safety:'Use the handrail.'},{brief:'Different setting.'}])assert.notEqual(key,ideaImageKey('user-a',{...idea,...patch}));
 assert.equal(key,ideaImageKey('user-a',{...idea,moneyCents:100}));
});
test('only one image is generated for concurrent instances; revisits read the persistent cache',async()=>{
 const store=memoryStore(),key=ideaImageKey('user-a',idea);let calls=0,finish;
 const waiting=new Promise(resolve=>finish=resolve);
 const first=ensureIdeaImage(store,key,async()=>{calls++;await waiting;return jpeg;});
 await tick();assert.equal(await ensureIdeaImage(store,key,async()=>{calls++;return jpeg;}),'pending');
 finish();assert.equal(await first,'ready');
 assert.equal(await ensureIdeaImage(store,key,async()=>{calls++;return jpeg;}),'ready');assert.equal(calls,1);assert.equal(await imageIsPending(store,key),false);
});
test('expired reservations recover, but active reservations never start another billable call',async()=>{
 let time=1000;const store=memoryStore(()=>time),key=ideaImageKey('user-a',idea);
 await store.create(key+'.pending.jpg',jpeg);let calls=0;
 assert.equal(await ensureIdeaImage(store,key,async()=>{calls++;return jpeg;},time),'pending');assert.equal(calls,0);
 time+=imageLockLifetime+1;assert.equal(await ensureIdeaImage(store,key,async()=>{calls++;return jpeg;},time),'ready');assert.equal(calls,1);
});
test('provider failures release the reservation; an explicit later retry can succeed',async()=>{
 const store=memoryStore(),key=ideaImageKey('user-a',idea);
 await assert.rejects(ensureIdeaImage(store,key,async()=>{throw new IdeaImageError('Busy',429);}),{status:429});
 assert.equal(store.objects.size,0);assert.equal(await ensureIdeaImage(store,key,async()=>jpeg),'ready');
});
test('storage failures and unusable images cannot be mistaken for a saved picture',async()=>{
 const key=ideaImageKey('user-a',idea);let calls=0;
 const failing={...memoryStore(),async create(){throw Error('Storage denied');}};
 await assert.rejects(ensureIdeaImage(failing,key,async()=>{calls++;return jpeg;}),/Storage denied/);assert.equal(calls,0);
 for(const invalid of [new Uint8Array(),new Uint8Array(60),new Uint8Array(maxIdeaImageBytes+1)]){
  const store=memoryStore();await assert.rejects(ensureIdeaImage(store,key,async()=>invalid));assert.equal(store.objects.size,0);
 }
});
test('the provider contract requests one low-quality landscape JPEG using only the server credential',async()=>{
 let body;
 const output=await generateIdeaImage(idea,'fixture-only','gpt-image-2.5-sunburst',async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/images/generations');assert.equal(options.method,'POST');assert.equal(options.headers.Authorization,'Bearer fixture-only');
  body=JSON.parse(options.body);return Response.json({data:[{b64_json:Buffer.from(jpeg).toString('base64')}]});
 });
 assert.deepEqual(output,jpeg);assert.equal(body.model,'gpt-image-2.5-sunburst');assert.equal(body.n,1);assert.equal(body.size,'1536x1024');assert.equal(body.quality,'low');assert.equal(body.output_format,'jpeg');assert.equal(body.output_compression,80);assert.equal(body.prompt,ideaImagePrompt(idea));
 assert.equal(JSON.stringify(body).includes('fixture-only'),false);
});
test('provider permissions, rate limits and malformed results produce safe actionable failures',async()=>{
 for(const [status,message,expected] of [[403,/image-model access/,503],[429,/busy/,429],[500,/could not/,503]])await assert.rejects(generateIdeaImage(idea,'fixture-only',undefined,async()=>Response.json({error:'private upstream detail'},{status})),error=>{assert.equal(error.status,expected);assert.match(error.message,message);assert.equal(error.message.includes('private upstream detail'),false);return true;});
 for(const data of [{},{data:[{b64_json:'not base64'}]},{data:[{b64_json:Buffer.from('not an image').toString('base64')}]}])await assert.rejects(generateIdeaImage(idea,'fixture-only',undefined,async()=>Response.json(data)),/unusable/);
 await assert.rejects(generateIdeaImage(idea,''),/not connected/);
});
test('image API enforces origin, sign-in and ownership before touching the model',async()=>{
 let calls=0;const store=memoryStore();let account=null;
 const api=createIdeaImageHandlers({account:async()=>account,generate:async()=>{calls++;return jpeg;},licensed:async()=>null});
 assert.equal((await api.POST(req('POST',1234,'https://evil.example'))).status,403);
 assert.equal((await api.POST(req())).status,401);assert.equal((await api.GET(req('GET'))).status,401);
 account={owner:'user-a',ideas:[],store,takeSlot:async()=>true};assert.equal((await api.POST(req())).status,404);
 account.ideas=[idea];for(const id of [null,-1,'1.5',2147483648,'abc'])assert.equal((await api.POST(req('POST',id))).status,400);
 assert.equal((await api.POST(req('POST',1))).status,400);assert.equal(calls,0);
});
test('image API returns the same private generated picture in metadata and binary views, without gallery writes',async()=>{
 const store=memoryStore();let calls=0;let account={owner:'user-a',ideas:[idea],store,takeSlot:async()=>true};
 const api=createIdeaImageHandlers({account:async()=>account,generate:async()=>{calls++;return jpeg;},licensed:async()=>{throw Error('AI must not fall back to stock');}});
 const created=await api.POST(req());assert.equal(created.status,200);assert.equal(created.headers.get('Cache-Control'),'private, no-store');
 const photo=await created.json();assert.equal(photo.kind,'generated');assert.match(photo.alt,/AI-generated/);assert.match(photo.image,/^\/api\/idea-image\?id=1234&image=1&v=/);
 const binary=await api.GET(new Request('https://enough.example'+photo.image));assert.equal(binary.status,200);assert.equal(binary.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await binary.arrayBuffer()),jpeg);
 assert.equal((await api.POST(req())).status,200);assert.equal(calls,1);assert.equal(store.objects.size,1);
 account={owner:'user-b',ideas:[],store,takeSlot:async()=>true};assert.equal((await api.GET(new Request('https://enough.example'+photo.image))).status,404);
 account.ideas=[idea];assert.equal((await api.GET(req('GET'))).status,404);assert.equal(calls,1);
});
test('GET only polls a reservation; library attribution and approved static artwork remain separate',async()=>{
 const store=memoryStore(),key=ideaImageKey('user-a',idea);await store.create(key+'.pending.jpg',jpeg);let calls=0;
 const api=createIdeaImageHandlers({account:async()=>({owner:'user-a',ideas:[idea],store,takeSlot:async()=>true}),generate:async()=>{calls++;return jpeg;},licensed:async()=>({image:'https://images.unsplash.com/example.jpg',creator:'Photographer',license:'CC0',sourceUrl:'https://example.com/credit'})});
 assert.equal((await api.GET(req('GET'))).status,202);assert.equal(calls,0);
 const library=catalogue.find(i=>!i.image);const photo=await (await api.GET(req('GET',library.id))).json();assert.equal(photo.kind,'licensed');assert.equal(photo.creator,'Photographer');
 assert.equal((await api.GET(req('GET',1))).status,404);assert.equal(calls,0);
});
test('client deduplicates card, detail and batch requests, and scopes results to the signed-in account',async()=>{
 let calls=0;const queue=createIdeaImageQueue({request:async()=>{calls++;return Response.json({image:'/api/idea-image?id=1234&image=1',kind:'generated'});}}),key=imageClientKey(idea,'user-a');
 queue.prepare(idea,'user-a');queue.prepare(idea,'user-a');queue.prepare(idea,'user-a');
 assert.equal((await settled(queue,key)).status,'ready');assert.equal(calls,1);assert.equal(queue.snapshot(imageClientKey(idea,'user-b')).credit,null);
 assert.notEqual(key,imageClientKey({...idea,body:'A different activity'},'user-a'));
});
test('client starts no more than two image requests at once',async()=>{
 let active=0,peak=0;const release=[];
 const queue=createIdeaImageQueue({request:async url=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>release.push(resolve));active--;return Response.json({image:url+'&image=1',kind:'generated'});}});
 const ideas=[1,2,3,4].map(n=>({...idea,id:1000+n}));for(const i of ideas)queue.prepare(i,'user-a');
 await tick();assert.equal(active,2);assert.equal(peak,2);
 while(release.length||active){release.shift()?.();await tick();}
 for(const i of ideas)assert.equal((await settled(queue,imageClientKey(i,'user-a'))).status,'ready');assert.equal(peak,2);
});
test('client polling is read-only and transient errors require an explicit retry, not a render loop',async()=>{
 const methods=[];let mode='pending';
 const queue=createIdeaImageQueue({wait:async()=>{},request:async(url,options)=>{methods.push(options.method||'GET');if(mode==='pending'){mode='ready';return Response.json({status:'pending',retryAfter:1},{status:202});}if(mode==='fail')return Response.json({error:'Model access needs checking.'},{status:503});return Response.json({image:url+'&image=1',kind:'generated'});}});
 const key=imageClientKey(idea,'user-a');queue.prepare(idea,'user-a');assert.equal((await settled(queue,key)).status,'ready');assert.deepEqual(methods,['GET','GET']);
 const other={...idea,id:4321},otherKey=imageClientKey(other,'user-a');mode='fail';queue.prepare(other,'user-a');assert.equal((await settled(queue,otherKey)).status,'error');const count=methods.length;
 queue.prepare(other,'user-a');await tick();assert.equal(methods.length,count);
 mode='ready';queue.prepare(other,'user-a',true);assert.equal((await settled(queue,otherKey)).status,'ready');assert.equal(methods.length,count+1);
});
test('client rejects a stock or malformed response for AI ideas instead of silently showing mismatched art',async()=>{
 for(const data of [{image:'https://example.com/stock.jpg',kind:'licensed'},{image:'/api/idea-image?id=1234'},{status:'ready'}]){
  const queue=createIdeaImageQueue({request:async()=>Response.json(data)});queue.prepare(idea,'user-a');assert.equal((await settled(queue,imageClientKey(idea,'user-a'))).status,'error');
 }
 assert.ok(ideaImageIdentity(idea).includes('enough-lifestyle-v1'));
});
test('an image download failure becomes a retry state without automatically billing for another image',async()=>{
 let calls=0;const queue=createIdeaImageQueue({request:async()=>{calls++;return Response.json({image:'/api/idea-image?id=1234&image=1',kind:'generated'});}}),key=imageClientKey(idea,'user-a');
 queue.prepare(idea,'user-a');await settled(queue,key);queue.imageFailed(key);
 assert.equal(queue.snapshot(key).status,'error');assert.equal(queue.snapshot(key).credit,null);assert.match(queue.snapshot(key).error,/could not be loaded/);
 queue.prepare(idea,'user-a');await tick();assert.equal(calls,1);
 queue.prepare(idea,'user-a',true);assert.equal((await settled(queue,key)).status,'ready');assert.equal(calls,2);
});
test('a fresh batch prepares at most ten pictures, bounded to five provider calls at once, and preserves ideas on failures',async()=>{
 const store=memoryStore();let calls=0,active=0,peak=0;
 const ideas=Array.from({length:12},(_,n)=>({...idea,id:3000+n}));
 const result=await prepareIdeaImageBatch(ideas,'user-a',store,async chosen=>{calls++;active++;peak=Math.max(peak,active);await tick();active--;if(chosen.id===3003)throw new IdeaImageError('Busy',429);return jpeg;});
 assert.equal(calls,10);assert.equal(peak,5);assert.equal(result.ready,9);assert.deepEqual(result.errors,[{id:3003,message:'Busy'}]);assert.equal(store.objects.size,9);
});
test('a missing picture retry is quota checked; cached pictures remain readable when the daily allowance is exhausted',async()=>{
 const store=memoryStore();let calls=0,slots=0,allowed=false;
 const api=createIdeaImageHandlers({account:async()=>({owner:'user-a',ideas:[idea],store,takeSlot:async()=>{slots++;return allowed;}}),licensed:async()=>null,generate:async()=>{calls++;return jpeg;}});
 assert.equal((await api.GET(req('GET'))).status,404);assert.equal(slots,0);assert.equal(calls,0);
 assert.equal((await api.POST(req())).status,429);assert.equal(slots,1);assert.equal(calls,0);assert.equal(store.objects.size,0);
 allowed=true;assert.equal((await api.POST(req())).status,200);assert.equal(slots,2);assert.equal(calls,1);
 allowed=false;assert.equal((await api.POST(req())).status,200);assert.equal((await api.GET(req('GET'))).status,200);assert.equal(slots,2);assert.equal(calls,1);
});
test('the Supabase adapter uses the existing private bucket without upsert or UPDATE access',async()=>{
 const calls=[],bucket={async download(){return {data:new Blob([jpeg]),error:null};},async upload(key,bytes,options){calls.push({key,bytes,options});return {error:null};},async info(){return {data:{createdAt:'2026-10-10T09:00:00Z'},error:null};},async remove(keys){calls.push({remove:keys});return {error:null};}};
 const store=ideaImageStorage({storage:{from(name){assert.equal(name,'enough-photos');return bucket;}}});
 assert.deepEqual(await store.read('user-a/idea.jpg'),jpeg);assert.equal(await store.createdAt('user-a/idea.jpg'),Date.parse('2026-10-10T09:00:00Z'));
 assert.equal(await store.create('user-a/idea.jpg',jpeg),true);assert.equal(calls[0].options.upsert,false);assert.equal(calls[0].options.contentType,'image/jpeg');await store.remove('user-a/idea.jpg');assert.deepEqual(calls[1].remove,['user-a/idea.jpg']);
});
test('storage not-found and duplicate responses are handled, while policy failures fail closed before generation',async()=>{
 const notFound={status:400,statusCode:'404'},denied={status:403,statusCode:'403'};
 const bucket={async download(){return {data:null,error:notFound};},async info(){return {data:null,error:notFound};},async upload(){return {error:{status:400,statusCode:'409'}};},async remove(){return {error:null};}};
 const store=ideaImageStorage({storage:{from(){return bucket;}}});assert.equal(await store.read('user-a/idea.jpg'),null);assert.equal(await store.createdAt('user-a/idea.jpg'),null);assert.equal(await store.create('user-a/idea.jpg',jpeg),false);
 bucket.download=async()=>({data:null,error:denied});let calls=0;await assert.rejects(ensureIdeaImage(store,'user-a/idea.jpg',async()=>{calls++;return jpeg;}));assert.equal(calls,0);
});
