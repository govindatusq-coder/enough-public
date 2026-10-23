// Australian date handling. Dates are stored as yyyy-mm-dd; times as ISO timestamps.
import type {Weekday} from './types.ts';
export const AU_TIMEZONE='Australia/Sydney';
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const pad=(n:number)=>String(n).padStart(2,'0');
export const toISODate=(d:Date)=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
export function parseISODate(s:string|null|undefined):Date|null{if(!s||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [y,m,d]=s.split('-').map(Number);const date=new Date(y,m-1,d,12,0,0,0);return date.getMonth()===m-1&&date.getDate()===d?date:null;}
export function isValidISODate(s:unknown):s is string{return typeof s==='string'&&parseISODate(s)!==null;}
export function addDays(iso:string,days:number){const d=parseISODate(iso);if(!d)throw new Error('Invalid date '+iso);d.setDate(d.getDate()+days);return toISODate(d);}
export function addMonths(iso:string,months:number){const d=parseISODate(iso);if(!d)throw new Error('Invalid date '+iso);const day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);const last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,last));return toISODate(d);}
export function daysBetween(fromIso:string,toIso:string){const a=parseISODate(fromIso),b=parseISODate(toIso);if(!a||!b)return null;return Math.round((b.getTime()-a.getTime())/86400000);}
export const weekdayOf=(d:Date):Weekday=>(['sun','mon','tue','wed','thu','fri','sat'] as const)[d.getDay()];
// Long Australian form: 28 November 2026; short: 28 Nov
export function formatAU(iso:string|null|undefined,style:'long'|'short'|'weekday'='long'){
 const d=iso?parseISODate(iso):null;if(!d)return '';
 if(style==='short')return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'});
 if(style==='weekday')return d.toLocaleDateString('en-AU',{weekday:'long'});
 return d.toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'});
}
export function formatTime(isoDateTime:string,timeZone=AU_TIMEZONE){return new Date(isoDateTime).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit',timeZone}).replace(/\s?([ap]m)/i,' $1').toLowerCase();}
export function formatWhen(isoDateTime:string,timeZone=AU_TIMEZONE){const d=new Date(isoDateTime);return d.toLocaleDateString('en-AU',{weekday:'long',timeZone})+' · '+formatTime(isoDateTime,timeZone);}
// Relative label: Today / Tomorrow / Friday / 28 Nov
export function relativeDay(iso:string,today:string){const n=daysBetween(today,iso);if(n===null)return '';if(n===0)return 'today';if(n===1)return 'tomorrow';if(n===-1)return 'yesterday';if(n>1&&n<7)return formatAU(iso,'weekday');return formatAU(iso,'short');}

// Parse the many ways Australian bills print dates. Returns yyyy-mm-dd or null.
// Day-first always wins for numeric forms (28/11/2026), as in Australia.
export function parseAUDate(text:string,referenceYear=new Date().getFullYear()):string|null{
 const t=text.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g,'$1');
 let m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);if(m)return finish(+m[1],+m[2],+m[3]);
 m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/.exec(t);if(m){const y=m[3].length===2?2000+ +m[3]:+m[3];return finish(y,+m[2],+m[1]);}
 m=/^(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{2,4})$/.exec(t);if(m){const mo=monthIndex(m[2]);if(mo<0)return null;const y=m[3].length===2?2000+ +m[3]:+m[3];return finish(y,mo+1,+m[1]);}
 m=/^([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(t);if(m){const mo=monthIndex(m[1]);if(mo<0)return null;const y=m[3].length===2?2000+ +m[3]:+m[3];return finish(y,mo+1,+m[2]);}
 m=/^(\d{1,2})\s+([a-z]{3,9})\.?$/.exec(t);if(m){const mo=monthIndex(m[2]);if(mo<0)return null;return finish(referenceYear,mo+1,+m[1]);}
 return null;
}
function monthIndex(name:string){const n=name.toLowerCase().slice(0,3);return MONTHS.findIndex(m=>m.startsWith(n)&&(name.length<=3||m.startsWith(name.toLowerCase())));}
function finish(y:number,m:number,d:number){if(y<2000||y>2100||m<1||m>12||d<1||d>31)return null;const iso=`${y}-${pad(m)}-${pad(d)}`;return parseISODate(iso)?iso:null;}
// Regex that finds date-like spans in free text (used by the rule-based extractor).
export const DATE_SPAN=/\b(\d{1,2}(?:st|nd|rd|th)?[\/.\- ](?:\d{1,2}|[A-Za-z]{3,9})[\/.\- ,]+\d{2,4}|\d{4}-\d{2}-\d{2}|(?:[A-Za-z]{3,9})\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9})\b/g;

export function todayISO(timeZone=AU_TIMEZONE,now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(k:string)=>parts.find(p=>p.type===k)!.value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function localParts(isoDateTime:string|Date,timeZone=AU_TIMEZONE){const d=typeof isoDateTime==='string'?new Date(isoDateTime):isoDateTime;const parts=new Intl.DateTimeFormat('en-AU',{timeZone,hour:'numeric',minute:'numeric',weekday:'short',hour12:false}).formatToParts(d);const get=(k:string)=>parts.find(p=>p.type===k)?.value||'';const hour=+get('hour')%24,minute=+get('minute');const weekday=get('weekday').slice(0,3).toLowerCase() as Weekday;return {hour,minute,weekday,minuteOfDay:hour*60+minute,date:todayISO(timeZone,d)};}
// Build an ISO timestamp for a local date + minute-of-day in a timezone without a tz library.
export function zonedDateTime(isoDate:string,minuteOfDay:number,timeZone=AU_TIMEZONE){
 const [y,m,d]=isoDate.split('-').map(Number);const guess=Date.UTC(y,m-1,d,Math.floor(minuteOfDay/60),minuteOfDay%60);
 const offset=(date:number)=>{const p=new Intl.DateTimeFormat('en-US',{timeZone,hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(date));const g=(k:string)=>+p.find(x=>x.type===k)!.value;return Date.UTC(g('year'),g('month')-1,g('day'),g('hour')%24,g('minute'))-date;};
 let utc=guess-offset(guess);utc=guess-offset(utc);return new Date(utc).toISOString();
}
