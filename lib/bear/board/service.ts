// Brain Dump Board: storage side. Unload, see, sort, share, do. Any step can be the last one; nothing is lost between them.
import {z} from 'zod';
import {todayISO} from '../domain/dates.ts';
import type {Area,AreaKey,Capture,Project,Task} from '../domain/types.ts';
import {areaLabels} from '../domain/labels.ts';
import {understand} from '../load/engine.ts';
import {newId,stamp,type BearStore} from '../store/store.ts';
import type {StructuredModelProvider} from '../ai/provider.ts';
import {caps} from '../services/load.ts';
import {ensureProfile} from '../services/profile.ts';
import {sortParts,ensureReminder} from '../services/sort-service.ts';
import {sortOne,type Sorted} from '../services/sorter.ts';
import {LIST_ICONS,learnChoice,listsOf,minutesFor,readinessOf,suggestList,type BearList,type Readiness} from './logic.ts';

export interface BoardTask{id:string;title:string;listId:string|null;rank:number;dueAt:string|null;dueTime:string|null;light:'red'|'amber'|'green'|null;minutes:number;readiness:Readiness;suggestion:{listId:string;by:'bear'|'learned'}|null;notes:string|null;hasWork:boolean;shared:{mode:string;who:string;direction:'out'|'in'}|null;isBill:boolean;createdAt:string}
export interface BoardView{name:string;lists:BearList[];inbox:BoardTask[];byList:Record<string,BoardTask[]>;resume:{taskId:string;title:string;next:string|null;savedAt:string}|null;doneToday:{id:string;title:string}[];timeZone:string}

const MAX_ITEMS=40;
const tz=async(store:BearStore)=>(await ensureProfile(store)).lifeRhythm.timezone||'Australia/Sydney';

// Every open thing the person is carrying shows somewhere: in a list of theirs, or in the Brain Dump.
// Steps that belong to a bigger task, wishlist items and things handed over for good stay out of the way.
export async function openTasks(store:BearStore):Promise<Task[]>{
 const open=await store.list('tasks',{where:[{column:'status',value:'open'}]});
 const deps=await store.list('task_dependencies');const steps=new Set(deps.map(d=>d.dependsOnTaskId));
 return open.filter(t=>!t.isDemo&&!t.wishlist&&!t.part&&!steps.has(t.id));
}
function view(t:Task,billIds:Set<string>,suggestFor:(title:string)=>{listId:string;by:'bear'|'learned'}|null):BoardTask{
 const sug=t.suggestion&&typeof t.suggestion==='object'&&typeof t.suggestion.listId==='string'?t.suggestion:t.suggestion===undefined?undefined:null;
 return {id:t.id,title:String(t.title||'Untitled'),listId:typeof t.listId==='string'?t.listId:null,rank:t.rank??Number.MAX_SAFE_INTEGER,dueAt:t.dueAt,dueTime:t.dueTime??null,light:(t.light&&typeof t.light==='object'?t.light.level:null)||t.sorted?.urgency||null,minutes:minutesFor(t),readiness:readinessOf(t),
  // Tasks from before lists existed have no suggestion stored (undefined): Bear works one out when it shows them.
  suggestion:t.listId?null:sug===undefined?suggestFor(String(t.title||'')):!sug||sug.ignored?null:{listId:sug.listId,by:sug.by==='learned'?'learned':'bear'},notes:t.notes??null,hasWork:!!(t.progress?.draft?.body||t.progress?.notes||t.progress?.steps?.length||t.prepared),
  shared:t.sharedOut?{mode:t.sharedOut.mode,who:t.sharedOut.to,direction:'out'}:t.sharedIn?{mode:t.sharedIn.mode,who:t.sharedIn.from,direction:'in'}:null,isBill:billIds.has(t.id),createdAt:String(t.createdAt||'')};
}
const byRank=(a:BoardTask,b:BoardTask)=>(a.rank-b.rank)||String(a.createdAt).localeCompare(String(b.createdAt));

