import {fillMinutes,extraFor} from './opportunities.ts';
import {contextCards,momentLabels,type LifeMap} from './life-map.ts';
import {situationLabels,type Ranked} from './opportunity-engine.ts';
import type {Situation} from './opportunity-log.ts';

/**
 * Card copy. The deterministic template is always available and always
 * correct; AI wording is an optional layer that must pass `validatePersonalised`
 * or it is thrown away.
 */
export type CardCopy={title:string;body:string;why:string;minutes:number;extraMinutes:number;source:'template'|'ai'};

export function cardCopy(r:Ranked):CardCopy{
 const o=r.opportunity;
 return {title:o.title,body:fillMinutes(r.known?o.action:o.descriptionTemplate,r.minutes),why:r.signals[0]||(o.pairsWith?`It fits inside ${o.pairsWith}.`:'It’s a small one that fits most days.'),minutes:r.minutes,extraMinutes:r.extraMinutes,source:'template'};
}
export const movementLabel=(c:Pick<CardCopy,'minutes'>)=>`${c.minutes} min movement`;
export const extraLabel=(c:Pick<CardCopy,'extraMinutes'>)=>c.extraMinutes===0?'0 extra min':`About ${c.extraMinutes} extra min`;
export const extraLabelLong=(c:Pick<CardCopy,'extraMinutes'>)=>c.extraMinutes===0?'0 extra minutes from your day':`About ${c.extraMinutes} extra minutes`;

/** Words Enough never uses: gym language, guilt and hype. Checked on library copy and AI output. */
export const bannedCopy=/\b(work ?outs?|calories?|burn|crush|no excuses|fitness journey|best self|10,?000 steps|hacks?|get active|gym|reps|squats?|lunges?|push-?ups?|burpees?|sweat it out|beast mode|smash)\b/i;
/** Claims Enough cannot back up without calendar, location or weather data. */
const fakeContext=/\b(today at|tonight at|monday|tuesday|wednesday|thursday|friday|saturday|sunday|o'?clock|calendar|schedule|forecast|sunny|raining|rain|weather is|heatwave|daughter|son|husband|wife|boyfriend|girlfriend|km|kilomet\w*|met(re|er)s?|miles?|near you|your area|your suburb)\b|\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\s?(am|pm)\b/i;
const conditional=/\b(if|next time|when|whenever|on days|on a|any time|some days)\b/i;

export type PersonalisedOutput={headline:string;body:string;why:string;minutes:number};
export const personaliseOutputSchema={type:'object',additionalProperties:false,required:['headline','body','why','minutes'],properties:{headline:{type:'string'},body:{type:'string'},why:{type:'string'},minutes:{type:'integer'}}} as const;
export const personalisePrompt=`You reword one movement suggestion for the ENOUGH app. Enough finds movement hiding inside things people already do; it sounds like a clever, warm friend spotting an opportunity, not a personal trainer. Australian English, concise, practical, non-judgemental, slightly playful without caricature.
You receive one chosen opportunity and some context. Return JSON with:
- headline: a short moment label, at most 6 words (like "While they're at sport").
- body: one or two sentences, at most 40 words, describing the SAME activity.
- why: one short sentence on why it fits this person, based only on the context given.
- minutes: an integer within the allowed range; keep the suggested minutes unless a different number reads better.
Rules you must follow:
- Never change the activity, add steps, exercises or equipment, or turn it into a workout.
- Never invent facilities, places, distances, times, days, weather, people, events or calendar details.
- If "known" is null, you do not know what is happening today: use conditional language such as "Next time…" or "If…".
- Only mention a number if it is the minutes value.
- Never use: workout, calories, burn, crush, no excuses, fitness journey, best self, steps targets, gym, reps, hacks, get active.`;

/** What the model may see: the chosen opportunity and broad context labels. Never profiling answers, names or free text. */
export function personaliseContext(r:Ranked,map:LifeMap,situation?:Situation){
 const o=r.opportunity;
 return {opportunity:{title:o.title,action:fillMinutes(o.action,r.minutes),conditional:fillMinutes(o.descriptionTemplate,r.minutes),pairsWith:o.pairsWith,suggestedMinutes:r.minutes,allowedMinutes:{min:o.minMinutes,max:o.extraScales?r.minutes:o.maxMinutes},extraMinutes:r.extraMinutes,intensity:o.intensity},
  known:r.known&&situation?{happeningNow:situationLabels[situation]}:null,
  likely:{lifeContexts:map.contexts.map(c=>contextCards[c].title),recurringMoments:map.moments.filter(m=>o.moments.includes(m)).map(m=>momentLabels[m])}};
}

const words=(text:string)=>new Set(text.toLowerCase().match(/[a-z’']{4,}/g)||[]);
/** Accepts AI wording only when it keeps the activity, the limits and the honesty rules. Returns null otherwise. */
export function validatePersonalised(raw:unknown,r:Ranked,base:CardCopy):CardCopy|null{
 if(!raw||typeof raw!=='object')return null;
 const v=raw as Partial<PersonalisedOutput>;
 if(typeof v.headline!=='string'||typeof v.body!=='string'||typeof v.why!=='string'||!Number.isInteger(v.minutes))return null;
 const headline=v.headline.trim(),body=v.body.trim(),why=v.why.trim(),minutes=v.minutes!;
 if(!headline||headline.length>60||body.length<20||body.length>260||!why||why.length>180)return null;
 const o=r.opportunity;
 if(minutes<o.minMinutes||minutes>o.maxMinutes)return null;
 const extra=extraFor(o,minutes);if(extra>r.extraMinutes)return null;
 const text=`${headline} ${body} ${why}`;
 if(bannedCopy.test(text)||fakeContext.test(text))return null;
 const allowedNumbers=new Set([String(minutes),String(extra),String(r.minutes)]);
 if((text.match(/\d+/g)||[]).some(n=>!allowedNumbers.has(n)))return null;
 if(!r.known&&!conditional.test(body))return null;
 const source=words(fillMinutes(`${o.action} ${o.descriptionTemplate} ${o.pairsWith}`,r.minutes));
 if([...words(body)].filter(w=>source.has(w)).length<2)return null;
 return {title:headline,body,why,minutes,extraMinutes:extra,source:'ai'};
}

/** The AI layer with a guaranteed deterministic fallback: any failure returns the template copy. */
export async function personaliseWithFallback(r:Ranked,fetcher:()=>Promise<unknown>,timeoutMs=8000):Promise<CardCopy>{
 const base=cardCopy(r);
 try{
  const raw=await Promise.race([fetcher(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout')),timeoutMs))]);
  return validatePersonalised(raw,r,base)||base;
 }catch{return base;}
}
