import {daysBetween,formatAU} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';

// Short, calm wording for dates and money in Bear's voice.
export function friendlyDate(iso:string|null|undefined,today:string){
 if(!iso)return '';const n=daysBetween(today,iso);if(n===null)return '';
 if(n===0)return 'today';if(n===1)return 'tomorrow';if(n===-1)return 'yesterday';
 if(n>1&&n<7)return formatAU(iso,'weekday').split(' ')[0];
 return formatAU(iso,'short');
}
export function friendlyRange(start:string|null|undefined,end:string|null|undefined,today:string){
 if(!start)return '';if(!end||end===start)return friendlyDate(start,today);
 const [,,a]=start.split('-');const [,bm,b]=end.split('-');const month=formatAU(end,'long').split(' ')[1]||'';
 return start.slice(5,7)===bm?`${+a}–${+b} ${month}`:`${friendlyDate(start,today)} – ${friendlyDate(end,today)}`;
}
export const money=(cents:number|null|undefined)=>cents?formatAUD(cents).replace(/\.00$/,''):'';
export const sentence=(s:string)=>s?s[0].toUpperCase()+s.slice(1):s;
export const the=(title:string)=>/^(the|a|an|my|your|our)\b/i.test(title)||/^[A-Z][a-z]+'s\b/.test(title)?title:'the '+(/^(Year|Dr|GP|[A-Z]{2,})\b/.test(title)?title:title.charAt(0).toLowerCase()+title.slice(1));
