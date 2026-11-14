// Tell Bear once: one message (typed or spoken) becomes a set of sorted responsibilities. Each gets a clear title, one of the
// six areas, a traffic light and a timeframe. Fixed rules do the dates and the traffic light, so the same words always give
// the same answer; a model (when connected) may help with wording and with telling things apart, never with the deadline maths.
// Nothing is invented: a date is "stated" only when the person said it; anything Bear proposes is kept apart as a suggestion.
import {addDays,daysBetween,parseAUDate,parseISODate,toISODate} from '../domain/dates.ts';
import {areaKeys,type AreaKey} from '../domain/types.ts';
import {splitTodos} from './split-todos.ts';

export type Light='red'|'amber'|'green';
export interface Sorted{
 title:string;original:string;domain:AreaKey;secondary:AreaKey[];
 deadline:string|null;            // a date the person stated (ISO), else null
 deadlineSource:'stated'|null;
 window:string|null;              // a loose timeframe the person stated ("next month"), never treated as a deadline
 windowBy:string|null;            // the last day of that window, for the traffic light only
 suggestedStart:string|null;      // Bear's proposal: when to start, or a target day when no date was given
 urgency:Light|null;              // from the person's own words ("urgent", "tonight", "no rush"), apart from any date
 nextAction:string|null;light:Light;reason:string;
}

// ---------- dates the person said ----------
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_RE='(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const dow=(iso:string)=>parseISODate(iso)!.getDay();
const endOfMonth=(iso:string,plus:number)=>{const d=parseISODate(iso)!;return toISODate(new Date(d.getFullYear(),d.getMonth()+1+plus,0,12));};
export interface SaidDate{date:string|null;window:string|null;windowBy:string|null;span:[number,number]|null}
export function saidDate(text:string,today:string):SaidDate{
 const none:SaidDate={date:null,window:null,windowBy:null,span:null};
 const lead='(?:(?:due|by|before|until|on|for|this|at)\\s+|is\\s+due\\s+|are\\s+due\\s+)?';
 const hit=(re:RegExp)=>{const m=re.exec(text);return m?{m,span:[m.index,m.index+m[0].length] as [number,number]}:null;};
 let h;
 if((h=hit(new RegExp(`\\b${lead}(today|tonight|this (?:morning|afternoon|evening)|end of (?:the )?day|eod)\\b`,'i'))))return {date:today,window:null,windowBy:null,span:h.span};
 if((h=hit(new RegExp(`\\b${lead}(tomorrow|tmrw|tomoz)(?: (?:morning|afternoon|evening|night))?\\b`,'i'))))return {date:addDays(today,1),window:null,windowBy:null,span:h.span};
 if((h=hit(/\b(?:the )?day after tomorrow\b/i)))return {date:addDays(today,2),window:null,windowBy:null,span:h.span};
 if((h=hit(/\bin (\d{1,2}|a|an|one|two|three|four|five|six) (day|week)s?\b/i))){const w:Record<string,number>={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6};const n=w[h.m[1].toLowerCase()]??Number(h.m[1]);return {date:addDays(today,n*(/week/i.test(h.m[2])?7:1)),window:null,windowBy:null,span:h.span};}
 if((h=hit(new RegExp(`\\b${lead}(next\\s+|this\\s+(?:coming\\s+)?)?${DAY_RE}\\b(?!\\s*(?:s\\b|'s))`,'i')))){
  const target=DAYS.findIndex(d=>d.startsWith(h!.m[2].toLowerCase().slice(0,3)));let add=(target-dow(today)+7)%7;if(add===0)add=7;
  return {date:addDays(today,add),window:null,windowBy:null,span:h.span};
 }
 const explicit=/\b(?:(?:due|by|before|until|on)\s+)?(\d{1,2}(?:st|nd|rd|th)?[\/.\- ](?:\d{1,2}|[A-Za-z]{3,9})(?:[\/.\- ,]+\d{2,4})?|(?:[A-Za-z]{3,9})\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{4}-\d{2}-\d{2})\b/i.exec(text);
 if(explicit){const year=parseISODate(today)!.getFullYear();let d=parseAUDate(explicit[1],year);if(d&&!/\d{4}/.test(explicit[1])&&(daysBetween(today,d)??0)<-30)d=parseAUDate(explicit[1],year+1);if(d)return {date:d,window:null,windowBy:null,span:[explicit.index,explicit.index+explicit[0].length]};}
 // Loose timeframes: kept as the person's words, never turned into a deadline.
 if((h=hit(/\b(?:(?:by|before|for)\s+)?this weekend\b/i))){const add=(6-dow(today)+7)%7;return {date:null,window:'This weekend',windowBy:addDays(today,add+1),span:h.span};}
 if((h=hit(/\b(?:(?:by|before|for|some ?time)\s+)?(?:this week|(?:the )?end of (?:the )?week)\b/i))){const add=(7-dow(today))%7;return {date:null,window:'This week',windowBy:addDays(today,add),span:h.span};}
 if((h=hit(/\b(?:(?:by|before|for|some ?time)\s+)?next week\b/i))){const add=(7-dow(today))%7;return {date:null,window:'Next week',windowBy:addDays(today,add+7),span:h.span};}
 if((h=hit(/\b(?:(?:by|before|for|some ?time)\s+)?(?:this month|(?:the )?end of (?:the )?month)\b/i)))return {date:null,window:'This month',windowBy:endOfMonth(today,0),span:h.span};
 if((h=hit(/\b(?:(?:by|before|for|some ?time)\s+)?next month\b/i)))return {date:null,window:'Next month',windowBy:endOfMonth(today,1),span:h.span};
 if((h=hit(/\b(?:soon|shortly|in the next few days)\b/i)))return {date:null,window:'Soon',windowBy:addDays(today,10),span:h.span};
 return none;
}

