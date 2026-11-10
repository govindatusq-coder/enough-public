// Draft a reply for the person to read, edit and send themselves. Bear never sends. Only for the one case
// where a reply is clearly wanted: a scheduling question ("Could we do 3pm or 4pm on Tuesday?").
// Bear can't see the person's calendar, so the draft never says a time works: it shows the options
// in [square brackets] for them to choose. Everything taken from the email is untrusted: it's matched with
// fixed patterns or HTML-escaped, never executed.
export interface DraftInput{from?:string|null;text:string;decision:string;rule:string}
export interface Draft{text:string;html:string}

const TITLES=new Set(['dr','dr.','prof','prof.','professor','mr','mr.','mrs','mrs.','ms','ms.','miss','mx','mx.']);
export function firstName(from?:string|null){
 if(!from)return null;
 const name=from.replace(/<[^>]*>/g,'').replace(/["']/g,'').trim();
 if(!name||name.includes('@'))return null;
 const parts=name.split(/\s+/).filter(p=>!TITLES.has(p.toLowerCase()));
 const first=parts[0]||'';
 return /^[A-Za-z][A-Za-z'’-]{0,29}$/.test(first)?first:null;
}
const DAY='monday|tuesday|wednesday|thursday|friday|saturday|sunday';
const MONTH='january|february|march|april|may|june|july|august|september|october|november|december';
// The times offered are in the sentence that asks the question, not elsewhere ("I have another meeting at 1pm").
const questionSentence=(text:string)=>{const parts=text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/);return parts.find(p=>p.includes('?'))||text;};
export function schedulingOptions(whole:string){
 const text=questionSentence(whole);
 const times=[...new Set((text.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/gi)||[]).map(t=>t.replace(/\s+/g,'').toLowerCase()))].slice(0,3);
 const day=new RegExp(`\\b(${DAY})\\b(?:,?\\s+(\\d{1,2}(?:st|nd|rd|th)?)(?:\\s+(${MONTH}))?)?`,'i').exec(text);
 return {times,day:day?day[0].replace(/\s+/g,' ').replace(/^./,c=>c.toUpperCase()):null};
}
const esc=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function draftReply(i:DraftInput):Draft|null{
 if(i.decision!=='ACT'||i.rule!=='scheduling-question')return null;
 const {times,day}=schedulingOptions(i.text);
 const pick=times.length?`[Pick one: ${times.join(' / ')}]`:'[Suggest a time]';
 const when=day?` on ${day}`:'';
 const name=firstName(i.from);
 const text=[name?`Hi ${name},`:'Hi,','',`Thanks for your email. ${pick}${when} works for me.`,'','Kind regards'].join('\n');
 const html=`<p>${name?`Hi ${esc(name)},`:'Hi,'}</p><p>Thanks for your email. ${esc(pick)}${esc(when)} works for me.</p><p>Kind regards</p>`;
 return {text,html};
}