export async function boardView(store:BearStore,now=new Date()):Promise<BoardView>{
 const profile=await ensureProfile(store);const lists=listsOf(profile);const ids=new Set(lists.map(l=>l.id));
 const tasks=await openTasks(store);
 const bills=new Set((await store.list('bills')).filter(b=>b.status!=='dropped'&&b.status!=='archived').map(b=>b.taskId));
 const inbox:BoardTask[]=[];const byList:Record<string,BoardTask[]>=Object.fromEntries(lists.map(l=>[l.id,[]]));
 for(const t of tasks){
  // Handed over for good and accepted: it lives on the Shared screen now, not on her lists.
  if(t.sharedOut?.mode==='transfer'&&t.readiness==='waiting')continue;
  // One odd record can never stop the whole board: it is shown plainly instead.
  let v:BoardTask;
  try{v=view(t,bills,title=>suggestList(title,lists,profile.listLearning));}
  catch{v={id:t.id,title:String(t.title||'Untitled'),listId:typeof t.listId==='string'?t.listId:null,rank:Number.MAX_SAFE_INTEGER,dueAt:typeof t.dueAt==='string'?t.dueAt:null,dueTime:null,light:null,minutes:15,readiness:'ready',suggestion:null,notes:null,hasWork:false,shared:null,isBill:bills.has(t.id),createdAt:String(t.createdAt||'')};}if(v.listId&&ids.has(v.listId))byList[v.listId].push(v);else inbox.push({...v,listId:null});
 }
 inbox.sort(byRank);for(const k of Object.keys(byList))byList[k].sort(byRank);
 const started=tasks.filter(t=>t.progress&&typeof t.progress.savedAt==='string'&&readinessOf(t)==='in_progress').sort((a,b)=>(b.progress!.savedAt).localeCompare(a.progress!.savedAt))[0];
 const since=new Date(now.getTime()-18*3600000).toISOString();
 let done:{id:string;title:string}[]=[];
 try{const doneToday=(await store.list('completions',{where:[{column:'completed_at',op:'gte',value:since}]})).slice(-8);
  done=(await Promise.all(doneToday.map(c=>store.get('tasks',c.taskId)))).filter((t):t is Task=>!!t&&t.status==='done').map(t=>({id:t.id,title:t.title}));}catch{/* the faded "done lately" list is optional */}
 return {name:profile.name||'',lists,inbox,byList,resume:started?{taskId:started.id,title:started.title,next:started.progress?.nextAction||null,savedAt:started.progress!.savedAt}:null,doneToday:done,timeZone:profile.lifeRhythm.timezone||'Australia/Sydney'};
}

