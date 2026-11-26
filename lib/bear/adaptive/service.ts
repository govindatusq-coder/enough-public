// Adaptive Responsibility Engine: storage-facing operations (her answers, her choice of lists, learning from her moves).
import {z} from 'zod';
import type {Task} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
import {ensureProfile} from '../services/profile.ts';
import {listsOf} from '../board/logic.ts';
import {ASSIST,BARRIERS,COMMS,CONTROL,COUNTRIES,HELPERS,HOW_DONE,explainProfile,scoreProfile} from './profile.ts';
import {LIST_SETS,listsForStyle,recommendStyle,type ListStyle} from './lists.ts';
import {learnCategory,resetLearning} from './learning.ts';
import {attributesOf} from './attributes.ts';
import {statusOf} from '../rre/plan.ts';
import {recordBehaviour} from '../services/behaviour.ts';

export const answersSchema=z.object({
 control:z.enum(CONTROL).nullable().optional(),howDone:z.enum(HOW_DONE).nullable().optional(),barriers:z.array(z.enum(BARRIERS)).max(8).optional(),
 assist:z.array(z.enum(ASSIST)).max(6).optional(),helpers:z.enum(HELPERS).nullable().optional(),comms:z.enum(COMMS).nullable().optional(),country:z.enum(COUNTRIES).nullable().optional(),
}).strict();
export const saveAnswersSchema=z.object({answers:answersSchema,name:z.string().trim().max(40).optional(),complete:z.boolean().optional()}).strict();
export const listStyleSchema=z.object({style:z.enum(['classic','areas','routine','windows','support'])}).strict();
export const resetSchema=z.object({what:z.enum(['category','strategy','timing','feedback','all','profile'])}).strict();

const hasChildren=(p:Awaited<ReturnType<typeof ensureProfile>>)=>(p.family||[]).some(f=>f.relation==='child')||(p.people||[]).some(x=>x.role==='child')||!!p.loadMap?.household?.shape?.includes('children');

export async function adaptiveView(store:BearStore){
 const p=await ensureProfile(store);const t=p.temporal||null;const rec=recommendStyle(t);const kids=hasChildren(p);
 return {temporal:t,explanation:t?explainProfile(t):null,recommended:rec,style:p.listStyle||null,country:p.country||null,lists:listsOf(p),
  sets:LIST_SETS.map(s=>({style:s.style,name:s.name,line:s.line,lists:listsForStyle(s.style,{children:kids}).map(l=>({id:l.id,title:l.title,icon:l.icon}))})),
  learning:p.adaptive||null};
}
// Her onboarding answers (or a later change in Settings). Notifications are never switched on from these answers.
export async function saveAnswers(store:BearStore,input:z.infer<typeof saveAnswersSchema>,now=new Date()){
 const p=await ensureProfile(store);const temporal=scoreProfile(input.answers,now);
 await store.update('profiles',p.id,{temporal,country:input.answers.country??p.country??null,...(input.name!==undefined?{name:input.name}:{}),
  ...(input.complete?{onboardingComplete:true}:{}),revision:p.revision+1});
 await recordBehaviour(store,'research_signal',{kind:'onboarding_profile',version:temporal.version,answered:Object.values(input.answers).filter(v=>v!==null&&v!==undefined&&!(Array.isArray(v)&&!v.length)).length},now).catch(()=>null);
 return adaptiveView(store);
}
// She chose a set of lists. Things in lists that go away aren't deleted: they return to My Brain Dump, where Bear suggests
// a place for them in the new lists (and nothing she filed herself in a list that stays is moved).
export async function chooseListStyle(store:BearStore,input:z.infer<typeof listStyleSchema>,now=new Date()){
 const p=await ensureProfile(store);const lists=listsForStyle(input.style,{children:hasChildren(p)});const keep=new Set(lists.map(l=>l.id));
 let returned=0;for(const t of await store.list('tasks',{where:[{column:'status',value:'open'}]}))if(t.listId&&!keep.has(t.listId)){await store.update('tasks',t.id,{listId:null,suggestion:null});returned++;}
 await store.update('profiles',p.id,{lists,listStyle:input.style as ListStyle,revision:p.revision+1});
 await recordBehaviour(store,'research_signal',{kind:'list_style_chosen',style:input.style,recommended:recommendStyle(p.temporal||null)},now).catch(()=>null);
 return {...(await adaptiveView(store)),returned};
}
// She moved something into a list herself: teach Bear what kind of thing goes there (explicit choices only).
export async function noteListChoice(store:BearStore,task:Task,listId:string,suggested:string|null,now=new Date()){
 const plan=task.rre;if(!plan)return;const p=await ensureProfile(store);
 const a=attributesOf(task,plan,{status:statusOf(plan,task.status,now.toISOString().slice(0,10))});
 await store.update('profiles',p.id,{adaptive:learnCategory(p.adaptive,a,suggested,listId,true,now.toISOString())});
}
export async function resetAdaptive(store:BearStore,input:z.infer<typeof resetSchema>){
 const p=await ensureProfile(store);
 if(input.what==='profile'){await store.update('profiles',p.id,{temporal:null});return adaptiveView(store);}
 // Category learning includes the older word-based learning (Bear Brain's "learned" suggestions).
 await store.update('profiles',p.id,{adaptive:resetLearning(p.adaptive,input.what),...(input.what==='category'||input.what==='all'?{listLearning:[]}:{})});return adaptiveView(store);
}
