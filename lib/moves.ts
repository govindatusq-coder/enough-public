import {type Idea} from './ideas.ts';
import {completeProfile,type State} from './journey.ts';
import {filterIdeas,isFreeMove,type DashboardOptions,type DiscoveryFilter} from './discovery.ts';
import {confirmedWins} from './wins.ts';

export const moveFilters=['For you','Near me','Free','Save money','With family','Nature','Quick wins','Low energy','Surprise me'] as const;
export type MoveFilter=typeof moveFilters[number];
export type MoveOptions=DashboardOptions&{category:'any'|Idea['category'];noExtra:boolean};
export const defaultMoveOptions:MoveOptions={query:'',maxMinutes:0,setting:'any',gentle:false,category:'any',noExtra:false};

// The input is the current eligible feed. Every discovery control only narrows it.
export function movesIdeas(ideas:Idea[],filter:MoveFilter,state:State,options:MoveOptions){
 const base=filter==='Near me'||filter==='Surprise me'?'Free':filter==='Nature'?'For you':filter;
 return filterIdeas(ideas,base as DiscoveryFilter,options.query,state).filter(i=>
   (!options.maxMinutes||i.minutes<=options.maxMinutes)&&
   (options.setting==='any'||i.outdoor===(options.setting==='outside'))&&
   (!options.gentle||i.effort==='gentle')&&
   (options.category==='any'||i.category===options.category)&&
   (!options.noExtra||i.extraMin<=0)&&
   (filter!=='Near me'||i.outdoor)&&
   (filter!=='Nature'||i.outdoor&&i.enjoy.some(t=>['Nature','Exploring','Gardening','Photography','Animals'].includes(t))));
}

export function moveFeedback(ideaId:number,state:State,now=new Date()){
 const rows=confirmedWins(state.entries,now).filter(e=>e.ideaId===ideaId);
 return {tries:rows.length,worthwhile:rows.filter(e=>e.worthwhile).length};
}

type Topic={key:string;title:string;art:string;interests:string[];matches:(i:Idea)=>boolean};
const topics:Topic[]=[
 {key:'outside',title:'A little fresh air',art:'Outside',interests:['Nature','Exploring new places','Gardening','Photography','Animals'],matches:i=>i.outdoor&&isFreeMove(i)},
 {key:'listen',title:'Listen and move',art:'Podcasts',interests:['Podcasts','Music','Audiobooks','Listening to something','Reading'],matches:i=>i.category==='listen'},
 {key:'family',title:'With the family',art:'Family time',interests:['Family time','Family'],matches:i=>i.category==='family'},
 {key:'calls',title:'Catch-ups and conversations',art:'Calls',interests:['Friends / talking','Friends','Conversation'],matches:i=>i.category==='call'||i.social},
 {key:'tasks',title:'Everyday tasks',art:'Household tasks',interests:['Making things','Solving problems','Gardening'],matches:i=>['chores','work','errand','shopping'].includes(i.category)},
 {key:'pauses',title:'Useful little pauses',art:'Short bursts',interests:['Solving problems'],matches:i=>i.category==='waiting'||i.category==='think'||i.category==='work'&&i.minutes<=10}
];
export function moveCollections(ideas:Idea[],state:State,now=new Date()){
 const liked=new Set(confirmedWins(state.entries,now).filter(e=>e.worthwhile).map(e=>e.ideaId));
 const personal=completeProfile(state.profile);
 return topics.map(topic=>{
   const matches=ideas.filter(topic.matches),pin=personal?state.profile.interests.find(p=>topic.interests.includes(p)):undefined;
   const tried=matches.some(i=>liked.has(i.id));
   const preferred=personal&&topic.key==='outside'&&state.profile.preferences.includes('Outside');
   return {...topic,ideas:matches,reason:pin?`You chose ${pin.toLowerCase()}.`:tried?'Includes an idea you found worthwhile.':preferred?'You prefer being outside.':'A collection to explore.',personal:!!(pin||tried||preferred)};
 }).filter(t=>t.ideas.length>0).sort((a,b)=>Number(b.personal)-Number(a.personal));
}
export function favouriteCollections(ideas:Idea[],state:State){
 const saved=new Set(state.saved);
 return topics.map(t=>({...t,ideas:ideas.filter(i=>saved.has(i.id)&&t.matches(i))})).filter(t=>t.ideas.length>0);
}

// Known scenes only. Other activities use a relevant illustration instead of a
// generic café, dinner or outdoor photo that could misrepresent the idea.
export function moveVisual(idea:Idea):{image?:string;art:string}{
 if(idea.image)return {image:'/images/'+idea.image+'.webp',art:'Outside'};
 if(idea.movementMode==='seated'||idea.movementMode==='stretch')return {art:'Physical comfort / accessibility'};
 if(idea.movementMode==='cycle')return {art:'Cycling'};
 if(idea.movementMode==='stairs')return {image:'/images/welcome-refill-stairs.webp',art:'Short bursts'};
 if(idea.key==='video-call-overseas')return {art:'Video call'};
 if(idea.key==='kids-garden-play')return {art:'Active play'};
 if(idea.key==='garden-podcast')return {art:'Garden + Podcast'};
 if(idea.category==='call')return idea.outdoor?{image:'/images/welcome-catchup-walk.webp',art:'Calls'}:{art:'Calls'};
 if(idea.category==='listen')return {art:idea.key.includes('music')?'Music':idea.key.includes('audiobook')?'Audiobooks':'Podcasts'};
 if(idea.category==='family')return idea.outdoor?{image:'/images/welcome-school.webp',art:'Family time'}:{art:'Family time'};
 if(idea.category==='chores')return {art:'Household tasks'};
 if(idea.key.includes('photo'))return {art:'Photography'};
 if(idea.key.includes('dog'))return {art:'Animals'};
 if(idea.category==='coffee')return {art:'Coffee'};
 if(idea.outdoor)return {image:'/images/welcome-coast.webp',art:'Outside'};
 return {art:idea.category==='work'?'Work or study':idea.category==='shopping'?'Groceries':'Short bursts'};
}
