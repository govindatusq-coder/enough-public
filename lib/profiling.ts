import {localDay,type LifeMap} from './life-map.ts';
import type {MovementOpportunity} from './opportunities.ts';

/**
 * Progressive profiling: one quick question at a time, chosen because its
 * answer would change what Enough recommends. Each question declares which
 * opportunities it affects and how each answer adjusts them.
 */
export type ProfilingQuestion={
 id:string;
 text:string;
 options:{id:string;label:string}[];
 /** Only ask when the Life Map makes the question meaningful. */
 relevant:(map:LifeMap)=>boolean;
 /** Opportunities whose fit depends on the answer. */
 affects:(o:MovementOpportunity)=>boolean;
 /** Effect of an answer on an affected opportunity. */
 effect:(answer:string,o:MovementOpportunity)=>{exclude?:boolean;delta?:number;signal?:string};
};
const has=<T,>(list:readonly T[],...values:T[])=>values.some(v=>list.includes(v));

export const profilingQuestions:ProfilingQuestion[]=[
 {id:'kids-leave-area',text:'When you’re waiting at kids’ activities, are you usually free to leave the immediate area?',options:[{id:'usually',label:'Usually'},{id:'sometimes',label:'Sometimes'},{id:'no',label:'No'}],
  relevant:m=>has(m.moments,'kid-activity-wait','kids-sport-watch'),affects:o=>o.contexts.includes('kids')&&o.requiresLeavingLocation,
  effect:a=>a==='no'?{exclude:true}:a==='sometimes'?{delta:-4}:{delta:4,signal:'You can usually step away while they’re busy.'}},
 {id:'listening-calls',text:'Do you have work calls where you’re mostly listening?',options:[{id:'often',label:'Often'},{id:'sometimes',label:'Sometimes'},{id:'rarely',label:'Rarely'}],
  relevant:m=>has(m.contexts,'desk','calls'),affects:o=>has(o.moments,'listening-call','listening-meeting'),
  effect:a=>a==='often'?{delta:8,signal:'You often have calls where you’re mostly listening.'}:a==='rarely'?{delta:-14}:{}},
 {id:'walk-five-longer',text:'Would you walk somewhere if it took five minutes longer than driving?',options:[{id:'yes',label:'Yep'},{id:'sometimes',label:'Sometimes'},{id:'no',label:'Probably not'}],
  relevant:m=>has(m.contexts,'driving','errands')&&m.extraTime!=='none',affects:o=>o.movementTypes.includes('destination')&&(o.extraTimeMinutes>0||o.extraScales),
  effect:a=>a==='no'?{delta:-16}:a==='yes'?{delta:6,signal:'You’ll walk if it’s only a few minutes longer.'}:{}},
 {id:'walk-ten-comfortable',text:'Is a ten-minute walk comfortable for you on most days?',options:[{id:'yes',label:'Yes'},{id:'good-days',label:'On good days'},{id:'no',label:'Not really'}],
  relevant:()=>true,affects:o=>o.mobilityRequirements.includes('walking-10')||o.minMinutes>=10&&o.mobilityRequirements.includes('walking'),
  effect:a=>a==='no'?{exclude:true}:a==='good-days'?{delta:-5}:{}},
 {id:'stairs-nearby',text:'Are there stairs you use on a normal day, at work, at home or at the station?',options:[{id:'yes',label:'Yes'},{id:'some',label:'A few'},{id:'no',label:'Not really'}],
  relevant:m=>!m.hardNos.includes('stairs')&&has(m.contexts,'desk','commuting','home'),affects:o=>o.assumes.includes('stairs')||o.mobilityRequirements.includes('stairs'),
  effect:a=>a==='no'?{exclude:true}:a==='yes'?{delta:3}:{}},
 {id:'outside-space',text:'Do you have a garden, yard or courtyard?',options:[{id:'yes',label:'Yes'},{id:'shared',label:'A shared one'},{id:'no',label:'No'}],
  relevant:m=>m.contexts.includes('home'),affects:o=>o.assumes.includes('garden')||o.assumes.includes('washing-line'),
  effect:a=>a==='no'?{exclude:true}:a==='yes'?{delta:4,signal:'You’ve got a bit of outdoor space at home.'}:{}},
 {id:'evening-walks',text:'How do you feel about walking outside in the evening?',options:[{id:'fine',label:'Fine'},{id:'company',label:'With company'},{id:'no',label:'Rather not'}],
  relevant:m=>!m.hardNos.includes('alone-after-dark'),affects:o=>o.hardConstraintTags.includes('alone-after-dark'),
  effect:a=>a==='no'?{exclude:true}:a==='company'?{delta:-8}:{}},
 {id:'dog-route',text:'Is the dog walk usually the same loop?',options:[{id:'same',label:'Pretty much'},{id:'varies',label:'It varies'},{id:'someone-else',label:'Someone else walks the dog'}],
  relevant:m=>m.moments.includes('dog-walk'),affects:o=>o.moments.includes('dog-walk'),
  effect:(a,o)=>a==='someone-else'?{exclude:true}:a==='same'&&(o.id==='pet-longer-route'||o.id==='playful-new-street')?{delta:5,signal:'Your dog walk is usually the same loop.'}:{}},
 {id:'work-location',text:'Where do you usually work?',options:[{id:'office',label:'An office or workplace'},{id:'home',label:'At home'},{id:'mix',label:'A mix'}],
  relevant:m=>m.contexts.includes('desk'),affects:o=>o.locationTypes.includes('work')&&!o.locationTypes.includes('home')&&o.contexts.includes('desk'),
  effect:(a,o)=>a==='home'&&(o.id==='work-walk-not-message'||o.id==='work-long-way-bathroom'||o.id==='work-park-far-end'||o.id==='work-walking-one-to-one')?{exclude:true}:{}}
];

const DISMISS_DAYS=7;
/**
 * The next question worth asking, or null. Picks the unanswered, relevant
 * question that affects the most of the person's current top candidates.
 * At most one a day; dismissed questions rest for a week.
 */
export function nextProfilingQuestion(map:LifeMap,topCandidates:MovementOpportunity[],now=new Date()):ProfilingQuestion|null{
 if(!map.onboardingCompleted)return null;
 if(map.profilingMeta.lastAsked===localDay(now))return null;
 const rest=DISMISS_DAYS*864e5;
 const open=profilingQuestions.filter(q=>map.profiling[q.id]===undefined&&q.relevant(map)&&!(map.profilingMeta.dismissed[q.id]&&now.getTime()-Date.parse(map.profilingMeta.dismissed[q.id])<rest));
 let best:ProfilingQuestion|null=null,bestImpact=0;
 for(const q of open){const impact=topCandidates.filter(q.affects).length;if(impact>bestImpact){best=q;bestImpact=impact;}}
 return best;
}
export function answerQuestion(map:LifeMap,id:string,answer:string,now=new Date()):LifeMap{
 const q=profilingQuestions.find(q=>q.id===id);if(!q||!q.options.some(o=>o.id===answer))return map;
 return {...map,profiling:{...map.profiling,[id]:answer},profilingMeta:{...map.profilingMeta,lastAsked:localDay(now)},updatedAt:now.toISOString()};
}
export function dismissQuestion(map:LifeMap,id:string,now=new Date()):LifeMap{
 return {...map,profilingMeta:{dismissed:{...map.profilingMeta.dismissed,[id]:now.toISOString()},lastAsked:localDay(now)},updatedAt:now.toISOString()};
}