// ---------- Unload ----------
async function ensureArea(store:BearStore,key:AreaKey){
 const area=(await store.list('areas',{where:[{column:'key',value:key}]}))[0];
 if(!area)await store.insert('areas',stamp<Area>(store.userId,{key,label:areaLabels[key],archived:false}));else if(area.archived)await store.update('areas',area.id,{archived:false});
 const profile=await ensureProfile(store);if(!profile.areas.includes(key))await store.update('profiles',profile.id,{areas:[...profile.areas,key]});
}
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
// Split a long dump into pieces the reader can take: by line, and long lines by sentence, ~900 characters at most.
export function chunksOf(text:string):string[]{
 const lines=text.split(/\n+/).map(l=>l.trim()).filter(Boolean).flatMap(l=>l.length>900?l.split(/(?<=[.!?])\s+/):[l]);
 const out:string[]=[];let cur='';
 for(const l of lines){if(cur&&(cur+'\n'+l).length>900){out.push(cur);cur=l;}else cur=cur?cur+'\n'+l:l;}
 if(cur)out.push(cur);return out;
}
async function createOne(store:BearStore,s:Sorted,dumpId:string|null,today:string,rank:number,listId:string|null,now:Date):Promise<Task>{
 const profile=await ensureProfile(store);
 await ensureArea(store,s.domain);
 const project=await store.insert('projects',stamp<Project>(store.userId,{areaKey:s.domain,title:s.title,status:'active',dueAt:null,resourceDocumentIds:[],billId:null,captureId:null,priority:null,order:rank}));
 const {graph}=understand({text:s.original,title:s.title,today,caps:caps(),loadMap:profile.loadMap,asTodo:true});
 const suggestion=listId?null:suggestList(s.title,listsOf(profile),profile.listLearning);
 const task=await store.insert('tasks',stamp<Task>(store.userId,{projectId:project.id,kind:'custom',title:s.title.slice(0,120),status:'open',dueAt:s.deadline,estimatedMinutes:15,cognitiveEffort:'low',forPerson:null,isDemo:false,setupBy:'bear',
  timing:s.deadline?'time_sensitive':'flexible',size:'one_go',load:graph,listId,rank,suggestion,dumpId,
  sorted:{originalInput:s.original,via:'text',secondaryDomains:s.secondary,urgency:s.urgency,deadlineSource:s.deadline?'stated':null,window:s.window,windowBy:s.windowBy,suggestedStart:s.suggestedStart,nextAction:s.nextAction,reason:s.reason}}));
 if(listId!=='aspire')await ensureReminder(store,task,now);
 return task;
}
export const dumpSchema=z.object({text:z.string().trim().min(1).max(12000),via:z.enum(['text','voice']).default('text')}).strict();
export interface DumpResult{dumpId:string;added:{id:string;title:string}[];already:{id:string;title:string}[];usedAI:boolean}
// The original words are kept first (as a capture), so even if reading them fails nothing is lost and it can be tried again.
export async function unload(store:BearStore,provider:StructuredModelProvider|null,input:z.infer<typeof dumpSchema>,now=new Date()):Promise<DumpResult>{
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const children=(profile.people||[]).filter(p=>p.role==='child').map(p=>p.name).filter(Boolean);
 const capture=await store.insert('captures',stamp<Capture>(store.userId,{method:input.via,status:'extracting',text:input.text,documentId:null,extractionId:null,error:null,isDemo:false}));
 try{
  let usedAI=false;const parts:Sorted[]=[];
  for(const chunk of chunksOf(input.text)){
   // Bear's own reading goes line by line (one thought per line is how most dumps arrive). The AI reads the whole piece and
   // is used only when it found at least as many things as there were lines, so it can split a line but never swallow one.
   const lines=chunk.split('\n').filter(l=>l.trim());
   const rules=(await Promise.all(lines.map(l=>sortParts(l,null,today,children)))).flat();
   let got=rules;
   if(provider&&chunk.length>=40){try{const ai=await sortParts(chunk,provider,today,children);if(ai.length>=lines.length&&ai.length>=rules.length*0.75){got=ai;usedAI=true;}}catch{/* Bear's own reading stands */}}
   parts.push(...got);if(parts.length>=MAX_ITEMS)break;
  }
  const open=await openTasks(store);const minRank=Math.min(0,...open.filter(t=>!t.listId).map(t=>t.rank??0));
  const added:DumpResult['added']=[],already:DumpResult['already']=[];const seen=new Set<string>();
  for(const [i,s] of parts.slice(0,MAX_ITEMS).entries()){
   const key=norm(s.title);if(!key)continue;
   // Told twice: said once more in the same dump, or already on her list. Shown as "already here", never merged silently.
   const same=open.find(t=>norm(t.title)===key);if(same){already.push({id:same.id,title:same.title});continue;}
   if(seen.has(key))continue;seen.add(key);
   const t=await createOne(store,s,capture.id,today,minRank-parts.length+i,null,now);added.push({id:t.id,title:t.title});
  }
  await store.update('captures',capture.id,{status:'verified'});
  return {dumpId:capture.id,added,already,usedAI};
 }catch(e){await store.update('captures',capture.id,{status:'failed',error:e instanceof Error?e.message.slice(0,300):'failed'}).catch(()=>null);throw e;}
}
// One thing typed straight into a list (or the Brain Dump). Works with no AI at all.
export const addSchema=z.object({title:z.string().trim().min(1).max(120),listId:z.string().max(60).nullable().default(null)}).strict();
export async function addOne(store:BearStore,input:z.infer<typeof addSchema>,now=new Date()){
 const profile=await ensureProfile(store);const today=todayISO(profile.lifeRhythm.timezone||'Australia/Sydney',now);
 const listId=input.listId&&listsOf(profile).some(l=>l.id===input.listId)?input.listId:null;
 const open=await openTasks(store);const ranks=open.filter(t=>(t.listId??null)===listId).map(t=>t.rank??0);
 const s=sortOne(input.title,today);
 return createOne(store,{...s,title:input.title},null,today,ranks.length?Math.max(...ranks)+1:0,listId,now);
}

