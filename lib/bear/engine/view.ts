import {todayISO} from '../domain/dates.ts';
import {describe} from '../load/view.ts';
import type {BearStore} from '../store/store.ts';
import {flags} from '../flags.ts';
import {history} from './events.ts';
import {summariseExecution} from './execution-summary.ts';
import {planFor} from './plan.ts';
import {stateOf,stateWords,verificationOf} from './state.ts';

// One responsibility as the engine sees it: the same view for the consumer app and the API. Plain words
// for people, structured fields for software. Never includes other people's data: the store is per user.
export async function responsibilityView(store:BearStore,id:string,now=new Date()){
 const t=await store.get('tasks',id);if(!t)return null;
 const profile=(await store.list('profiles',{limit:1}))[0];const today=todayISO(profile?.lifeRhythm?.timezone||'Australia/Sydney',now);
 const completion=t.status==='done'?(await store.list('completions',{where:[{column:'task_id',value:t.id}],orderBy:{column:'completed_at',ascending:false},limit:1}))[0]||null:null;
 const events=await history(store,t.id);
 const state=stateOf(t,completion,today,flags.executionLayer()?summariseExecution(events,now):null);const v=t.load?describe(t.load,today):null;const plan=t.load?planFor(t.load):null;
 const primary=t.load?.nodes.find(n=>n.id===t.load!.primaryId);
 return {id:t.id,title:t.title,pattern:primary?.pattern||null,state,statusText:stateWords[state],dueDate:t.dueAt,
  nextAction:v?.needsYou?{label:v.needsYou.headline,dueDate:v.needsYou.dueAt||null}:null,
  bearHandling:v?.covered||[],prepared:(v?.prepared||[]).map(p=>({label:p.label,value:p.value,link:p.href,copy:p.copy,done:p.done})),
  plan:plan?{valid:plan.valid,steps:plan.steps.length,nextSteps:plan.steps.filter(s=>plan.next.includes(s.id)).map(s=>({label:s.label,owner:s.owner,dueDate:s.dueAt})),issues:plan.issues.filter(i=>i.kind!=='blocked'&&i.kind!=='unnecessary').map(i=>i.kind)}:null,
  verification:completion?.evidence?{level:completion.evidence.level,method:verificationOf(completion),at:completion.evidence.verifiedAt}:null,
  events:events.length};
}