// ---------- which of the six areas: by what the thing is FOR ----------
const HEALTH=/\b(dentist|dental|doctor|dr\.?|gp|physio|chiro|medical|medication|medicine|prescription|script|pharmacy|chemist|vaccin\w*|immunis\w*|optometrist|eye test|hospital|specialist|paediatrician|pediatrician|psycholog\w*|counsell\w*|therap\w*|blood test|scan|x-?ray|check-?up|health|skin check|mammogram|referral|ndis)\b/i;
const MONEY=/\b(bill|invoice|pay(?:ment)?|bank|banking|tax|ato|bas|insurance|refund|budget|super(?:annuation)?|rego|registration fee|rates|loan|mortgage|rent|subscription|fees?|fine|bpay|transfer|centrelink|medicare claim|claim|credit card|debt|accountant|payslip)\b/i;
const WORK=/\b(work|report|manager|boss|client|colleague|team|office|presentation|timesheet|meeting|project|proposal|grant|hr|performance review|roster|shift|conference|deadline for work|my students|lecture|marking|ticket|deploy|stakeholder|quarterly|kpi)\b/i;
const FAMILY=/\b(school|kinder|kindy|childcare|daycare|permission|excursion|incursion|uniform|lunchbox|homework|parent[- ]teacher|teacher|kids?|children|child|son|daughter|baby|toddler|mum|mom|mother|dad|father|grandma|grandpa|nan|nanna|pop|grandparents?|partner|husband|wife|in-?laws?|sister|brother|aunt|uncle|cousin|niece|nephew|family|birthday|anniversary|christening|swimming lessons?|soccer|netball|footy|ballet|playdate)\b/i;
const HOME=/\b(tap|plumber|electrician|handyman|repair|leak\w*|clean\w*|laundry|washing|lawn|mow|garden|bins?|groceries|grocery|supermarket|car service|mechanic|tyres?|internet|nbn|landlord|real estate|furniture|appliance|dishwasher|fridge|oven|pest|gutter|smoke alarm|vet|dog|cat|pet|milk|bread|eggs|nappies|toilet paper|shopping list|house|kitchen|bathroom|bedroom|garage|declutter|electricity connection|gas connection|removalist|strata)\b/i;
const ME=/\b(friend|gym|run|yoga|pilates|hobby|haircut|hairdresser|book club|read|meditat\w*|self[- ]care|massage|catch[- ]?up|coffee with|dinner|drinks|date night|holiday|trip|course|guitar|paint\w*|journal|walk)\b/i;
const order:[AreaKey,RegExp][]=[['health',HEALTH],['money',MONEY],['work',WORK],['family',FAMILY],['home',HOME],['me',ME]];
export function classify(text:string,children:string[]=[]):{domain:AreaKey;secondary:AreaKey[]}{
 const hits=order.filter(([,re])=>re.test(text)).map(([k])=>k);
 const kid=children.some(n=>n&&new RegExp(`\\b${n.replace(/[^\w]/g,'')}\\b`,'i').test(text));if(kid&&!hits.includes('family'))hits.push('family');
 if(!hits.length)return {domain:'me',secondary:[]};
 let domain=hits[0];
 // A payment that is for a child's school thing, or a family occasion, is still about money only when paying is the point.
 if(domain==='money'&&hits.includes('family')&&/\b(permission|form|note|slip)\b/i.test(text)&&!/^\s*pay\b/i.test(text))domain='family';
 if(domain==='money'&&/\bbirthday|anniversary\b/i.test(text)&&!/\bpay|bill|invoice\b/i.test(text))domain='family';
 // "Dinner" with family is a family thing; with work people it is work. Otherwise it stays with Me.
 if(domain==='me'&&hits.length>1)domain=hits.find(h=>h!=='me')||'me';
 return {domain,secondary:hits.filter(h=>h!==domain)};
}

