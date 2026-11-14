import {HttpError,json,withBear} from '@/lib/bear/server/context';
import {captureTextSchema,createCapture,MAX_FILE_BYTES} from '@/lib/bear/services/capture';
import {maybeAutoSetup} from '@/lib/bear/services/auto-setup';
import {intake} from '@/lib/bear/services/intake';
import {replyKind} from '@/lib/bear/services/sorter';
import {adoptSorted,keptNote,linkNote,looksLikeDocument,lookUp,placePage,placeSorted,readLink,sortParts,todayFor} from '@/lib/bear/services/sort-service';
import {asksToFindOut,linkIn} from '@/lib/bear/services/lookup';
import {keepOnPage,readPageEvents} from '@/lib/bear/services/page-events';
import {updateTask} from '@/lib/bear/services/task-edit';
import {pageReaderFromEnv,researcherFromEnv} from '@/lib/bear/ai/web-lookup';
import {isBrainDump,setupBrainDump} from '@/lib/bear/services/dump';
import type {BearStore} from '@/lib/bear/store/store';
import type {StructuredModelProvider} from '@/lib/bear/ai/provider';
import type {ExtractedEntity} from '@/lib/bear/domain/types';
// Non-bill captures Bear understood are set up straight away; anything else goes to verification.
async function withAuto<T extends {extraction:ExtractedEntity;capture:{id:string}}>(store:BearStore,provider:StructuredModelProvider|null,result:T,ctx:{text:string|null;hasFile:boolean}={text:null,hasFile:true}){
 // First: is this a receipt for something Bear tracks, a message that asks nothing, or too thin to act on? (Never a silent drop:
 // the person is told, and can keep it anyway.)
 const verdict=await intake(store,ctx.text,ctx.hasFile,new Date()).catch(()=>({kind:'proceed'} as const));
 if(verdict.kind==='confirmed'){await store.update('extractions',result.extraction.id,{status:'verified'});await store.update('captures',result.capture.id,{status:'verified'});return {...result,confirmed:{taskId:verdict.taskId,title:verdict.title,evidence:verdict.evidence}};}
 if(verdict.kind==='info'||verdict.kind==='unclear'){await store.update('captures',result.capture.id,{status:'rejected'});return verdict.kind==='info'?{...result,info:{captureId:result.capture.id,receipt:verdict.receipt}}:{...result,unclear:true};}
 // A page of projects (a brain dump) is filed as projects with their to-dos, then lined up together.
 if(result.extraction.kind==='task'&&isBrainDump(result.extraction.general))return {...result,dump:await setupBrainDump(store,result.extraction)};
 const auto=await maybeAutoSetup(store,result.extraction,new Date(),provider).catch(()=>null);return auto?{...result,auto:{taskId:auto.task.id,title:auto.task.title,area:auto.area,planned:auto.planned,dueAt:auto.task.dueAt,merged:!!auto.merged}}:result;}
