import {addDays,parseISODate,toISODate} from '../domain/dates.ts';
import type {LoadEntities} from './types.ts';

// Deterministic entity extraction. Cheap, local and explainable; AI readings (when present)
// are merged on top by the engine, but nothing here depends on a model.
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MONTH=String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;
const ORD=String.raw`(?:st|nd|rd|th)?`;
const WEEKDAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const pad=(n:number)=>String(n).padStart(2,'0');
const monthNo=(s:string)=>MONTHS.indexOf(s.slice(0,3).toLowerCase())+1;

export interface DateHit{iso:string;end:string|null;index:number;role:'due'|'event'|'rsvp'|'expiry';text:string}

function build(y:number,m:number,d:number){if(m<1||m>12||d<1||d>31)return null;const iso=`${y}-${pad(m)}-${pad(d)}`;return parseISODate(iso)?iso:null;}
// A date with no year means the next sensible one: this year, unless it is long past.
function inferYear(m:number,d:number,today:string){const y=+today.slice(0,4);const iso=build(y,m,d);if(!iso)return null;const days=(parseISODate(iso)!.getTime()-parseISODate(today)!.getTime())/86400000;return days<-120?build(y+1,m,d):iso;}
function nextWeekday(today:string,dow:number,next:boolean){const t=parseISODate(today)!;let diff=(dow-t.getDay()+7)%7;if(diff===0)diff=7;if(next&&diff<7)diff+=0;return addDays(today,diff);}

function roleBefore(text:string,index:number):DateHit['role']{
 const before=text.slice(Math.max(0,index-48),index).toLowerCase();
 const clause=before.split(/[.;!?\n]/).pop()||'';
 const tail=clause.slice(-40);
 if(/\b(rsvp|reply|let .* know)\b/.test(tail))return 'rsvp';
 if(/\b(expir\w*|lapses?|valid (?:until|to)|renew(?:al)? (?:due|by)|runs out)\b/.test(tail))return 'expiry';
 if(/\b(due|by|before|deadline|closes?|close|no later than|payable|pay by|return(?:ed)?|submit(?:ted)?|lodge|owing|overdue|until)\b[^,]{0,24}$/.test(tail))return 'due';
 return 'event';
}

