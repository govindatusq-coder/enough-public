// Share Bear by text message: ask someone for help with one responsibility using their mobile number. They answer on a
// small web page (no app, no account). Bear tells her what they said and handles the follow-up.
// Pure rules only (no storage, no network): phone numbers, the delegation state machine, tokens, message wording, the
// public view a recipient may see, and when follow-ups are due. Delegation is not resolution: the responsibility stays hers.

// ---------- phone numbers ----------
// Australian mobiles first (04xx xxx xxx, +61 4xx…). Other countries must be given in full international form and are
// checked for shape only, so the validation can grow later without changing callers.
export type PhoneCheck={ok:true;e164:string;display:string}|{ok:false;reason:string};
export function normalisePhone(raw:string):PhoneCheck{
 const s=String(raw||'').trim();if(!s)return {ok:false,reason:'Enter a mobile number.'};
 if(/[^\d\s()+\-.]/.test(s))return {ok:false,reason:'That doesn’t look like a phone number.'};
 let d=s.replace(/[\s().\-]/g,'');
 if(d.startsWith('00'))d='+'+d.slice(2);
 if(/^\+61/.test(d)||/^61\d{9}$/.test(d)||/^0\d{9}$/.test(d)||/^4\d{8}$/.test(d)){
  const local=d.replace(/^\+?61/,'').replace(/^0/,'');
  if(!/^4\d{8}$/.test(local))return {ok:false,reason:'That isn’t an Australian mobile number (they start with 04).'};
  return {ok:true,e164:'+61'+local,display:`0${local.slice(0,3)} ${local.slice(3,6)} ${local.slice(6)}`};
 }
 if(/^\+[1-9]\d{7,14}$/.test(d))return {ok:true,e164:d,display:d};
 return {ok:false,reason:'Check the number. Australian mobiles look like 0412 345 678.'};
}
export const maskPhone=(e164:string)=>e164.startsWith('+61')?`0${e164.slice(3,6)} XXX XXX`:`${e164.slice(0,4)}…${e164.slice(-3)}`;

