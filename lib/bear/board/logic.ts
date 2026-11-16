// Brain Dump Board: the pure rules behind the redesign. Nothing here touches storage, so it is all testable.
// Principle: design for interrupted lives, not perfectly planned days. Bear suggests; the person decides.
import type {Profile,Task} from '../domain/types.ts';
import {localParts} from '../domain/dates.ts';

export interface BearList{id:string;title:string;icon:string;order:number}

// The six starter lists, with stable ids so suggestions keep working after a rename.
export const STARTER_LISTS:BearList[]=[
 {id:'night',title:'Night Time',icon:'🌙',order:0},
 {id:'calls',title:'Phone Calls',icon:'📞',order:1},
 {id:'followup',title:'Organise Follow-Up',icon:'🔄',order:2},
 {id:'spare',title:'Organise Time-Permitting',icon:'✨',order:3},
 {id:'week',title:'This Week & Weekend',icon:'📅',order:4},
 {id:'aspire',title:'Aspirations',icon:'🌱',order:5},
];
// Lists saved before the v2 names keep their place but take the new names, unless she renamed them herself.
const OLD_NAMES:Record<string,string>={'Nighttime Tasks':'Night Time','Aspirational':'Aspirations','Organise – Follow-up':'Organise Follow-Up','Organise – Time Permitting':'Organise Time-Permitting','This Week/Weekend':'This Week & Weekend'};
export const LIST_ICONS=['🌙','📞','🌱','🔄','✨','📅','🏠','🛒','💼','🎒','❤️','🚗','💰','🎁','🩺','🐔','📝','⭐'];
export const listsOf=(p:Pick<Profile,'lists'>|null|undefined):BearList[]=>[...(p?.lists??STARTER_LISTS)].map(l=>OLD_NAMES[l.title]?{...l,title:OLD_NAMES[l.title]}:l).sort((a,b)=>a.order-b.order);