export function findDates(text:string,today:string):DateHit[]{
 const hits:DateHit[]=[];const taken:[number,number][]=[];
 const add=(index:number,len:number,iso:string|null,end:string|null=null)=>{if(!iso||taken.some(([a,b])=>index<b&&index+len>a))return;taken.push([index,index+len]);hits.push({iso,end,index,role:roleBefore(text,index),text:text.slice(index,index+len)});};
 let m:RegExpExecArray|null;
 const range=new RegExp(String.raw`\b(\d{1,2})${ORD}\s*(?:–|—|-|to)\s*(\d{1,2})${ORD}\s+${MONTH}\b\.?(?:,?\s+(\d{4}))?`,'gi');
 while((m=range.exec(text))){const mo=monthNo(m[3]);const y=m[4]?+m[4]:null;const a=y?build(y,mo,+m[1]):inferYear(mo,+m[1],today);const b=a?build(+a.slice(0,4),mo,+m[2]):null;add(m.index,m[0].length,a,b);}
 const iso=/\b(\d{4})-(\d{2})-(\d{2})\b/g;while((m=iso.exec(text)))add(m.index,m[0].length,build(+m[1],+m[2],+m[3]));
 const dmy=new RegExp(String.raw`\b(\d{1,2})${ORD}\s+(?:of\s+)?${MONTH}\b\.?(?:,?\s+(\d{4}))?`,'gi');
 while((m=dmy.exec(text))){const mo=monthNo(m[2]);add(m.index,m[0].length,m[3]?build(+m[3],mo,+m[1]):inferYear(mo,+m[1],today));}
 const mdy=new RegExp(String.raw`\b${MONTH}\.?\s+(\d{1,2})${ORD}\b(?:,?\s+(\d{4}))?`,'gi');
 while((m=mdy.exec(text))){const mo=monthNo(m[1]);add(m.index,m[0].length,m[3]?build(+m[3],mo,+m[2]):inferYear(mo,+m[2],today));}
 const num=/\b(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?\b/g;
 while((m=num.exec(text))){if(/\$\s*$/.test(text.slice(0,m.index)))continue;const y=m[3]?(m[3].length===2?2000+ +m[3]:+m[3]):null;add(m.index,m[0].length,y?build(y,+m[2],+m[1]):inferYear(+m[2],+m[1],today));}
 const rel=/\b(today|tonight|tomorrow|(next|this)\s+week|end of (?:the )?month|in (\d{1,2}) (days?|weeks?))\b/gi;
 while((m=rel.exec(text))){const w=m[1].toLowerCase();let d:string;
  if(w==='today'||w==='tonight')d=today;else if(w==='tomorrow')d=addDays(today,1);else if(m[2])d=addDays(today,m[2].toLowerCase()==='next'?7:3);
  else if(w.startsWith('end of')){const t=parseISODate(today)!;d=toISODate(new Date(t.getFullYear(),t.getMonth()+1,0,12));}else d=addDays(today,+m[3]*(m[4].startsWith('week')?7:1));
  add(m.index,m[0].length,d);}
 const wd=/\b(?:(next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thur?s?|fri|sat|sun)\b(?!\s*\d)/gi;
 while((m=wd.exec(text))){const name=m[2].toLowerCase();const dow=WEEKDAYS.findIndex(w=>w.startsWith(name.slice(0,3)));if(dow<0)continue;let d=nextWeekday(today,dow,false);if(m[1]?.toLowerCase()==='next'&&(parseISODate(d)!.getTime()-parseISODate(today)!.getTime())/86400000<4)d=addDays(d,7);add(m.index,m[0].length,d);}
 return hits.sort((a,b)=>a.index-b.index);
}

export function findAmounts(text:string):{cents:number;index:number;weight:number}[]{
 const out:{cents:number;index:number;weight:number}[]=[];let m:RegExpExecArray|null;
 const re=/(?:\$|\baud\s?)\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?|\b(\d+)(?:\.(\d{2}))?\s?(?:dollars|bucks)\b/gi;
 while((m=re.exec(text))){const whole=(m[1]||m[3]).replace(/,/g,'');const frac=(m[2]||m[4]||'0').padEnd(2,'0');const cents=+whole*100+ +frac;if(!cents)continue;
  const near=text.slice(Math.max(0,m.index-40),m.index+m[0].length+30).toLowerCase();
  const weight=/\b(due|total|amount|owing|pay|payment|fee|cost|costs|price|balance|charge|bill|invoice|instal+ment|quote)\b/.test(near)?2:1;
  out.push({cents,index:m.index,weight});}
 return out;
}

const flagRules:[string,RegExp][]=[
 ['consent',/\b(consent|permission (?:note|slip|form)|permission\b|sign(?:ed)? (?:the )?(?:form|note|slip))/i],
 ['payment',/\$\s?\d|\b(pay(?:ment)?|fee|cost|invoice|owing|amount due)\b/i],
 ['autopay',/\b(direct debit|auto[- ]?pay|automatic(?:ally)? (?:paid|deducted|debited|renew\w*)|will be (?:debited|deducted|charged)|auto[- ]?renew\w*)\b/i],
 ['disputed',/\b(dispute|disputing|wrong amount|incorrect|query (?:the|this) (?:bill|charge)|not right|overcharged|error on)\b/i],
 ['duplicate',/\b(duplicate|charged twice|billed twice|double charged|already (?:got|received) (?:this|that) bill|same bill (?:again|twice))\b/i],
 ['already_paid',/\b(already paid|has been paid|paid in full|payment received|thank you for your payment)\b/i],
 ['overdue',/\b(overdue|past due|final notice|reminder notice|late fee|was due|missed (?:the )?payment)\b/i],
 ['insufficient',/\b(can'?t afford|not enough (?:money|in the account)|short (?:this|until)|until pay ?day|insufficient funds|payment plan|hardship)\b/i],
 ['instalment',/\b(instal+ments?|payment plan|split (?:it|into) payments|fortnightly payments)\b/i],
 ['shared',/\b(split (?:it|the bill|with)|share(?:d)? (?:with|between)|my half|your half|partner pays|housemates?|flatmates?)\b/i],
 ['variable',/\b(estimated|estimate|usage|varies|variable|about \$|around \$|roughly)\b/i],
 ['cancelled',/\b(cancel+ed|called off|no longer (?:going ahead|on|happening)|postponed indefinitely)\b/i],
 ['rescheduled',/\b(resched\w*|moved to|changed to|new date|date change[sd]?|postponed to|now on)\b/i],
 ['booked',/\b(booked|confirmed|appointment (?:is )?(?:on|at)|your appointment|see you on|scheduled for)\b/i],
 ['needs_booking',/\b(need to book|(?:can|to) book|needs? (?:a|an|to) (?:book|appointment)|make an appointment|book (?:in|a|an)|due for (?:a|an|her|his|their)|get (?:a|an) (?:appointment|check))\b/i],
 ['referral',/\b(referral|refer(?:red)? to)\b/i],
 ['telehealth',/\b(telehealth|video (?:call|consult)|phone consult|online consult|zoom)\b/i],
 ['follow_up',/\b(follow[- ]?up|results?|review (?:appointment|in)|come back in|check in again|repeat (?:test|scan|script))\b/i],
 ['preparation',/\b(fast(?:ing)?|bring (?:your|a|the)|arrive (?:\d+|early)|prepare|don'?t eat|wear|pack)\b/i],
 ['urgent',/\b(urgent(?:ly)?|asap|emergency|right away|immediately|flooding|no hot water|no power|can'?t drive|broke down)\b/i],
 ['safety',/\b(gas (?:leak|smell)|smell(?:s)? (?:gas|burning)|spark(?:ing|s)|exposed wire|electric(?:al)? (?:shock|fault)|smoke|carbon monoxide|mould|asbestos|unsafe|dangerous|brakes?)\b/i],
 ['rental',/\b(rent(?:al|ing)|landlord|real estate|property manager|agent|lease)\b/i],
 ['warranty',/\b(warranty|guarantee|under cover|still covered)\b/i],
 ['diy',/\b(diy|myself|youtube|fix it (?:myself|ourselves)|have a go)\b/i],
 ['quote',/\b(quotes?|estimate for the (?:job|work)|quoted)\b/i],
 ['no_response',/\b(hasn'?t (?:replied|responded|got back|called)|no reply|no response|not heard|haven'?t heard|chas(?:e|ing))\b/i],
 ['repeat',/\b(again|keeps? (?:happening|breaking|leaking)|second time|third time|same problem)\b/i],
 ['application',/\b(application|apply|applied|applying)\b/i],
 ['submitted',/\b(submitted|lodged|sent (?:off|in|the)|applied|handed in|posted (?:it|the))\b/i],
 ['rejected',/\b(rejected|declined|unsuccessful|knocked back|returned (?:to me|unprocessed)|resubmit)\b/i],
 ['signature',/\b(sign(?:ature|ed)?|witness)\b/i],
 ['documents',/\b(birth certificate|passport|id\b|proof of|payslips?|documents?|certified cop(?:y|ies)|photo(?:graph)?s? required)\b/i],
 ['portal',/\b(portal|online form|mygov|website|log ?in|online at|via the app|compass|seesaw|sentral|qkr|operoo)\b/i],
 ['multi_stage',/\b(stage (?:one|two|1|2)|part (?:a|b|1|2)|then (?:an )?interview|second round|after that)\b/i],
 ['ordered',/\b(ordered|on its way|dispatched|shipped|tracking (?:number)?|out for delivery)\b/i],
 ['gift',/\b(gift|present|birthday)\b/i],
 ['budget',/\b(budget|under \$|no more than|cheap(?:est)?|afford|tight)\b/i],
 ['unavailable',/\b(out of stock|sold out|unavailable|not available|back ?order\w*|discontinued)\b/i],
 ['return',/\b(refund|send (?:it|them) back|exchange (?:it|them)|return (?:it|this|them) (?:for|to)|faulty|doesn'?t fit)\b/i],
 ['recurring',/\b(every (?:week|fortnight|month|year|term)|each (?:week|month|year|term)|weekly|monthly|fortnightly|annual(?:ly)?|yearly|regular(?:ly)?|repeat (?:prescription|script)|always run(?:s)? out)\b/i],
 ['price_increase',/\b(price (?:increase|rise|going up|went up)|premium (?:increase|has gone up|went up)|more expensive|gone up|increas\w+ (?:to|by))\b/i],
 ['comparison',/\b(compare|shop around|better deal|cheaper (?:option|provider)|switch(?:ing)? (?:to|provider))\b/i],
 ['not_wanted',/\b(don'?t (?:need|want|use) (?:it|this|that)|cancel (?:it|my|the)|not (?:going to )?renew|let it (?:lapse|go))\b/i],
 ['expired',/\b(expired|has lapsed|lapsed|out of date)\b/i],
 ['prerequisite',/\b(inspection|pink slip|safety check|eye test|medical (?:check|certificate)|cpd|before (?:you|we) can renew|need(?:s)? (?:a|an) (?:inspection|check))\b/i],
 ['unsure',/\b(not sure|unsure|maybe|might (?:go|not)|don'?t know if)\b/i],
 ['decline',/\b(can'?t (?:make it|go|come)|won'?t be (?:able|going|coming)|send (?:our )?apologies|declin(?:e|ing))\b/i],
 ['accept',/\b(we'?ll be there|we'?re going|count us in|accept(?:ed|ing)?|said yes|we'?d love to)\b/i],
 ['childcare',/\b(babysitter|childcare|someone to (?:mind|watch) the kids|kids? minded|sitter)\b/i],
 ['travel',/\b(flights?|accommodation|hotel|airbnb|drive (?:up|down|to)|road trip|interstate|overseas|book (?:the )?(?:flight|room))\b/i],
 ['dietary',/\b(dietary|allerg\w+|gluten|vegan|vegetarian|halal|kosher|nut[- ]free|dairy[- ]free)\b/i],
 ['partner',/\b(partner|husband|wife|hubby|my other half|check with (?:him|her|them))\b/i],
 ['medication',/\b(medication|medicine|script|prescription|tablets?|pills?|insulin|inhaler|ventolin|epipen)\b/i],
 ['bulk',/\b(bulk|in bulk|stock up|big (?:bag|box|pack)|costco)\b/i],
 ['substitute',/\b(substitute|instead|alternative|other brand|swap(?:ped)? (?:to|for))\b/i],
 ['changed_consumption',/\b(going through (?:it|them) faster|using (?:more|less)|ran out (?:sooner|quicker|early)|new puppy|growing)\b/i],
 ['essential',/\b(essential|can'?t (?:run|be without)|must not run out|critical|insulin|nappies|formula)\b/i],
 ['multiple_children',/\b(both (?:kids|children|girls|boys)|all (?:three|the kids)|each child|siblings?|twins)\b/i],
 ['parent_attendance',/\b(parents? (?:are )?(?:welcome|invited|needed|helpers?)|parent helpers?|volunteers? needed|come along|parent (?:attendance|to attend))\b/i],
 ['medical_requirement',/\b(medical (?:form|info|information|details)|medication form|action plan|allerg\w+|asthma|epipen)\b/i],
 ['conflict',/\b(same day as|clash(?:es)?|conflict(?:s)? with|double[- ]booked|also on)\b/i],
 ['changed_date',/\b(new date|date (?:has )?changed|moved to|postponed|rescheduled)\b/i],
];
export function findFlags(text:string){return flagRules.filter(([,re])=>re.test(text)).map(([k])=>k);}

export function findItems(text:string):string[]{
 const m=/\b(?:need(?:s)?(?: to (?:bring|buy|get|pack))?|bring|pack|buy|get|pick up|grab|out of|run(?:ning)? (?:low on|out of)|low on)\s*:?\s+([^.\n]+)/i.exec(text);if(!m)return [];
 return m[1].split(/,|\band\b|\+|\//).map(s=>s.replace(/^\s*(?:a|an|the|some|their|your|our|new)\s+/i,'').trim()).filter(s=>s&&s.length<40&&!/\$|\d{1,2}(?:st|nd|rd|th)?\s+[a-z]/i.test(s)).slice(0,12);
}
const providerWords=/\b(plumber|electrician|mechanic|builder|handyman|landlord|property manager|real estate|agent|insurer|insurance company|dentist|doctor|gp|dr\.? [a-z]+|physio|optometrist|vet|council|school|teacher|centrelink|medicare|ato|bank|airline|courier|store|shop|contractor|tradie|locksmith|roofer|pest control|carpet cleaner|technician|landscaper)s?\b/i;
export function findProvider(text:string){const m=providerWords.exec(text);return m?m[1].replace(/^dr\.?\s+/i,'Dr ').replace(/\b\w/g,c=>c.toUpperCase()):null;}
export function findPerson(text:string){const m=/\b([A-Z][a-z]{2,})'s\b/.exec(text)||/\bfor ([A-Z][a-z]{2,})\b/.exec(text);return m&&!/^(The|This|Your|Our|Year|School|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mum|Dad)$/.test(m[1])?m[1]:null;}

// Phones type curly quotes; every rule here is written for plain ones.
export const normaliseText=(t:string)=>t.replace(/[\u2018\u2019\u02BC]/g,"'").replace(/[\u201C\u201D]/g,'"');
export function extractEntities(raw:string,today:string):LoadEntities{
 const text=normaliseText(raw);
 const dates=findDates(text,today);const amounts=findAmounts(text);
 const due=dates.find(d=>d.role==='due');const rsvp=dates.find(d=>d.role==='rsvp');const expiry=dates.find(d=>d.role==='expiry');const event=dates.find(d=>d.role==='event');
 const best=[...amounts].sort((a,b)=>b.weight-a.weight||a.index-b.index)[0];
 const time=/\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i.exec(text);
 const ref=/\b(?:ref(?:erence)?|account|acct|customer|invoice|crn)\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9-]{5,})\b/i.exec(text);
 return {
  amountCents:best?.cents??null,amounts:amounts.map(a=>a.cents),
  dueDate:due?.iso??null,eventDate:event?.iso??null,eventEndDate:event?.end??null,rsvpDate:rsvp?.iso??null,expiryDate:expiry?.iso??null,
  time:time?`${pad((+time[1]%12)+(time[3].toLowerCase()==='pm'?12:0))}:${time[2]||'00'}`:null,
  person:findPerson(text),provider:findProvider(text),items:findItems(text),reference:ref?ref[1]:null,flags:findFlags(text),
 };
}