// ---------- the delegation ----------
export type DStatus='DRAFT'|'PENDING_SEND'|'SENT'|'ACCEPTED'|'DECLINED'|'COMPLETED'|'UNABLE_TO_COMPLETE'|'EXPIRED'|'CANCELLED'|'SEND_FAILED';
export const TRANSITIONS:Record<DStatus,DStatus[]>={
 DRAFT:['PENDING_SEND','CANCELLED'],PENDING_SEND:['SENT','SEND_FAILED'],SEND_FAILED:['PENDING_SEND','CANCELLED'],
 SENT:['ACCEPTED','DECLINED','EXPIRED','CANCELLED'],ACCEPTED:['COMPLETED','UNABLE_TO_COMPLETE','CANCELLED'],
 DECLINED:[],COMPLETED:[],UNABLE_TO_COMPLETE:[],EXPIRED:[],CANCELLED:[],
};
export const canMove=(from:DStatus,to:DStatus)=>TRANSITIONS[from].includes(to);
export const ACTIVE:DStatus[]=['PENDING_SEND','SENT','ACCEPTED'];
export type NoticeType='REQUEST_ACCEPTED'|'REQUEST_DECLINED'|'REQUEST_COMPLETED'|'REQUEST_UNABLE_TO_COMPLETE'|'REQUEST_EXPIRED'|'REQUEST_SEND_FAILED'|'DEADLINE_AT_RISK';
export interface DEvent{at:string;type:string;from:DStatus|null;to:DStatus|null;by:'owner'|'recipient'|'system'|'provider';meta?:Record<string,string|number|boolean|null>}
export interface DMessage{id:string;kind:'request'|'reminder_pending'|'reminder_due';providerId:string|null;provider:'twilio'|'mock'|'own_phone';status:'accepted'|'queued'|'sent'|'delivered'|'failed'|'undelivered'|'handed_over';at:string;deliveredAt:string|null;error:string|null;key:string}
export interface Delegation{
 id:string;rev:number;ownerId:string;ownerName:string;taskId:string;
 recipient:{name:string;phone:string};
 // What was shared, exactly as she saw it before sending (kept for the record; never the live task, never her notes).
 snapshot:{title:string;due:string|null;dueTime:string|null;message:string|null};
 status:DStatus;createdAt:string;sentAt:string|null;acceptedAt:string|null;declinedAt:string|null;completedAt:string|null;cancelledAt:string|null;
 // Hashes of every link sent for this request (the first text and any reminders); all work until it ends or expires.
 expiresAt:string;tokenHashes:string[];tokenRevokedAt:string|null;
 lastRecipientUpdate:string|null;lastReminderAt:string|null;nextFollowUpAt:string|null;remindersOff:boolean;
 idempotencyKey:string;events:DEvent[];messages:DMessage[];
 notices:{id:string;type:NoticeType;at:string;seen:boolean}[];
 // Set when she changes the task after they said yes: their yes was to the earlier version.
 changedSince:boolean;
}
export class DelegationError extends Error{readonly status:number;constructor(m:string,s=400){super(m);this.status=s;}}
// Move to a new status, or refuse. Moving to the status it is already in is a no-op (a repeated tap or callback).
export function move(d:Delegation,to:DStatus,by:DEvent['by'],now:Date,meta?:DEvent['meta']):{d:Delegation;changed:boolean}{
 if(d.status===to)return {d,changed:false};
 if(!canMove(d.status,to))throw new DelegationError(`That can’t happen now (it’s ${label(d.status).toLowerCase()}).`,409);
 const at=now.toISOString();const next:Delegation={...d,status:to,events:[...d.events,{at,type:'status',from:d.status,to,by,...(meta?{meta}:{})}]};
 if(to==='SENT')next.sentAt=at;if(to==='ACCEPTED')next.acceptedAt=at;if(to==='DECLINED')next.declinedAt=at;if(to==='COMPLETED')next.completedAt=at;if(to==='CANCELLED')next.cancelledAt=at;
 if(by==='recipient')next.lastRecipientUpdate=at;
 const n=noticeTypeFor(to);if(n&&!next.notices.some(x=>x.type===n))next.notices=[...next.notices,{id:`${n}-${d.id.slice(0,8)}`,type:n,at,seen:false}];
 if(['CANCELLED','COMPLETED','DECLINED','EXPIRED','UNABLE_TO_COMPLETE'].includes(to))next.nextFollowUpAt=null;
 return {d:next,changed:true};
}
const noticeTypeFor=(s:DStatus):NoticeType|null=>({ACCEPTED:'REQUEST_ACCEPTED',DECLINED:'REQUEST_DECLINED',COMPLETED:'REQUEST_COMPLETED',UNABLE_TO_COMPLETE:'REQUEST_UNABLE_TO_COMPLETE',EXPIRED:'REQUEST_EXPIRED',SEND_FAILED:'REQUEST_SEND_FAILED'} as Partial<Record<DStatus,NoticeType>>)[s]||null;

// How she sees each state, in Bear Brain and on the task.
export function label(s:DStatus):string{return ({DRAFT:'Not sent',PENDING_SEND:'Sending',SENT:'Waiting',ACCEPTED:'Accepted',DECLINED:'Declined',COMPLETED:'Done',UNABLE_TO_COMPLETE:'Needs attention',EXPIRED:'No answer',CANCELLED:'Cancelled',SEND_FAILED:'Didn’t send'} as Record<DStatus,string>)[s];}
// Her words for what happened. Plain, reassuring, never blaming.
export function noticeText(d:Delegation,t:NoticeType):{title:string;body:string}{
 const who=d.recipient.name,what=d.snapshot.title.replace(/\.$/,'');const low=what.charAt(0).toLowerCase()+what.slice(1);
 switch(t){
  case 'REQUEST_ACCEPTED':return {title:`${who}’s got this!`,body:`${who} accepted your request to ${low}.`};
  case 'REQUEST_DECLINED':return {title:`${who} can’t take this one.`,body:`${who} declined: ${low}. It’s back with you.`};
  case 'REQUEST_COMPLETED':return {title:'All taken care of!',body:`${who} marked “${what}” as done.`};
  case 'REQUEST_UNABLE_TO_COMPLETE':return {title:`${who} needs a hand.`,body:`${who} can no longer ${low}. It’s back with you.`};
  case 'REQUEST_EXPIRED':return {title:`No answer from ${who}.`,body:`${who} didn’t answer about “${what}”. It’s back with you.`};
  case 'REQUEST_SEND_FAILED':return {title:'Bear couldn’t send that request.',body:`The text to ${who} didn’t go. Check the number and try again.`};
  case 'DEADLINE_AT_RISK':return {title:`Still waiting on ${who}.`,body:`“${what}” hasn’t been marked as done yet.`};
 }
}