// ---------- a clear, action-led title, with nothing added that the person didn't say ----------
const FILLER=/^(?:(?:and|then|also|plus|oh|ok|okay|so|um|uh|actually|first|next|finally|lastly)\b[\s,]*)*(?:(?:i|we)\s+(?:(?:also|still|really|urgently|desperately|just|probably)\s+)*(?:need|have|want|ought|should|must|gotta|got)\s*(?:to\s+)?|(?:i|we)(?:'|’)?ve\s+got\s+to\s+|(?:please\s+)?remind\s+me\s+(?:to\s+|about\s+)|don(?:'|’)?t\s+(?:let\s+me\s+)?forget\s+(?:to\s+|about\s+)?|remember\s+to\s+|need\s+to\s+|have\s+to\s+|got\s+to\s+|gotta\s+|please\s+|also\s+|there(?:'|’)?s\s+|there\s+is\s+)*/i;
const VERB_LED=/^(?:call|ring|phone|text|email|message|buy|get|grab|pick|drop|book|rebook|schedule|reschedule|organise|organize|arrange|plan|pay|renew|cancel|return|send|post|order|fix|clean|wash|pack|sign|fill|complete|submit|lodge|check|find|ask|tell|make|cook|prepare|take|bring|collect|register|enrol|enroll|apply|update|change|transfer|print|write|read|finish|start|sort|tidy|mow|water|feed|walk|visit|see|meet|confirm|reply|respond|follow|chase|look|research|compare|set|put|move|replace|repair|service|donate|sell|wrap|bake|do|speak|talk|contact|invite|rsvp|review|file|claim|go|attend|drive|clear|chase|practise|practice|study|download|upload|swap|exchange|hire|decide|choose)\b/i;
const cap=(s:string)=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
const the=(s:string)=>/^(?:the|a|an|my|our|your|his|her|their|\w+(?:'|’)s)\b/i.test(s)?s:'the '+s;
export function titleFor(original:string,span:[number,number]|null):string{
 let t=original;
 // The date is kept as a field; a date hanging off the end (or "X is due Monday") comes out of the title.
 if(span){const before=t.slice(0,span[0]),after=t.slice(span[1]);if(!after.trim()||/^[\s,.!]*$/.test(after))t=before;else if(!before.trim())t=after;}
 // "Remind me when X is on" is, for the person, a thing to find out: say so, and keep the whole question.
 {const m=/^(?:please\s+)?(?:remind me|let me know|tell me|alert me|notify me)\s+(when|what (?:date|day|time)|where|if|whether)\s+(.+)$/i.exec(original.trim().replace(/[?.!\s]+$/,''));if(m)return cap(`Find out ${m[1].toLowerCase()} ${m[2]}`).slice(0,90);}
 t=t.replace(FILLER,'').replace(/\s+(?:is|are|was|were)\s+(?:now\s+)?(?:due|overdue|coming up|on|urgent)\s*$/i,'').replace(/[\s,]+(?:some ?time|some ?day|eventually|at some point|when(?:ever)? i (?:can|get (?:a )?(?:chance|time))|asap|urgently|no rush)\s*$/i,'').replace(/\s+(?:is|are)\s*$/i,'').replace(/[\s,;:.!\-–]+$/,'').replace(/^[\s,;:.\-–]+/,'').trim();
 if(!t)t=original.trim();
 if(VERB_LED.test(t))return cap(t).slice(0,90);
 const low=t.toLowerCase();
 if(/\b(permission (?:form|slip|note)|consent form|enrolment form|form|paperwork|application)\b/.test(low))return ('Complete and return '+the(t)).slice(0,90);
 if(/\b(bill|invoice|rates|rego|fees?|fine|rent)\b/.test(low))return ('Pay '+the(t)).slice(0,90);
 if(/\b(birthday|anniversary|party|celebration)\b/.test(low))return ('Plan '+the(t)).slice(0,90);
 if(/\b(appointment|dentist|doctor|gp|physio|check-?up|haircut|service)\b/.test(low))return ('Book '+the(/appointment|service|check-?up|haircut/.test(low)?t:t+' appointment')).slice(0,90);
 if(/\b(report|assignment|presentation|tax return|essay|proposal)\b/.test(low))return ('Finish '+the(t)).slice(0,90);
 if(/\b(prescription|parcel|package|dry cleaning|order)\b/.test(low))return ('Pick up '+the(t)).slice(0,90);
 return cap(t).slice(0,90);
}

// ---------- the traffic light: from the date and the person's own words, never from "it sounds important" ----------
const RED_WORDS=/\b(urgent(?:ly)?|asap|a\.s\.a\.p|straight away|right away|right now|immediately|emergency|overdue|final notice|last day|disconnect\w*|cut off|deadline is today|can(?:'|’)?t wait|unsafe|dangerous|gas leak|smoke|bleeding)\b/i;
const AMBER_WORDS=/\b(soon|shortly|coming up|important|don(?:'|’)?t forget|need to get onto)\b/i;
const GREEN_WORDS=/\b(no rush|no hurry|whenever|when(?:ever)? i (?:can|get (?:a )?(?:chance|time))|some ?time|some ?day|one day|eventually|at some point|low priority|not urgent|can wait|if i get time|would be nice)\b/i;
export function urgencyOf(text:string):Light|null{return RED_WORDS.test(text)?'red':GREEN_WORDS.test(text)?'green':AMBER_WORDS.test(text)?'amber':null;}
export interface LightInput{deadline:string|null;windowBy?:string|null;urgency?:Light|null;person?:Light|null;soonByNature?:boolean}
export const soonByNature=(title:string)=>/\b(bill|invoice|rego|rates|fine|pay|reply|respond|rsvp|get back to|dentist|doctor|gp|appointment|prescription|permission|form|renew)\b/i.test(title);
export function lightFor(i:LightInput,today:string):{light:Light;reason:string}{
 const days=i.deadline?daysBetween(today,i.deadline):null;
 const byDate:{light:Light;reason:string}|null=days===null?null:days<0?{light:'red',reason:'Past its date'}:days===0?{light:'red',reason:'Due today'}:days===1?{light:'red',reason:'Due tomorrow'}:days<=14?{light:'amber',reason:`Due in ${days} days`}:{light:'green',reason:'Not due for a while'};
 // The person's own call stands, unless the deadline has arrived: that is the one thing that overrides it.
 if(i.person){if(byDate?.light==='red'&&i.person!=='red')return byDate;return {light:i.person,reason:'You said so'};}
 if(byDate?.light==='red')return byDate;
 if(i.urgency==='red')return {light:'red',reason:'You said it’s urgent'};
 if(byDate?.light==='amber')return byDate;
 const w=i.windowBy?daysBetween(today,i.windowBy):null;
 if(w!==null&&w<=14)return {light:'amber',reason:'Coming up'};
 if(i.urgency==='green')return {light:'green',reason:'No rush'};
 if(i.urgency==='amber')return {light:'amber',reason:'You said soon'};
 if(byDate)return byDate;
 if(w!==null)return {light:'green',reason:'Not for a while'};
 // No date at all: things that usually cost something if left (a bill, a reply someone is waiting on, an appointment to book,
 // a form) are worth doing soon; everything else can wait.
 return i.soonByNature?{light:'amber',reason:'Worth doing soon'}:{light:'green',reason:'No date, no rush'};
}

// ---------- a proposal, kept apart from anything the person said ----------
const NEEDS_PREP=/\b(form|report|plan|organise|organize|prepare|presentation|application|assignment|party|celebration|tax|pack|gift|present|trip|holiday)\b/i;
const QUICK_WIN=/\b(book|call|ring|phone|reply|respond|email|message|text|rsvp|confirm|renew|cancel)\b/i;
const weekdayOnOrAfter=(iso:string)=>{let d=iso;while([0,6].includes(dow(d)))d=addDays(d,1);return d;};
export function suggestStart(title:string,deadline:string|null,light:Light,today:string):string|null{
 if(deadline){const days=daysBetween(today,deadline)??0;if(days>=3&&NEEDS_PREP.test(title)){const lead=Math.min(Math.ceil(days/2),5);const d=addDays(deadline,-lead);return d>today?d:addDays(today,1);}return null;}
 if(light==='green'||light==='red')return null;
 return QUICK_WIN.test(title)||NEEDS_PREP.test(title)?weekdayOnOrAfter(addDays(today,2)):null;
}
// What Bear can do next, said only when Bear can really do it. Never worded as done.
export function nextActionFor(title:string):string|null{
 if(/\b(permission (?:form|slip|note)|consent form|form)\b/i.test(title))return 'Add the form and Bear will fill in what it can';
 if(/\b(reply|respond|email|message|write to)\b/i.test(title))return 'Bear can draft the words for you to send';
 return null;
}

export function sortOne(original:string,today:string,children:string[]=[]):Sorted{
 const said=saidDate(original,today);const title=titleFor(original,said.span);const {domain,secondary}=classify(original,children);
 const urgency=urgencyOf(original);const {light,reason}=lightFor({deadline:said.date,windowBy:said.windowBy,urgency,soonByNature:soonByNature(title)},today);
 return {title,original:original.trim(),domain,secondary,deadline:said.date,deadlineSource:said.date?'stated':null,window:said.window,windowBy:said.windowBy,suggestedStart:suggestStart(title,said.date,light,today),urgency,nextAction:nextActionFor(title),light,reason};
}

// ---------- one message, many things ----------
// A new responsibility starts at a new action ("book…", "pay…") or at a statement about a thing with its own timing
// ("Ava's permission form is due Monday", "Mum's birthday is next month").
const CLAUSE=/\b(?:is|are|'s|’s)\s+(?:due|coming up|on|next|this|tomorrow|today|tonight|overdue|in \d)|\b(?:is|are)\s+(?:due|overdue)\b|\bneeds?\s+(?:to\s+be\s+)?\w+|\bdue\s+(?:\w+\s+)?(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|next|this|\d)/i;
const NOT_A_LIST=/\b(?:subject:|from:|dear\b|hi (?:parents|families|all|everyone)|regards|newsletter|account number|bpay|biller code|unsubscribe)\b/i;
const led=(s:string)=>VERB_LED.test(s.replace(/^[\s\-–—•*·>]+/,'').replace(/^\(?\d{1,2}[.):]\s*/,'').replace(FILLER,''));
const standsAlone=(s:string)=>led(s)||CLAUSE.test(s);
export function segment(text:string,max=12):string[]{
 const src=text.trim();if(src.length<8||src.length>1200||NOT_A_LIST.test(src))return [src];
 const hard=src.replace(/\s+(?=\(?\d{1,2}[.)]\s+\S)/g,'\n').split(/\n+/).map(l=>l.replace(/^[\s\-–—•*·>]+/,'').replace(/^\(?\d{1,2}[.):]\s*/,''))
  .flatMap(l=>l.split(/;\s*|(?<=[a-z0-9)’'"])[.!?]\s+(?=\S)/i)).map(s=>s.trim()).filter(Boolean);
 const parts:string[]=[];
 for(const piece of hard){
  const re=/\s*,\s*(?:and\s+|then\s+|also\s+|plus\s+)?|\s+(?:and\s+then|and\s+also|and|then|also|plus)\s+/gi;
  const cuts:number[]=[0];const ends:number[]=[];let m;while((m=re.exec(piece))){ends.push(m.index);cuts.push(m.index+m[0].length);}ends.push(piece.length);
  let start=0,end=ends[0];const out:string[]=[];
  for(let i=1;i<cuts.length;i++){const next=piece.slice(cuts[i],ends[i]);if(standsAlone(next)){out.push(piece.slice(start,end));start=cuts[i];}end=ends[i];}
  out.push(piece.slice(start,end));parts.push(...out);
 }
 const cleaned=parts.map(s=>s.replace(/[\s,;.]+$/,'').trim()).filter(Boolean);
 if(cleaned.length<2||cleaned.length>max||!cleaned.every(standsAlone)||cleaned.some(c=>c.replace(FILLER,'').length<4)){const strict=splitTodos(src);return strict.length>1?strict:[src];}
 return cleaned;
}
export function sortMessage(text:string,today:string,children:string[]=[]):Sorted[]{return segment(text).map(p=>sortOne(p,today,children));}
export const isArea=(v:unknown):v is AreaKey=>typeof v==='string'&&(areaKeys as readonly string[]).includes(v);

// ---------- "Actually, the dentist is urgent": one sentence changes one thing ----------
export interface Correction{index:number;light?:Light;domain?:AreaKey;deadline?:string|null}
const STOP=new Set('the a an my our to for of and is are it that this actually please make can you could bear one thing task move put change set should be not no'.split(' '));
export function parseCorrection(text:string,items:{title:string}[],today:string):Correction|null{
 const t=text.toLowerCase();
 const light:Light|undefined=/\b(urgent|red|asap|top priority|most important|right away|today)\b/.test(t)&&!/\bnot (?:that )?urgent\b/.test(t)?'red':/\b(can wait|not (?:that )?urgent|no rush|green|low priority|whenever|later)\b/.test(t)?'green':/\b(amber|orange|coming up|soon(?:ish)?|this week|medium)\b/.test(t)?'amber':undefined;
 const dm=/\b(?:is|it(?:'|’)?s|as|to|under|into|in)\s+(?:a\s+)?(work|family|home|money|health|me)\b(?:\s+(?:thing|one|task|stuff))?/.exec(t)||/\b(work|family|home|money|health|me)\s+(?:thing|one|task|stuff)\b/.exec(t);const domain=dm?dm[1] as AreaKey:undefined;
 const said=/\b(due|by|on|before|moved to|is now)\b/.test(t)?saidDate(text,today):null;const deadline=said?.date||undefined;
 if(!light&&!domain&&!deadline)return null;
 const words=t.replace(/[^a-z0-9’' ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!STOP.has(w)&&!/^(urgent|red|amber|green|asap|priority|work|family|home|money|health|wait|rush|soon|due)$/.test(w));
 let best=-1,score=0;items.forEach((it,i)=>{const low=it.title.toLowerCase();const s=words.filter(w=>low.includes(w.replace(/(?:'|’)s$/,''))).length;if(s>score){score=s;best=i;}});
 if(best<0){if(items.length===1)best=0;else return null;}
 return {index:best,...(light?{light}:{}),...(domain?{domain}:{}),...(deadline?{deadline}:{})};
}

// ---------- an answer to Bear is not a to-do ----------
// "No", "that's all", "thanks", "yes": words said back to Bear in conversation. They never become tasks.
const CLOSE_WORDS="no+|nope|nah|na|no thanks|no thank you|not now|not really|not today|not at the moment|nothing|nothing else|nothing more|none|that(?:'|’)?s (?:all|it|everything)|that is (?:all|it|everything)|that will do|that(?:'|’)?ll do|all good|all done|all sorted|i(?:'|’)?m (?:good|done|all good|all set|fine)|im (?:good|done|fine)|we(?:'|’)?re (?:good|done)|done|finished|bye|goodbye|see ya|good ?night|thanks|thank you|thankyou|ta|cheers|ok(?:ay)?";
const POLITE_WORDS="bear|mama bear|for now|for today|at the moment|right now|i think";
// One or more closing phrases in a row ("nope, all good, thanks Bear"), and nothing else.
const CLOSING=new RegExp(`^(?:${CLOSE_WORDS})(?:\\s+(?:${CLOSE_WORDS}|${POLITE_WORDS}))*$`,'i');
const AFFIRM=/^(?:yes|yep|yeah|yup|ya|sure|ok|okay|k|yes please|please|go on|go ahead|one more|a few more|there(?:'|’)?s more|i do|i have more|hang on|wait|hmm+|um+|uh+|hi|hello|hey|test|testing)$/i;
export function replyKind(text:string):'closing'|'more'|null{
 const t=text.trim().replace(/[\s.!?,…]+$/,'').replace(/[,;.!]+/g,' ').replace(/\s+/g,' ');
 if(!t||t.length>60)return null;
 if(AFFIRM.test(t))return 'more';
 if(CLOSING.test(t))return 'closing';
 return null;
}
