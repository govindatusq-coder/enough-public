// "Search the internet for when X is on and remind me": the person is asking Bear to find something out, not to file a to-do
// for them to do the finding. This is the pure part: spotting the ask, and reading a web answer into something Bear can show.
// What comes back from the web is never saved as a date until the person accepts it, and always carries where it came from.
import {z} from 'zod';
import {isValidISODate} from '../domain/dates.ts';

// Only an explicit ask to go and find out. "Call the school to find out about camp" is the person's own errand.
const ASK=/^(?:(?:hey |hi |ok |okay )?(?:bear|mama bear)[,:]?\s+)?(?:(?:can|could|would) you\s+(?:please\s+)?|please\s+)?(?:(?:do a |run a )?(?:web |internet |google |online )?search\b|search (?:the )?(?:internet|web|net|online)\b|google\b|look (?:it |this |that )?up\b|look up\b|look online\b|find out\b|check online\b|research\b|find me\b|find the (?:date|time|price|cost|hours|address|number|website|link)\b)/i;
// The same ask without the word "search": a reminder for something whose date the person doesn't know ("remind me when the next
// India v NZ ODI is on"), or a plain question about the world ("when do the school holidays start?"). Things only the person
// knows ("when I get home", "when is my rego due") are not questions for the web.
const OWN=/\b(?:i|we|my|our|me|us|you|your|mum|mom|dad|he|she|they)\b/i;
const HAPPENS='(?:is|are|will be|gets?|goes?|go|starts?|begins?|opens?|closes?|ends?|finish(?:es)?|comes? out|is released|releases?|airs?|is on|are on|happens?|takes? place|kicks? off|drops?|launch(?:es)?|returns?|plays?|play|on sale)';
const REMIND_WHEN=new RegExp(`^(?:please\\s+)?(?:remind me|let me know|tell me|alert me|notify me|give me a reminder|set a reminder)\\s+(?:for\\s+)?(?:of\\s+)?(?:about\\s+)?(when|what (?:date|day|time)|where|if|whether)\\s+(.+)$`,'i');
const QUESTION=/^(?:when(?:'|’)?s?|what(?:'|’)?s?|where(?:'|’)?s?|which|how (?:much|many|long|far|old|do|does|to|can)|is there|are there|is|are|does|do|did|can|will|was|were)\s+(.+)$/i;
// Things around the house and the family that the web cannot know about.
const HOUSEHOLD=/\b(?:form|note|slip|keys?|bins?|lunchbox|uniform|homework|pick(?:ing)? ?up|drop(?:ping)? ?off|list|fridge|washing|dinner tonight|password|charger|wallet|phone)\b/i;
export function asksAboutTheWorld(text:string):boolean{
 const t=text.trim().replace(/[?.!\s]+$/,'');if(t.length<12||t.length>300)return false;
 const r=REMIND_WHEN.exec(t);
 if(r)return !OWN.test(r[2])&&new RegExp(`\\b${HAPPENS}\\b`,'i').test(r[2]);
 const q=QUESTION.exec(t);
 // In "how do I renew a passport" the "I" is anyone: it is still a question about the world.
 if(q){const rest=/^how (?:do|does|to|can)\b/i.test(t)?q[1].replace(/^(?:i|we|you)\s+/i,''):q[1];return !OWN.test(rest)&&!HOUSEHOLD.test(rest)&&rest.split(/\s+/).length>=2;}
 // Anything else phrased as a question ("best time to visit Uluru?") is one too, unless it is about the person's own things.
 return /\?$/.test(text.trim())&&!OWN.test(t)&&!HOUSEHOLD.test(t)&&t.split(/\s+/).length>=3;
}
export function asksToFindOut(text:string,names:string[]=[]):boolean{
 // A question that names one of the person's own children is about the family, not the world.
 if(names.some(n=>n&&new RegExp(`\\b${n.replace(/[^\w]/g,'')}\\b`,'i').test(text)))return false;
 if(asksAboutTheWorld(text))return true;
 const t=text.trim();if(t.length<12||t.length>400)return false;
 // Something to find out about, not just "search" on its own, and not a job for the person ("research schools with my partner").
 // "Research" on its own is usually the person's own job ("research project due Friday"); it counts only with a question.
 if(/^(?:please\s+)?research\b/i.test(t)&&!/\b(when|what|where|who|which|how|whether)\b/i.test(t))return false;
 // An explicit ask to search, with something to search for.
 return ASK.test(t)&&t.replace(ASK,'').trim().split(/\s+/).filter(Boolean).length>=2;
}

export interface Source{title:string;url:string}
export interface Finding{answer:string;subject:string;date:string|null;sources:Source[]}
export const findingSchema=z.object({
 found:z.boolean(),
 answer:z.string().trim().max(600),
 subject:z.string().trim().max(80),           // a short name for the thing, for a reminder title
 date:z.string().nullable(),                  // one specific day (ISO), only if a source states it
 sourceUrls:z.array(z.string()).max(5),
}).strict();
export const lookupSystemPrompt=(today:string)=>`You look things up on the web for a busy parent in Australia. Today is ${today}.
Search, then reply with ONLY a JSON object, no other text:
{"found": boolean, "answer": string, "subject": string, "date": string|null, "sourceUrls": string[]}
- found: true only if a search result actually states the answer. If results are unclear, conflicting, about a different year or place, or only rumours, set found to false.
- answer: one or two plain sentences saying what you found. Say so plainly when a date is not announced yet. Never guess.
- subject: a short name for the thing (for example "Red Bull Soapbox Race"), using the person's wording.
- For questions that are not about a date (prices, opening hours, how to do something, what something is), answer the question and set date to null.
- date: a single day as YYYY-MM-DD, only when a source states that exact day for the right year and place. Otherwise null. For a multi-day event give the first day.
- sourceUrls: the pages your answer rests on, most direct first. Prefer the organiser's own site.
The person's message may also ask for a reminder; ignore that part, it is handled separately.`;

// The model's reply (text) plus the pages the search really returned -> a finding, or null when there is nothing reliable.
export function readFinding(text:string,returned:Source[],today:string):Finding|null{
 const m=/\{[\s\S]*\}/.exec(text);if(!m)return null;
 let raw:unknown;try{raw=JSON.parse(m[0]);}catch{return null;}
 const p=findingSchema.safeParse(raw);if(!p.success||!p.data.found||!p.data.answer)return null;
 // Only pages the search actually returned count as sources: a link the model made up is dropped.
 const key=(u:string)=>u.replace(/^https?:\/\/(www\.)?/,'').replace(/[/#?]+$/,'').toLowerCase();
 const byKey=new Map(returned.map(s=>[key(s.url),s]));
 const sources=p.data.sourceUrls.map(u=>byKey.get(key(u))).filter((s):s is Source=>!!s).filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i).slice(0,3);
 // If the model's links don't match, the pages the search itself returned still stand behind the answer.
 if(!sources.length)sources.push(...returned.filter((s,i,a)=>a.findIndex(x=>x.url===s.url)===i).slice(0,2));
 if(!sources.length)return null;   // an answer with no real page behind it is not shown as a finding
 const date=p.data.date&&isValidISODate(p.data.date)&&p.data.date>=today?p.data.date:null;
 return {answer:p.data.answer,subject:p.data.subject||'',date,sources};
}
export type Researcher=(question:string,today:string)=>Promise<{finding:Finding|null;usage:{inputTokens:number;outputTokens:number}|null;searches:number;model:string}>;
export const DAILY_LOOKUPS=20;