// ---------- Sort ----------
export const moveSchema=z.object({listId:z.string().max(60).nullable(),index:z.number().int().min(0).max(10000).optional()}).strict();
// Move to a list (or back to the Brain Dump). The person's choice is recorded so later suggestions can follow it.
export async function moveTask(store:BearStore,taskId:string,input:z.infer<typeof moveSchema>,now=new Date()){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const profile=await ensureProfile(store);const lists=listsOf(profile);
 const listId=input.listId&&lists.some(l=>l.id===input.listId)?input.listId:null;
 const siblings=(await openTasks(store)).filter(t=>(t.listId??null)===listId&&t.id!==taskId).sort((a,b)=>((a.rank??0)-(b.rank??0))||a.createdAt.localeCompare(b.createdAt));
 const at=Math.min(input.index??siblings.length,siblings.length);siblings.splice(at,0,task);
 for(const [i,t] of siblings.entries())if(t.id!==taskId&&t.rank!==i)await store.update('tasks',t.id,{rank:i});
 const moved=await store.update('tasks',taskId,{listId,rank:at,...(listId?{suggestion:null}:{})});
 if(listId&&(task.listId??null)!==listId)await store.update('profiles',profile.id,{listLearning:learnChoice(profile.listLearning,task.title,listId,now.toISOString())});
 // Aspirational things are dreams, not deadlines: no reminders chase them.
 if(listId==='aspire')for(const r of await store.list('reminders',{where:[{column:'task_id',value:taskId},{column:'status',op:'in',value:['scheduled','snoozed']}]}))await store.update('reminders',r.id,{status:'cancelled'});
 return moved;
}
// "Bear sorts, you check": Bear's guesses go into the lists in one go, after she has looked them over. Ones she unticked stay
// in My Brain Dump and Bear stops suggesting them. Bear's own guesses are not recorded as her preferences (only her own
// choices teach it), so its rules can't reinforce themselves. Undo puts everything back as it was.
const id=z.string().uuid();
const sugSchema=z.object({listId:z.string().max(60),by:z.enum(['bear','learned']),ignored:z.boolean().optional()}).strict().nullable();
export const bulkSortSchema=z.object({moves:z.array(z.object({taskId:id,listId:z.string().min(1).max(60)}).strict()).max(200),skip:z.array(id).max(200).default([])}).strict();
export async function bulkSort(store:BearStore,input:z.infer<typeof bulkSortSchema>){
 const profile=await ensureProfile(store);const ids=new Set(listsOf(profile).map(l=>l.id));
 const open=await openTasks(store);const byId=new Map(open.map(t=>[t.id,t]));
 const next=new Map<string,number>();for(const t of open)if(t.listId)next.set(t.listId,Math.max(next.get(t.listId)??0,(t.rank??0)+1));
 const moved:{taskId:string;listId:string;suggestion:Task['suggestion']}[]=[];const skipped:{taskId:string;suggestion:Task['suggestion']}[]=[];
 for(const m of input.moves){
  const t=byId.get(m.taskId);if(!t||t.listId||!ids.has(m.listId))continue;
  const rank=next.get(m.listId)??0;next.set(m.listId,rank+1);
  await store.update('tasks',t.id,{listId:m.listId,rank,suggestion:null});moved.push({taskId:t.id,listId:m.listId,suggestion:t.suggestion??null});
  if(m.listId==='aspire')for(const r of await store.list('reminders',{where:[{column:'task_id',value:t.id},{column:'status',op:'in',value:['scheduled','snoozed']}]}))await store.update('reminders',r.id,{status:'cancelled'});
 }
 for(const tid of input.skip){const t=byId.get(tid);if(!t||t.listId)continue;const prev=t.suggestion??null;
  await store.update('tasks',t.id,{suggestion:prev?{...prev,ignored:true}:null});skipped.push({taskId:t.id,suggestion:prev});}
 return {moved,skipped};
}
export const unsortSchema=z.object({items:z.array(z.object({taskId:id,suggestion:sugSchema}).strict()).max(400)}).strict();
export async function unsort(store:BearStore,input:z.infer<typeof unsortSchema>,now=new Date()){
 let n=0;
 for(const it of input.items){const t=await store.get('tasks',it.taskId);if(!t||t.status!=='open')continue;
  const back=await store.update('tasks',t.id,{listId:null,suggestion:it.suggestion});n++;
  if(t.listId==='aspire')await ensureReminder(store,back,now);}
 return {restored:n};
}
export async function ignoreSuggestion(store:BearStore,taskId:string){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 return store.update('tasks',taskId,{suggestion:task.suggestion?{...task.suggestion,ignored:true}:null});
}

