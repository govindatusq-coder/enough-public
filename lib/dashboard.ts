import {groups,localDate,receipt,type Entry,type State} from './journey.ts';

export const returnPeriods=['Today','This week','This month','All time'] as const;
export type ReturnPeriod=typeof returnPeriods[number];

function confirmed(entries:Entry[],now:Date){
 return entries.filter(e=>e.status==='completed'&&e.completedAt&&Number.isFinite(Date.parse(e.completedAt))&&Date.parse(e.completedAt)<=now.getTime());
}

export function dashboardActivity(state:State,now=new Date()){
 const rows=confirmed(state.entries,now),today=receipt(rows,'Today',state.profile.currency,now);
 const monday=new Date(now);monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
 const days=Array.from({length:7},(_,index)=>{
   const date=new Date(monday);date.setDate(date.getDate()+index);
   const key=localDate(date),count=rows.filter(e=>localDate(new Date(e.completedAt!))===key).length;
   return {date:key,label:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index],count,today:key===localDate(now),future:date.getTime()>now.getTime()};
 });
 return {
   pinsAnswered:groups.filter(g=>state.profile[g.key].length>0).length,
   routinesAnswered:[!!state.profile.activity,state.profile.rhythms.length>0,!!state.profile.window].filter(Boolean).length,
   today:today.rows.length,todayMinutes:today.rows.reduce((sum,e)=>sum+(e.minutes||0),0),
   planned:state.entries.filter(e=>e.status==='accepted'&&Date.parse(e.acceptedAt)<=now.getTime()).length,
   month:receipt(rows,'This month',state.profile.currency,now).rows.length,
   days,activeDays:days.filter(d=>d.count>0).length,
   confirmed:rows.length,worthwhile:rows.filter(e=>e.worthwhile).length,
   worthwhileOutside:rows.filter(e=>e.worthwhile&&e.outside).length,
   worthwhileTogether:rows.filter(e=>e.worthwhile&&e.connecting).length
 };
}

// Compare with the entire previous calendar period, labelled explicitly rather
// than presenting a partial-month percentage as a trend.
export function previousReturns(entries:Entry[],period:ReturnPeriod,currency:string,now=new Date()){
 if(period==='All time')return null;
 const end=new Date(now);end.setHours(0,0,0,0);
 if(period==='This week')end.setDate(end.getDate()-((end.getDay()+6)%7));
 if(period==='This month')end.setDate(1);
 const start=new Date(end);
 if(period==='Today')start.setDate(start.getDate()-1);
 else if(period==='This week')start.setDate(start.getDate()-7);
 else start.setMonth(start.getMonth()-1);
 const rows=confirmed(entries,now).filter(e=>e.currency===currency&&Date.parse(e.completedAt!)>=start.getTime()&&Date.parse(e.completedAt!)<end.getTime());
 return rows.length?{label:period==='Today'?'Yesterday':period==='This week'?'Last week':'Last month',money:rows.reduce((sum,e)=>sum+(e.moneyCents||0),0)}:null;
}

export function returnCurrencies(state:State,now=new Date()){
 return [...new Set([state.profile.currency,...confirmed(state.entries,now).map(e=>e.currency)])];
}

export function durationLabel(minutes:number){
 return minutes<60?`${minutes} min`:`${Math.floor(minutes/60)}h${minutes%60?` ${minutes%60}m`:''}`;
}

export function momentDateLabel(at:string,now=new Date()){
 const date=new Date(at);
 const calendarDay=(d:Date)=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const days=Math.round((calendarDay(now)-calendarDay(date))/86400000);
 return days===0?'Today':days===1?'Yesterday':days>1&&days<7?`${days} days ago`:date.toLocaleDateString(undefined,{day:'numeric',month:'short',...(date.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
}