export const dynamic='force-dynamic';
export const maxDuration=120;
const MAX_PAGE_FILES=6;
// A generous daily limit per person, so a bug, a loop or misuse can't run up the AI bill. Real use is a handful a day.
const DAILY_CAPTURE_LIMIT=60;
async function checkDailyLimit(store:BearStore){
 const since=Date.now()-24*3600000;const n=(await store.list('captures')).filter(c=>Date.parse(c.createdAt)>=since).length;
 if(n>=DAILY_CAPTURE_LIMIT)throw new HttpError('That’s a lot for one day. Bear will take more tomorrow, or you can wait a few hours and try again.',429);
}
// Accepts JSON {method,text} or multipart form-data with `file` (+ optional `method`, `text`).
export const POST=(req:Request)=>withBear(req,async({store,provider})=>{
 await checkDailyLimit(store);
 const type=req.headers.get('content-type')||'';
 if(type.includes('multipart/form-data')){
  const form=await req.formData();const file=form.get('file');const method=String(form.get('method')||'upload');const text=form.get('text');
  if(!(file instanceof File))throw new HttpError('Choose a picture or PDF first.',400);
  if(file.size>MAX_FILE_BYTES)throw new HttpError('That file is bigger than 10 MB. Try a screenshot or a smaller photo.',413);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const mime=file.type||'application/octet-stream';const note=typeof text==='string'&&text.trim()?text:null;
  // While Bear reads the page the usual way, it also lists every separate event on it (a calendar, a newsletter, a fixtures
  // list is many things, not one). The two run side by side so the person does not wait twice.
  const {today,children}=await todayFor(store);
  // Several pictures given together are one long page (screenshots of the same notice): they are read as a whole.
  const extra:{mime:string;bytes:Uint8Array}[]=[];
  for(const f of form.getAll('file').slice(1,MAX_PAGE_FILES)){if(!(f instanceof File))continue;if(f.size>MAX_FILE_BYTES)throw new HttpError('One of those files is bigger than 10 MB. Try smaller screenshots.',413);extra.push({mime:f.type||'application/octet-stream',bytes:new Uint8Array(await f.arrayBuffer())});}
  const all=[{mime,bytes},...extra];
  const pageInput={text:note,images:all.filter(f=>f.mime.startsWith('image/')),documents:all.filter(f=>f.mime==='application/pdf')};
  const [result,listed]=await Promise.all([
   createCapture(store,provider,{method:(['photo','screenshot','upload','email'] as const).includes(method as 'photo')?method as 'photo'|'screenshot'|'upload'|'email':'upload',text:note,file:{bytes,mime,name:file.name||'bill'}}),
   provider?readPageEvents(provider,pageInput,today):Promise.resolve([]),
  ]);
  const events=result.extraction.kind==='bill'?[]:keepOnPage(listed,result.extraction.sourceText);
  if(events.length>=2||(extra.length>0&&events.length>=1)){
   const sorted=await placePage(store,events,today,children);
   if(sorted.some(i=>i.taskId)){
    // The page has been dealt with as its separate events; it is not also filed as one big item.
    await store.update('extractions',result.extraction.id,{status:'verified'}).catch(()=>null);await store.update('captures',result.capture.id,{status:'verified'}).catch(()=>null);
    return json({sorted,page:{events:events.length,undated:events.filter(e=>!e.date&&!e.actionDue).length}},201);
   }
  }
  const single=await withAuto(store,provider,result,{text:note,hasFile:true}) as Record<string,unknown>&{auto?:{taskId:string;dueAt:string|null}};
  // One thing on the page: if the usual reading found no date and the page listing did, the date is taken.
  if(single.auto&&!single.auto.dueAt&&events.length===1){const day=events[0].actionDue||events[0].date;if(day&&day>=today){await updateTask(store,single.auto.taskId,{dueAt:day}).catch(()=>null);single.auto={...single.auto,dueAt:day};}}
  return json(single,201);
 }
 const raw=await req.text();if(new TextEncoder().encode(raw).length>64*1024)throw new HttpError('That is a lot of text. Paste just the bill.',413);
 let body;try{body=captureTextSchema.parse(JSON.parse(raw));}catch{throw new HttpError('Tell Bear something first.',400);}
 // A link: Bear reads the page behind it and lists what is on it, so nobody has to screenshot a long page piece by piece.
 const link=(body.method==='text'||body.method==='voice')&&!body.isDemo?linkIn(body.text):null;
 if(link){
  const {today,children}=await todayFor(store);const read=await readLink(store,pageReaderFromEnv(),link,today);
  if(read.events.length){
   const sorted=await placePage(store,read.events,today,children);
   if(sorted.length)return json({sorted,page:{events:read.events.length,undated:read.events.filter(e=>!e.date&&!e.actionDue).length}},201);
   return json({say:'Everything on that page is already past, so there is nothing to add.'});
  }
  return json({say:linkNote(read.why)||'I couldn’t read that page.'});
 }
 // Typed or spoken: Bear sorts it. One message can hold several responsibilities; each gets a clear title, one of the six
 // areas, a traffic light and a timeframe. Pasted documents (emails, notices) keep to the ordinary reading below.
 if((body.method==='text'||body.method==='voice')&&!body.isDemo&&!looksLikeDocument(body.text)){
  // Something said back to Bear ("no", "that's all", "thanks", "yes") is conversation, never a to-do. Nothing is saved.
  const chat=replyKind(body.text);if(chat)return json({chat,unclear:true});
  const {today,children}=await todayFor(store);const parts=await sortParts(body.text,provider,today,children);
  // "Search for…", "find out when…": Bear looks it up and answers. Nothing is filed for the person unless the lookup comes
  // back empty, in which case the to-do is kept and Bear says why.
  const researcher=researcherFromEnv();
  if(parts.length>1){
   const sorted=[];const found=[];
   for(const p of parts){
    const look=asksToFindOut(p.original,children)?await lookUp(store,researcher,p.original,today):null;
    if(look?.found){found.push(look.found);continue;}
    const item=await placeSorted(store,p,body.method,today);sorted.push(look?{...item,nextAction:keptNote(look.why)||item.nextAction}:item);
   }
   return json({sorted,found},201);
  }
  const look=asksToFindOut(body.text,children)?await lookUp(store,researcher,body.text,today):null;
  if(look?.found)return json({sorted:[],found:[look.found]},201);
  // One thing: the usual path first, so receipts, plain information, bills and school notices are still handled as they were.
  const result=await withAuto(store,provider,await createCapture(store,provider,{method:body.method,text:body.text}),{text:body.text,hasFile:false}) as Record<string,unknown>&{auto?:{taskId:string};extraction:{school?:unknown;kind:string;general:{kind:string;items?:unknown[]}}};
  if(!result.auto)return json(result,201);
  // Lists and school notices were named by the readers built for them: their titles, dates and areas stand.
  const plain=!result.extraction.school&&result.extraction.general.kind!=='shopping'&&!(result.extraction.general.items?.length);
  const item=await adoptSorted(store,result.auto.taskId,parts[0],body.method,today,plain).catch(()=>null);
  return json(item?{...result,sorted:[look?{...item,nextAction:keptNote(look.why)||item.nextAction}:item]}:result,201);
 }
 // A pasted notice or email with several dated things on it is taken the same way as a photographed page.
 if(provider&&!body.isDemo&&looksLikeDocument(body.text)){
  const {today,children}=await todayFor(store);const events=await readPageEvents(provider,{text:body.text,images:[],documents:[]},today,body.text);
  if(events.length>=2){const sorted=await placePage(store,events,today,children);if(sorted.some(i=>i.taskId))return json({sorted,page:{events:events.length,undated:events.filter(e=>!e.date&&!e.actionDue).length}},201);}
 }
 return json(await withAuto(store,provider,await createCapture(store,provider,{method:body.method,text:body.text,isDemo:body.isDemo}),{text:body.text,hasFile:false}),201);
});