// ---------- tokens ----------
// The link in the text carries a random token; only its SHA-256 hash is stored. Possession lets someone answer this one
// request and nothing else.
export function newToken(){const b=new Uint8Array(32);globalThis.crypto.getRandomValues(b);return Buffer.from(b).toString('base64url');}
export const TOKEN_RE=/^[A-Za-z0-9_-]{43}$/;
export async function hashToken(t:string){const d=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return [...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('');}
// How long a link works: until a day after the deadline while waiting for an answer (a week if there is no deadline);
// once accepted, until a week after the deadline (30 days with none); after it is finished, three more days to see it.
const DAY=86400000;
export function expiryFor(d:Pick<Delegation,'status'|'snapshot'|'createdAt'|'acceptedAt'|'completedAt'|'declinedAt'|'cancelledAt'>,now:Date):string{
 const due=d.snapshot.due?Date.parse(`${d.snapshot.due}T23:59:00+10:00`):null;
 if(d.status==='ACCEPTED')return new Date(due?Math.max(due+7*DAY,now.getTime()+DAY):Date.parse(d.acceptedAt||d.createdAt)+30*DAY).toISOString();
 if(['COMPLETED','DECLINED','UNABLE_TO_COMPLETE'].includes(d.status))return new Date(now.getTime()+3*DAY).toISOString();
 return new Date(due?Math.min(Date.parse(d.createdAt)+14*DAY,Math.max(due+DAY,Date.parse(d.createdAt)+DAY)):Date.parse(d.createdAt)+7*DAY).toISOString();
}
export const linkLive=(d:Delegation,now:Date)=>!d.tokenRevokedAt&&Date.parse(d.expiresAt)>now.getTime()&&!['DRAFT','PENDING_SEND','SEND_FAILED','CANCELLED','EXPIRED'].includes(d.status);

// ---------- the text messages ----------
// The date is added unless the task already says when, in its own words ("on Friday before 3 pm").
const SAYS_WHEN=/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\b(today|tonight|tomorrow)\b|\b\d{1,2}(:\d{2})?\s?(am|pm)\b|\bby (the )?\d/i;
// Times are stored as HH:MM; people read "3 pm" or "3:30 pm". Anything else is shown as it was written.
export const friendlyTime=(t:string|null|undefined)=>{if(!t)return '';const m=/^(\d{2}):(\d{2})$/.exec(t);if(!m)return t;const h=+m[1];return `${h%12||12}${m[2]==='00'?'':`:${m[2]}`} ${h<12?'am':'pm'}`;};
const when=(d:Delegation['snapshot'])=>{if(!d.due||SAYS_WHEN.test(d.title))return '';const day=new Date(`${d.due}T12:00:00+10:00`).toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long',timeZone:'Australia/Sydney'});return d.dueTime?` by ${day}, ${friendlyTime(d.dueTime)}`:` by ${day}`;};
export function requestText(d:Delegation,url:string){return `🐻 ${d.ownerName} wants your help with this:\n${d.snapshot.title}${when(d.snapshot)}.\n${d.snapshot.message?`“${d.snapshot.message}”\n`:''}Can you take care of it?\nAccept or decline:\n${url}`;}
export function reminderText(d:Delegation,url:string,kind:'reminder_pending'|'reminder_due'){
 return kind==='reminder_pending'?`🐻 A quick nudge from Bear: ${d.ownerName} asked if you could help with “${d.snapshot.title}”.\nYes or no is fine:\n${url}`
  :`🐻 A reminder from Bear:\nYou’ve agreed to ${d.snapshot.title.charAt(0).toLowerCase()+d.snapshot.title.slice(1)}${when(d.snapshot)}.\nUpdate your progress:\n${url}`;
}

// ---------- what a recipient may see ----------
// Only this request: who asked, the task as shared, the due date, its state. Never ids, notes, her other tasks or profile.
export interface PublicView{state:'active'|'gone';status?:DStatus;ownerName?:string;recipientName?:string;title?:string;due?:string|null;dueTime?:string|null;message?:string|null;remindersOff?:boolean;changedSince?:boolean}
export function publicView(d:Delegation|null,now:Date):PublicView{
 if(!d||!linkLive(d,now))return {state:'gone'};
 return {state:'active',status:d.status,ownerName:d.ownerName,recipientName:d.recipient.name,title:d.snapshot.title,due:d.snapshot.due,dueTime:d.snapshot.dueTime,message:d.snapshot.message,remindersOff:d.remindersOff,changedSince:d.changedSince};
}
export type RecipientAction='accept'|'decline'|'done'|'unable'|'on_track'|'reminders_off'|'reminders_on';
export const ACTION_TO:Partial<Record<RecipientAction,DStatus>>={accept:'ACCEPTED',decline:'DECLINED',done:'COMPLETED',unable:'UNABLE_TO_COMPLETE'};

// ---------- follow-up ----------
// Sydney local time (recipients are assumed to be where she is until they say otherwise).
export function localParts(now:Date,tz='Australia/Sydney'){const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hour12:false}).formatToParts(now);const g=(t:string)=>f.find(p=>p.type===t)!.value;return {date:`${g('year')}-${g('month')}-${g('day')}`,hour:Number(g('hour'))%24};}
export const reasonableHour=(h:number)=>h>=8&&h<20;
export type FollowUp={kind:'reminder_pending'|'reminder_due'}|{kind:'at_risk'}|{kind:'expire'}|null;
// What Bear should do about one delegation right now. At most one nudge while waiting for an answer; one reminder on the day
// it's due (or the day before for an early-morning deadline); one "still waiting" note to her if the day is ending without
// a "done"; expiry when the link runs out. Never outside 8am-8pm, never twice, never after it's finished.
export function followUpFor(d:Delegation,now:Date,tz='Australia/Sydney'):FollowUp{
 const t=now.getTime();const {date,hour}=localParts(now,tz);
 if(d.status==='SENT'&&Date.parse(d.expiresAt)<=t)return {kind:'expire'};
 if(!reasonableHour(hour))return null;
 const sentMessages=(k:DMessage['kind'])=>d.messages.filter(m=>m.kind===k&&m.status!=='failed').length;
 if(d.status==='SENT'&&!d.remindersOff&&d.sentAt&&t-Date.parse(d.sentAt)>=20*3600000&&sentMessages('reminder_pending')===0&&(!d.snapshot.due||d.snapshot.due>=date))return {kind:'reminder_pending'};
 if(d.status==='ACCEPTED'&&d.snapshot.due){
  if(!d.remindersOff&&d.snapshot.due===date&&sentMessages('reminder_due')===0&&!(d.acceptedAt&&localParts(new Date(d.acceptedAt),tz).date===date))return {kind:'reminder_due'};
  const atRisk=(d.snapshot.due===date&&hour>=17)||d.snapshot.due<date;
  if(atRisk&&!d.notices.some(n=>n.type==='DEADLINE_AT_RISK'))return {kind:'at_risk'};
 }
 return null;
}