// ---------- Suggestions ----------
const RULES:{id:string;re:RegExp}[]=[
 {id:'followup',re:/\b(follow[- ]?up|chase|check (?:in|on|back)|confirm|hear back|waiting (?:on|for)|remind \w+ to)\b/i},
 {id:'calls',re:/\b(call|ring|phone|rang)\b|\b(?:book|make|change)\b.*\b(?:appointment|podiatrist|physio\w*|dentist|doctor|gp|vet|optometrist|hairdresser|chiro\w*)\b/i},
 {id:'aspire',re:/\b(build|eventually|one day|someday|some day|renovat\w*|landscap\w*|extension|dream|learn to|new (?:deck|pen|kitchen|bathroom|garden|shed)|long[- ]term)\b/i},
 {id:'week',re:/\b(christmas|xmas|holiday|weekend|this week|birthday|gifts?|presents?|party|saturday|sunday)\b/i},
 {id:'night',re:/\b(pay|bill|invoice|permission|form|email|e-mail|reply|respond|rsvp|sms|text|message|order|online|renew|lunch(?:es)?|booking|book|register|enrol|sign|fill in|transfer)\b/i},
 {id:'spare',re:/\b(organi[sz]e|tidy|declutter|sort out|clean out|clear out|fix|mould|mold|garage|wardrobe|cupboard|paint)\b/i},
];
const STOP=new Set('a an the to for of and or on in at by with my our your his her their it this that need needs get got do some new up out about from into me i we be is are was'.split(' '));
export const wordsOf=(title:string)=>[...new Set(title.toLowerCase().replace(/[’']s\b/g,'').split(/[^a-z0-9]+/).filter(w=>w.length>2&&!STOP.has(w)))];

export type Suggestion={listId:string;by:'bear'|'learned'};
// What the person has done before wins over the built-in rules, but only when there is real overlap:
// two shared words, or one word they have filed the same way at least twice.
export function suggestList(title:string,lists:BearList[],learning:Profile['listLearning']=[]):Suggestion|null{
 const ids=new Set(lists.map(l=>l.id));const words=wordsOf(title);
 const score=new Map<string,{words:number;n:number}>();
 for(const l of learning||[]){if(!ids.has(l.listId)||!words.includes(l.word))continue;const s=score.get(l.listId)||{words:0,n:0};s.words++;s.n+=l.n;score.set(l.listId,s);}
 const best=[...score.entries()].sort((a,b)=>(b[1].words-a[1].words)||(b[1].n-a[1].n))[0];
 if(best&&(best[1].words>=2||best[1].n>=2))return {listId:best[0],by:'learned'};
 for(const r of RULES)if(ids.has(r.id)&&r.re.test(title))return {listId:r.id,by:'bear'};
 return null;
}
// Record a choice the person made. Each topical word in the title now points to that list (most recent choice wins per word).
export function learnChoice(learning:Profile['listLearning'],title:string,listId:string,at:string):NonNullable<Profile['listLearning']>{
 const out=[...(learning||[])];
 for(const word of wordsOf(title).slice(0,6)){
  const i=out.findIndex(l=>l.word===word);
  if(i>=0&&out[i].listId===listId)out[i]={...out[i],n:out[i].n+1,at};
  else if(i>=0)out[i]={word,listId,n:1,at};
  else out.push({word,listId,n:1,at});
 }
 return out.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,300);
}

// ---------- Time and readiness ----------
const isCall=(t:string)=>/\b(call|ring|phone)\b/i.test(t);
// A rough guess of how long something takes. The person's own number always wins. Always shown as "about".
export function minutesFor(task:Pick<Task,'title'|'estimatedMinutes'|'minutesBy'>):number{
 if(task.minutesBy==='you')return task.estimatedMinutes;
 const t=task.title;
 if(/\b(rsvp|confirm|text|sms)\b/i.test(t))return 2;
 if(/\b(reply|respond|email|e-mail|message)\b/i.test(t))return 3;
 if(/\b(pay|bill|invoice|transfer|order|renew|sign)\b/i.test(t))return 5;
 if(/\b(form|permission|register|enrol|book|booking)\b/i.test(t))return 8;
 if(isCall(t))return 10;
 if(/\b(follow[- ]?up|chase)\b/i.test(t))return 5;
 if(/\b(build|renovat\w*|organi[sz]e|plan|declutter|fix)\b/i.test(t))return 60;
 return Math.min(task.estimatedMinutes||15,30);
}
export type Readiness='captured'|'needs_info'|'ready'|'in_progress'|'waiting'|'completed'|'cancelled';
export function readinessOf(task:Pick<Task,'status'|'readiness'|'progress'|'listId'|'sharedOut'|'dumpId'>):Readiness{
 if(task.status==='done')return 'completed';
 if(task.status==='dropped'||task.status==='archived')return 'cancelled';
 if(task.readiness)return task.readiness;
 if(task.progress&&(task.progress.draft?.body||task.progress.notes||task.progress.steps?.some(s=>s.done)))return 'in_progress';
 if(!task.listId&&task.dumpId)return 'captured';
 return 'ready';
}
// Most businesses answer the phone 9 to 5 on weekdays and Saturday morning. Local time in the person's zone.
export function businessOpen(now:Date,timeZone:string):boolean{
 const parts=new Intl.DateTimeFormat('en-AU',{timeZone,weekday:'short',hour:'numeric',hourCycle:'h23'}).formatToParts(now);
 const day=parts.find(p=>p.type==='weekday')?.value||'';const hour=Number(parts.find(p=>p.type==='hour')?.value||0);
 if(day==='Sun')return false;if(day==='Sat')return hour>=9&&hour<12;return hour>=9&&hour<17;
}

// ---------- "I've got a moment" ----------
export interface Moment{taskId:string;title:string;minutes:number;listId:string|null;why:string|null}
export interface MomentResult{picks:Moment[];heldBack:string|null}
// Up to three things that fit the time she actually has. Things that can't move right now (waiting on someone, needing
// information, a phone call when businesses are shut, Aspirational dreams) are not offered.
export function pickMoments(tasks:Task[],minutes:number,now:Date,timeZone:string,today:string):MomentResult{
 const open=businessOpen(now,timeZone);let callsHeld=0;
 const fits:{t:Task;m:number;score:number}[]=[];
 for(const t of tasks){
  if(t.status!=='open'||t.wishlist||t.listId==='aspire'||t.sharedOut&&t.sharedOut.mode==='transfer')continue;
  if(t.snoozedUntil&&t.snoozedUntil>today)continue;
  const r=readinessOf(t);if(r==='waiting'||r==='needs_info')continue;
  if(isCall(t.title)&&!open){callsHeld++;continue;}
  const m=minutesFor(t);if(m>minutes)continue;
  const light=t.light?.level||t.sorted?.urgency||null;
  const due=t.dueAt?Math.max(0,Math.round((Date.parse(t.dueAt)-Date.parse(today))/86400000)):99;
  const score=(light==='red'?0:light==='amber'?10:20)+Math.min(due,30)+(r==='in_progress'?-5:0)+m/10;
  fits.push({t,m,score});
 }
 fits.sort((a,b)=>a.score-b.score);
 const picks=fits.slice(0,3).map(({t,m})=>({taskId:t.id,title:t.title,minutes:m,listId:t.listId??null,why:t.dueAt&&t.dueAt<=today?'due today':readinessOf(t)==='in_progress'?'already started':null}));
 return {picks,heldBack:callsHeld?`${callsHeld===1?'A phone call is':`${callsHeld} phone calls are`} kept for when businesses are open.`:null};
}

// ---------- Home ----------
export const greetingFor=(hour:number,name:string)=>`${hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}${name?`, ${name}`:''}.`;

// Her quiet hours (from Settings), in her own time zone. Used so share news never buzzes her phone at night.
export function inQuietHours(n:{quietStartMinute:number;quietEndMinute:number},now:Date,timeZone:string){
 const m=localParts(now,timeZone).minuteOfDay;
 return n.quietStartMinute>n.quietEndMinute?m>=n.quietStartMinute||m<n.quietEndMinute:m>=n.quietStartMinute&&m<n.quietEndMinute;
}