// ---------- Lists ----------
const listSchema=z.object({id:z.string().trim().min(1).max(60),title:z.string().trim().min(1).max(40),icon:z.string().trim().min(1).max(8)}).strict();
export const listsSchema=z.object({lists:z.array(listSchema).min(0).max(20)}).strict();
// Save the person's lists (rename, add, reorder, change icon). A list that disappears never takes its tasks with it:
// they go back to the Brain Dump.
export async function saveLists(store:BearStore,input:z.infer<typeof listsSchema>){
 const profile=await ensureProfile(store);const before=listsOf(profile);
 const ids=new Set<string>();const lists:BearList[]=[];
 for(const [i,l] of input.lists.entries()){const id=l.id==='new'?newId():l.id;if(ids.has(id))continue;ids.add(id);lists.push({id,title:l.title,icon:l.icon,order:i});}
 const gone=before.filter(l=>!ids.has(l.id)).map(l=>l.id);
 let returned=0;
 if(gone.length)for(const t of await openTasks(store))if(t.listId&&gone.includes(t.listId)){await store.update('tasks',t.id,{listId:null});returned++;}
 await store.update('profiles',profile.id,{lists});
 return {lists,returned};
}
export {LIST_ICONS};

// ---------- Do: progress that survives interruptions ----------
const draftSchema=z.object({to:z.string().max(200),subject:z.string().max(200),body:z.string().max(6000)}).strict();
export const progressSchema=z.object({draft:draftSchema.nullable().optional(),notes:z.string().max(4000).nullable().optional(),steps:z.array(z.object({text:z.string().trim().min(1).max(200),done:z.boolean()}).strict()).max(30).nullable().optional(),nextAction:z.string().trim().max(200).nullable().optional()}).strict();
export async function saveProgress(store:BearStore,taskId:string,input:z.infer<typeof progressSchema>,now=new Date()){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const prev=task.progress||{savedAt:now.toISOString()};
 const progress={...prev,...input,savedAt:now.toISOString()};
 return store.update('tasks',taskId,{progress});
}
export const detailsSchema=z.object({minutes:z.number().int().min(1).max(600).nullable().optional(),readiness:z.enum(['needs_info','waiting']).nullable().optional()}).strict();
export async function setDetails(store:BearStore,taskId:string,input:z.infer<typeof detailsSchema>){
 const task=await store.get('tasks',taskId);if(!task)throw new Error('not_found');
 const patch:Partial<Task>={};
 if(input.minutes!==undefined){if(input.minutes===null){patch.minutesBy=null;}else{patch.estimatedMinutes=input.minutes;patch.minutesBy='you';}}
 if(input.readiness!==undefined)patch.readiness=input.readiness;
 return store.update('tasks',taskId,patch);
}
export {tz as timeZoneOf};
