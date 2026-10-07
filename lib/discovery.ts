import {type Idea} from './ideas.ts';
import {type State,type Entry} from './journey.ts';
import {moneyValue} from './recommendations.ts';

// These library activities require no purchase or paid entry. Existing belongings
// (a phone, music, a dog) are optional context, not a new expense.
const freeKeys = new Set([
  'call-family-walk','call-pace-indoors','call-friend-loop','call-work-standing',
  'podcast-outside','music-album-walk','audiobook-chores','problem-walk',
  'plan-week-walk','decompress-walk','playground-laps','after-dinner-stroll',
  'video-call-overseas','kids-garden-play','laundry-stairs','garden-podcast',
  'bins-loop','walking-1on1','break-stretch','water-refill-far',
  'wait-appointment','wait-pickup','wait-laundry','photo-walk','dog-longer'
]);
export function isFreeMove(idea:Idea){return idea.source==='library'&&freeKeys.has(idea.key);}
export const discoveryFilters = ['For you','Free','Quick wins','Low energy','Outside','With family','Save money'] as const;
export type DiscoveryFilter = typeof discoveryFilters[number];
export const dashboardFilters = ['For you','Nearby','Save money','With family','Quick wins','Low energy','Surprise me'] as const;
export type DashboardFilter = typeof dashboardFilters[number];
export type DashboardOptions = {query:string;maxMinutes:number;setting:'any'|'indoors'|'outside';gentle:boolean};
export function dashboardGreeting(now:Date){const hour=now.getHours();return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';}
// Narrow the already eligible feed; dashboard controls can never broaden PINS boundaries.
export function dashboardIdeas(ideas:Idea[],filter:DashboardFilter,state:State,options:DashboardOptions){
 const selected=filter==='Nearby'||filter==='Surprise me'?'For you':filter;
 const pool=filterIdeas(ideas.filter(isFreeMove),selected,options.query,state).filter(i=>
   (!options.maxMinutes||i.minutes<=options.maxMinutes)&&
   (options.setting==='any'||i.outdoor===(options.setting==='outside'))&&
   (!options.gentle||i.effort==='gentle'));
 const categories=new Set<string>();
 const varied=pool.filter(i=>{if(categories.has(i.category))return false;categories.add(i.category);return true});
 return [...varied,...pool.filter(i=>!varied.includes(i))];
}
export function surpriseIdeaId(ideas:Idea[],currentId:number|null,random=Math.random()){
 const alternatives=ideas.filter(i=>i.id!==currentId);
 if(!alternatives.length)return ideas[0]?.id??null;
 return alternatives[Math.min(alternatives.length-1,Math.max(0,Math.floor(random*alternatives.length)))].id;
}
export function filterIdeas(ideas:Idea[],filter:DiscoveryFilter,query:string,state:State){
  const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return ideas.filter(i=>{
    const text=[i.title,i.body,i.category,i.usual,...i.enjoy].join(' ').toLocaleLowerCase();
    if(!terms.every(t=>text.includes(t)))return false;
    if(filter==='Free')return isFreeMove(i);
    if(filter==='Quick wins')return i.minutes<=10;
    if(filter==='Low energy')return i.effort==='gentle'&&i.minutes<=15;
    if(filter==='Outside')return i.outdoor;
    if(filter==='With family')return i.category==='family';
    if(filter==='Save money')return (moneyValue(i,state)?.cents||0)>0;
    return true;
  });
}
export function ideaCover(i:Idea){
  if(i.image)return '/images/'+i.image+'.webp';
  if(i.category==='call'||i.category==='work')return '/images/welcome-call.webp';
  if(i.category==='listen')return '/images/welcome-podcast.webp';
  if(i.category==='family')return '/images/welcome-school.webp';
  if(['coffee','errand','chores','shopping'].includes(i.category))return '/images/welcome-dinner.webp';
  return '/images/welcome-coast.webp';
}
export function placeSearch(query:string,locality:string){
  if(!locality.trim())return null;
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query+' in '+locality.trim());
}

export function recentMoments(entries:Entry[],limit=3,now=new Date()){
 return entries.filter(e=>e.status==='completed'&&e.completedAt&&Date.parse(e.completedAt)<=now.getTime()).sort((a,b)=>Date.parse(b.completedAt!)-Date.parse(a.completedAt!)).slice(0,limit);
}
