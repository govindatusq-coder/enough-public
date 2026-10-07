import {byId,type Idea} from './ideas.ts';
import {localDate,type Entry} from './journey.ts';

export const momentFilters=['All','Outside','With family','Together','Everyday tasks','Work day','Worthwhile'] as const;
export type MomentFilter=typeof momentFilters[number];

export function confirmedWins(entries:Entry[],now=new Date()){
 return entries.filter(e=>e.status==='completed'&&e.completedAt&&Number.isFinite(Date.parse(e.completedAt))&&Date.parse(e.completedAt)<=now.getTime()).sort((a,b)=>Date.parse(b.completedAt!)-Date.parse(a.completedAt!));
}

export function filterMoments(entries:Entry[],filter:MomentFilter,query:string,generated:Idea[]=[],day:string|null=null,now=new Date()){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 return confirmedWins(entries,now).filter(e=>{
   if(day&&localDate(new Date(e.completedAt!))!==day)return false;
   const idea=byId(e.ideaId,generated),text=[idea?.title||'Confirmed move',...(e.companions||[]).map(p=>p.name)].join(' ').toLocaleLowerCase();
   if(!terms.every(t=>text.includes(t)))return false;
   if(filter==='Outside')return e.outside===true;
   if(filter==='Together')return e.connecting===true;
   if(filter==='With family')return idea?.category==='family';
   if(filter==='Everyday tasks')return e.gave?.includes('task_completed')||['chores','errand','shopping'].includes(idea?.category||'');
   if(filter==='Work day')return idea?.category==='work';
   if(filter==='Worthwhile')return e.worthwhile===true;
   return true;
 });
}

export function winArtwork(idea:Idea|undefined){
 if(!idea)return 'Outside';
 if(idea.movementMode==='seated'||idea.movementMode==='stretch')return 'Physical comfort / accessibility';
 if(idea.category==='listen')return idea.key.includes('music')?'Music':idea.key.includes('audiobook')?'Audiobooks':'Podcasts';
 if(idea.key.includes('garden'))return 'Gardening';
 if(idea.key.includes('photo'))return 'Photography';
 if(idea.key.includes('dog'))return 'Animals';
 return ({call:'Calls',family:'Family time',work:'Work or study',chores:'Household tasks',think:'Solving problems',waiting:'Short bursts'} as Partial<Record<Idea['category'],string>>)[idea.category]||'Outside';
}

export function collectionMonths(entries:Entry[],now=new Date()){
 return [...new Set([localDate(now).slice(0,7),...confirmedWins(entries,now).map(e=>localDate(new Date(e.completedAt!)).slice(0,7))])].sort().reverse();
}

export function monthCollection(entries:Entry[],month:string,now=new Date()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Choose a calendar month.');
 const [year,number]=month.split('-').map(Number),start=new Date(year,number-1,1),length=new Date(year,number,0).getDate();
 const rows=confirmedWins(entries,now).filter(e=>localDate(new Date(e.completedAt!)).startsWith(month+'-'));
 const days=Array.from({length},(_,index)=>{
   const date=new Date(year,number-1,index+1),key=localDate(date),count=rows.filter(e=>localDate(new Date(e.completedAt!))===key).length;
   return {date:key,number:index+1,count,today:key===localDate(now),future:date.getTime()>now.getTime()};
 });
 return {label:start.toLocaleDateString(undefined,{month:'long',year:'numeric'}),offset:(start.getDay()+6)%7,days,total:rows.length,activeDays:days.filter(d=>d.count>0).length};
}

export function winMilestones(entries:Entry[],now=new Date()){
 const rows=confirmedWins(entries,now).reverse();
 return [
   {key:'first',title:'A first moment',description:'Your first confirmed move',earnedAt:rows[0]?.completedAt},
   {key:'combined',title:'Time combined',description:'Movement alongside an existing task',earnedAt:rows.find(e=>(e.timeCombined||0)>0)?.completedAt},
   {key:'connection',title:'Room for connection',description:'You reported time connecting',earnedAt:rows.find(e=>e.connecting&&(e.minutes||0)>0)?.completedAt},
   {key:'money',title:'Money kept',description:'You confirmed a real saving',earnedAt:rows.find(e=>(e.moneyCents||0)>0)?.completedAt}
 ];
}

export function topWorthwhileMoments(entries:Entry[],now=new Date()){
 const groups=new Map<number,{ideaId:number;entryId:string;worthwhile:number;minutes:number;money:Record<string,number>;latest:string}>();
 for(const e of confirmedWins(entries,now).filter(e=>e.worthwhile)){
   let group=groups.get(e.ideaId);
   if(!group){group={ideaId:e.ideaId,entryId:e.id,worthwhile:0,minutes:0,money:{},latest:e.completedAt!};groups.set(e.ideaId,group)}
   group.worthwhile++;group.minutes+=e.minutes||0;group.money[e.currency]=(group.money[e.currency]||0)+(e.moneyCents||0);
 }
 return [...groups.values()].sort((a,b)=>b.worthwhile-a.worthwhile||Date.parse(b.latest)-Date.parse(a.latest)||a.ideaId-b.ideaId).slice(0,3);
}

export function recentWinMonths(entries:Entry[],now=new Date()){
 const rows=confirmedWins(entries,now);
 return Array.from({length:5},(_,index)=>{
   const date=new Date(now.getFullYear(),now.getMonth()-4+index,1),key=localDate(date).slice(0,7);
   return {key,label:date.toLocaleDateString(undefined,{month:'short'}),count:rows.filter(e=>localDate(new Date(e.completedAt!)).startsWith(key+'-')).length,current:index===4};
 });
}
