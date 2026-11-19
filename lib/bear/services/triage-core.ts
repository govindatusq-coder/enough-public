// Triage: one pass of Claude's vision over what the person gave Bear (photos, PDFs, a pasted or forwarded email), anchored to
// their exact local date and their family, that thinks first and then returns ready-to-use action cards. Pure and testable:
// the email cleaner, the strict schema, the prompt, and the checks every card passes before it is believed.
import {z} from 'zod';
import {daysBetween,isValidISODate} from '../domain/dates.ts';

// ---------- 1. email cleaning ----------
const ENTITIES:Record<string,string>={nbsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…',bull:'•',middot:'·',copy:'©',reg:'®',trade:'™',euro:'€',pound:'£',deg:'°'};
function decode(s:string){return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(m,e:string)=>{if(e[0]==='#'){const n=e[1]==='x'||e[1]==='X'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return Number.isFinite(n)&&n>0&&n<0x110000?String.fromCodePoint(n):'';}return ENTITIES[e.toLowerCase()]??m;});}
function htmlToText(html:string){
 return decode(html
  .replace(/<!--[\s\S]*?-->/g,'')
  .replace(/<(head|style|script|title|noscript|svg|template)\b[\s\S]*?<\/\1\s*>/gi,'')
  .replace(/<img\b[^>]*>/gi,'')                                   // images and 1×1 tracking pixels carry no words
  .replace(/<(br|hr)\b[^>]*\/?>/gi,'\n')
  .replace(/<li\b[^>]*>/gi,'\n- ')
  .replace(/<\/(p|div|tr|li|ul|ol|table|h[1-6]|blockquote|section|article|header|footer)\s*>/gi,'\n')
  .replace(/<(p|div|tr|h[1-6]|table|ul|ol|blockquote)\b[^>]*>/gi,'\n')
  .replace(/<\/t[dh]\s*>/gi,'\t')
  .replace(/<[^>]+>/g,''));
}
// A forwarded message: the forward's own header block goes, the message under it stays (it is what the person wants read).
const FORWARD_HEAD=/^[ \t>]*-{2,}\s*(?:Forwarded message|Begin forwarded message|Original Message)\s*-{0,}[ \t]*:?\s*$/im;
const HEADER_LINE=/^[ \t]*(?:From|Sent|Date|To|Cc|Subject|Reply-To)\s*:.*$/i;
// Where an earlier message is quoted under a reply, everything from there on is history, not the new message.
const REPLY_CUT=[/^[ \t]*On .{4,160}(?:\n.{0,120})?wrote:[ \t]*$/im,/^[ \t]*-{2,}\s*Original Message\s*-{2,}/im,/^[ \t]*From:.+\n[ \t]*(?:Sent|Date):.+\n(?:[ \t]*(?:To|Cc):.+\n)*[ \t]*Subject:.+$/im,/^[ \t]*_{8,}[ \t]*$/m];
export function cleanEmailInput(raw:string,maxChars=20000):string{
 let t=String(raw||'');
 if(/<\s*(html|body|div|p|br|table|span|td|a|img|style)\b/i.test(t))t=htmlToText(t);else t=decode(t);
 t=t.replace(/\r\n?/g,'\n').replace(/[​-‍﻿­]/g,'').replace(/ /g,' ');
 // A forward: keep what follows the forward's header block.
 const fwd=FORWARD_HEAD.exec(t);
 if(fwd&&!/^[ \t]*-{2,}\s*Original Message/i.test(fwd[0])){
  const lead=t.slice(0,fwd.index).trim();const lines=t.slice(fwd.index+fwd[0].length).split('\n');
  let i=0;while(i<lines.length&&(HEADER_LINE.test(lines[i])||!lines[i].trim()))i++;
  t=[lead,lines.slice(i).join('\n')].filter(Boolean).join('\n\n');
 }
 // Cut quoted history at the first marker found anywhere (but never the whole message).
 let cut=t.length;for(const re of REPLY_CUT){const m=re.exec(t);if(m&&m.index>0&&m.index<cut)cut=m.index;}
 t=t.slice(0,cut);
 t=t.split('\n').filter(l=>!/^\s*>/.test(l)).join('\n');                 // ">"-quoted lines
 t=t.replace(/^\s*(?:Sent from my \w+.*|Get Outlook for .*|Download (?:the )?\w+ app.*|Unsubscribe.*|View (?:this email )?in (?:your )?browser.*)$/gim,'');
 t=t.split('\n').map(l=>l.replace(/[ \t]+/g,' ').replace(/ ?\t ?/g,' | ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 return t.slice(0,maxChars);
}
export const looksLikeEmail=(s:string)=>/<\s*(html|body|div|p|br|table)\b/i.test(s)||/^\s*(?:From|Subject|To|Date|Sent)\s*:/im.test(s)||/-{2,}\s*(?:Forwarded message|Original Message)/i.test(s)||/^On .{4,160}wrote:\s*$/im.test(s);

// ---------- 2. the strict output schema ----------
// The model works the document out before it writes (its built-in thinking); the app shows the service's own summary of that
// thinking in the debug drawer. The answer itself carries no field for the model's reasoning: asking a model to write out its
// reasoning in the answer is something the service's safety filter declines, and it should not be worked around.
const nul=(type:string,extra:Record<string,unknown>={})=>({type:[type,'null'],...extra});
export const ACTION_TYPES=['email_reply','sms','calendar_hold','shopping_list','form','payment','booking','task'] as const;
export const URGENCY=['red','amber','green'] as const;
export const triageJsonSchema={
 type:'object',additionalProperties:false,
 required:['source_summary','items_seen','action_cards'],
 properties:{
  source_summary:{type:'string',description:'One sentence: what this is and who it is from.'},
  items_seen:{type:'array',description:'Every separate item in the source, in reading order, written down before any card: each line of a list, each request, date or thing to bring in a notice. One entry per item. Never merge, shorten away or skip an item, even a messy or half-legible one.',items:{type:'object',additionalProperties:false,required:['n','text','status','who','date'],properties:{
   n:{type:'integer',description:'1, 2, 3… in reading order.'},
   text:{type:'string',description:'The item as written, lightly tidied: obvious shorthand expanded ("appt" to "appointment", "rego" stays), names and numbers kept. Under 15 words.'},
   status:{type:'string',enum:['todo','done','unclear','info'],description:'todo: something someone needs to do. done: crossed out or ticked off. unclear: you cannot read it with confidence (give your best reading in text). info: a heading, date or note that asks nothing of anyone.'},
   who:nul('string',{description:'The family member it is for, exactly as named in the family profile, or null.'}),
   date:nul('string',{description:'YYYY-MM-DD if the item gives a day (a due date, or the day of an event), else null.'}),
  }}},
  action_cards:{type:'array',items:{type:'object',additionalProperties:false,
   required:['card_id','covers','family_member','action_type','urgency','hard_deadline','card_headline','ai_work_completed','execution_payload','confidence_score','missing_blocker'],
   properties:{
    card_id:{type:'string',description:'Short id, unique in this reply, e.g. "c1".'},
    covers:{type:'array',items:{type:'integer'},description:'The n of every items_seen entry this card takes care of.'},
    family_member:nul('string',{description:'The family member this is for, exactly as named in the family profile, or null if it is for the parent or nobody in particular.'}),
    action_type:{type:'string',enum:[...ACTION_TYPES]},
    urgency:{type:'string',enum:[...URGENCY],description:'red: due today or tomorrow, overdue, or serious consequences if late. amber: due within two weeks or needs preparing. green: can wait. Several can be red; none need be.'},
    hard_deadline:nul('string',{description:'YYYY-MM-DD. The date the parent must act by (a form or payment due date), or, for an event, the day it happens. Take it from the document: dates in tables, calendars, headings and footers all count. Null only if the document gives no day at all for this item.'}),
    card_headline:{type:'string',description:'Action verb + the specific thing + the outcome, under 12 words. No date in it.'},
    ai_work_completed:{type:'string',description:'One plain line on what you have already prepared (e.g. "Drafted the reply to Mrs Lee confirming Ava will attend"). Never claim anything was sent, booked or paid.'},
    execution_payload:{type:'object',additionalProperties:false,required:['email','sms','calendar_hold','shopping_list','steps'],properties:{
     email:{anyOf:[{type:'object',additionalProperties:false,required:['to','subject','body'],properties:{to:nul('string'),subject:{type:'string'},body:{type:'string'}}},{type:'null'}]},
     sms:{anyOf:[{type:'object',additionalProperties:false,required:['to','body'],properties:{to:nul('string'),body:{type:'string'}}},{type:'null'}]},
     calendar_hold:{anyOf:[{type:'object',additionalProperties:false,required:['title','start','end','all_day','location'],properties:{title:{type:'string'},start:{type:'string',description:'YYYY-MM-DD or YYYY-MM-DDTHH:MM (local time).'},end:nul('string'),all_day:{type:'boolean'},location:nul('string')}},{type:'null'}]},
     shopping_list:{anyOf:[{type:'array',items:{type:'string'}},{type:'null'}]},
     steps:{anyOf:[{type:'array',items:{type:'string'}},{type:'null'}],description:'For forms, payments or bookings: the exact steps, with any reference numbers, amounts, links or codes from the source.'},
    }},
    confidence_score:{type:'number',description:'0 to 1: how sure you are this card is right.'},
    missing_blocker:nul('string',{description:'Usually null. Only if the parent must decide or supply something the document does not say and that cannot be looked up (for example who will go, or a choice between options): ONE short question. Never ask about anything the document already says, such as a date, time, place or cost on the page.'}),
   }}},
 },
} as const;
const email=z.object({to:z.string().nullable(),subject:z.string().max(300),body:z.string().max(6000)}).strict();
const sms=z.object({to:z.string().nullable(),body:z.string().max(1200)}).strict();
const hold=z.object({title:z.string().max(200),start:z.string(),end:z.string().nullable(),all_day:z.boolean(),location:z.string().max(300).nullable()}).strict();
export const cardSchema=z.object({
 card_id:z.string().min(1).max(40),covers:z.array(z.number().int()).max(200).default([]),family_member:z.string().max(80).nullable(),action_type:z.enum(ACTION_TYPES),urgency:z.enum(URGENCY),hard_deadline:z.string().nullable(),
 card_headline:z.string().trim().min(3).max(140),ai_work_completed:z.string().max(400),
 execution_payload:z.object({email:email.nullable(),sms:sms.nullable(),calendar_hold:hold.nullable(),shopping_list:z.array(z.string().max(200)).max(80).nullable(),steps:z.array(z.string().max(400)).max(20).nullable()}).strict(),
 confidence_score:z.number().min(0).max(1),missing_blocker:z.string().max(300).nullable(),
}).strict();
export const itemSchema=z.object({n:z.number().int(),text:z.string().max(400),status:z.enum(['todo','done','unclear','info']),who:z.string().max(80).nullable(),date:z.string().max(40).nullable()}).strict();
export const triageOutputSchema=z.object({source_summary:z.string().max(600),items_seen:z.array(itemSchema).max(300).default([]),action_cards:z.array(cardSchema).max(150)}).strict();
export type SeenItem=z.infer<typeof itemSchema>;
export type TriageCard=z.infer<typeof cardSchema>;export type TriageOutput=z.infer<typeof triageOutputSchema>;

// ---------- 4. anchors: the exact local date and the family ----------
export interface FamilyMember{name:string;relation:'child'|'partner'|'other';age:number|null;yearLevel:string|null;school:string|null;allergies:string|null;notes:string|null}
export interface Anchors{isoDate:string;weekday:string;time:string;timeZone:string;family:FamilyMember[];parentName:string}
export function anchorsFor(now:Date,timeZone:string,family:FamilyMember[],parentName=''):Anchors{
 const f=(o:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-AU',{timeZone,...o}).format(now);
 const p=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return {isoDate:p,weekday:f({weekday:'long'}),time:f({hour:'2-digit',minute:'2-digit',hour12:false}),timeZone,family,parentName};
}
export function familyLines(family:FamilyMember[]):string{
 if(!family.length)return 'No family details saved.';
 return family.map(m=>`- ${m.name} (${m.relation}${m.age!==null?`, age ${m.age}`:''}${m.yearLevel?`, ${m.yearLevel}`:''}${m.school?`, ${m.school}`:''}${m.allergies?`; allergies: ${m.allergies}`:''}${m.notes?`; ${m.notes}`:''})`).join('\n');
}
export const triageSystemPrompt=(a:Anchors)=>`You are Mama Bear in Load Bear. A busy parent in Australia has given you something to deal with: photos, screenshots, a PDF, or a pasted or forwarded email. Read it exactly as laid out (tables, margins, handwriting, small print), work out everything it asks of the family, and do as much of the work as you can before handing it back.

Today is ${a.weekday} ${a.isoDate}, ${a.time} local time (${a.timeZone}). Resolve every relative date ("this Friday", "next week", "tomorrow", "Week 7") from today. Dates on Australian documents are day/month.
${a.parentName?`The parent is ${a.parentName}.\n`:''}Family profile:
${familyLines(a.family)}

First write down every item in items_seen, in order, before any card. On a list (a to-do list, jobs, a shopping list, notes to self, handwritten or typed), every line is an item, including short, messy or half-legible ones: if you cannot read a line with confidence, still list it with your best reading and status unclear. Crossed out or ticked lines are done. Nothing on the page may go missing: the family is trusting you to catch everything.

Before you write any card, work out from the source: its kind and sender; every date with its YYYY-MM-DD; which family member each item is for (by name, year level, class or school from the profile; never invent a person); and the implicit tasks (money or a gold coin to send, uniform or food to pack, a form to sign, a reply expected, something to buy).

Then the action cards. Every todo item becomes a task in the app: one with no card becomes a plain task automatically, so on a list you only need a card where you can prepare something useful. On a list, a card takes care of one line only: never gather separate lines into one card (a line that is itself a shopping list becomes one shopping_list card). For a notice, letter or email, write one card per separate thing the parent must do. Every card lists in covers the items it takes care of. Make each card ready to act on, not a reminder:
- a reply or confirmation: email_reply or sms with the message written in full, in the parent's voice, plain and polite;
- an event: calendar_hold with the exact time if given;
- things to buy or pack: shopping_list;
- a form, payment or booking: steps with every reference number, amount, link or code from the source.
Read every page in full, including tables and calendar grids: each dated line there is its own card with its own date. Do not ask the parent anything the document already answers.
Items that are done, or info that asks nothing, need no card. Never claim you have sent, booked, paid or submitted anything: you prepare, the parent acts. Never invent a date, name, amount or contact; if one is missing and it matters, put ONE short question in missing_blocker.`;

// ---------- the checks every card passes ----------
const plausible=(iso:string|null,today:string)=>{if(!iso)return null;const d=iso.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!isValidISODate(d))return null;const n=daysBetween(today,d)??0;return n<-45||n>550?null:d;};
const okStart=(s:string)=>/^\d{4}-\d{2}-\d{2}(?:T([01]\d|2[0-3]):[0-5]\d(?::\d{2})?)?$/.test(s)&&isValidISODate(s.slice(0,10));
export interface CheckedCard extends TriageCard{problems:string[];fromItem?:'todo'|'unclear'}
const ITEM_STOP=new Set('the and for with about from this that into onto your our are was has have need needs re'.split(' '));
// Parse and check the model's output. A family member not in the profile is dropped; an impossible or implausible date is
// dropped and turned into the card's question; an invalid calendar time loses its hold; duplicate ids are renumbered.
export function checkTriage(raw:unknown,today:string,familyNames:string[]):{ok:true;output:TriageOutput;cards:CheckedCard[]}|{ok:false;error:string}{
 const p=triageOutputSchema.safeParse(raw);if(!p.success)return {ok:false,error:p.error.issues.slice(0,3).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')};
 const names=new Map(familyNames.map(n=>[n.toLowerCase(),n]));const seen=new Set<string>();
 const cards:CheckedCard[]=p.data.action_cards.map((c,i)=>{
  const problems:string[]=[];let card={...c,execution_payload:{...c.execution_payload}};
  if(seen.has(card.card_id))card.card_id=`c${i+1}`;seen.add(card.card_id);
  if(card.family_member){const hit=names.get(card.family_member.trim().toLowerCase())||[...names.values()].find(n=>card.family_member!.toLowerCase().split(/[\s,&]+/).includes(n.toLowerCase()));if(hit)card.family_member=hit;else{problems.push(`family_member "${card.family_member}" is not in the profile`);card.family_member=null;}}
  if(card.hard_deadline){const d=plausible(card.hard_deadline,today);if(!d){problems.push(`hard_deadline "${card.hard_deadline}" is not a usable date`);card.hard_deadline=null;card.missing_blocker=card.missing_blocker||'When is this due?';}else card.hard_deadline=d;}
  const h=card.execution_payload.calendar_hold;if(h&&(!okStart(h.start)||!plausible(h.start,today)||(h.end&&!okStart(h.end)))){problems.push('calendar_hold has an unusable time');card.execution_payload.calendar_hold=null;}
  // An event with a usable time but no due date: the event's day is the date that matters, and there is nothing to ask about it.
  const hold=card.execution_payload.calendar_hold;if(!card.hard_deadline&&hold){card.hard_deadline=plausible(hold.start,today);if(card.hard_deadline&&card.missing_blocker&&/\b(when|what date|which day|what day|what time|date|time)\b/i.test(card.missing_blocker))card.missing_blocker=null;}
  if(card.execution_payload.shopping_list)card.execution_payload.shopping_list=card.execution_payload.shopping_list.map(s=>s.trim()).filter(Boolean);
  card={...card,card_headline:card.card_headline.replace(/[\s.]+$/,'')};
  return {...card,problems};
 });
 // Nothing the model wrote down may disappear: a todo or unclear item that no card covers becomes a plain task card of its own.
 // A card that forgot to say what it covers still counts for a line whose words it clearly carries, so nothing is filed twice.
 const covered=new Set(cards.flatMap(c=>c.covers));
 const words=(t:string)=>t.toLowerCase().replace(/[’']s\b/g,'').replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>2&&!ITEM_STOP.has(w)).map(w=>w.length>4?w.replace(/s$/,''):w);
 const carried=cards.filter(c=>!c.covers.length).map(c=>new Set(words([c.card_headline,...(c.execution_payload.shopping_list||[]),...(c.execution_payload.steps||[]),c.execution_payload.calendar_hold?.title||''].join(' '))));
 const inACard=(t:string)=>{const w=words(t);return w.length>0&&carried.some(set=>w.filter(x=>set.has(x)).length/w.length>=0.75);};
 for(const it of p.data.items_seen){
  if((it.status!=='todo'&&it.status!=='unclear')||covered.has(it.n)||inACard(it.text))continue;covered.add(it.n);
  const text=it.text.replace(/\s+/g,' ').trim().replace(/[\s.]+$/,'');if(text.length<2)continue;
  const who=it.who?names.get(it.who.trim().toLowerCase())??null:null;const date=plausible(it.date,today);
  let id=`i${it.n}`;while(seen.has(id))id+='x';seen.add(id);
  cards.push({card_id:id,covers:[it.n],family_member:who,action_type:'task',urgency:'green',hard_deadline:date,card_headline:(text[0].toUpperCase()+text.slice(1)).slice(0,140),ai_work_completed:'',
   execution_payload:{email:null,sms:null,calendar_hold:null,shopping_list:null,steps:null},confidence_score:it.status==='unclear'?0.4:0.8,
   missing_blocker:it.status==='unclear'?'Bear couldn’t read this line clearly. Is this what it says?':null,problems:[],fromItem:it.status});
 }
 return {ok:true,output:p.data,cards};
}
