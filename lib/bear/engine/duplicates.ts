import type {Task} from '../domain/types.ts';
import type {ExtractedResponsibility} from './types.ts';

// Semantic duplicate detection (beyond bills and school notices, which have their own matching).
// The same thing again → duplicate (no new item). The same thing with a changed fact → update: applied to
// Bear's own guesses, only PROPOSED for facts the person set themselves.
const STOP=new Set(['the','and','for','you','your','due','with','this','that','please','from','bill','pay','get','by','before','on','at','of','to','is','are','will','need','needs']);
// Dates and amounts are compared as facts, not as words.
const stripFacts=(s:string)=>s.replace(/\$\s?[\d,]+(?:\.\d{2})?/g,' ').replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+\d{4})?/gi,' ').replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?/gi,' ').replace(/\b\d{1,2}[\/.]\d{1,2}(?:[\/.]\d{2,4})?\b/g,' ').replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|next week|this week)\b/gi,' ');
export const tokens=(s:string)=>new Set(stripFacts(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>(w.length>2||/\d/.test(w))&&!STOP.has(w)));
// Different numbers ("form 3" vs "form 4", "Year 2" vs "Year 5") mean different things.
const numbers=(s:Set<string>)=>[...s].filter(w=>/\d/.test(w)).sort().join(',');
const jaccard=(a:Set<string>,b:Set<string>)=>{const i=[...a].filter(x=>b.has(x)).length;return i/Math.max(1,new Set([...a,...b]).size);};
export interface Fingerprint{pattern:string;words:Set<string>;dueDate:string|null;eventDate:string|null;amountCents:number|null}
export function fingerprintTask(t:Task):Fingerprint|null{
 const p=t.load?.nodes.find(n=>n.id===t.load!.primaryId);if(!p)return null;
 return {pattern:p.pattern,words:tokens(`${t.title} ${t.notes||''}`),dueDate:t.dueAt||p.entities.dueDate||p.entities.expiryDate||null,eventDate:p.entities.eventDate||null,amountCents:p.entities.amountCents??null};
}
export type DuplicateVerdict={kind:'distinct'}|{kind:'duplicate';taskId:string}|{kind:'update';taskId:string;changes:{field:'dueAt';from:string|null;to:string|null}[]};
export function compare(r:ExtractedResponsibility,t:Task):DuplicateVerdict{
 const f=fingerprintTask(t);if(!f||t.status!=='open')return {kind:'distinct'};
 if(f.pattern!==r.responsibilityPattern)return {kind:'distinct'};
 // Compare the whole wording (Jaccard), not a short generic title like "Form".
 const words=tokens(`${r.title} ${r.description||''}`);if(jaccard(f.words,words)<0.5)return {kind:'distinct'};
 if(numbers(f.words)!==numbers(words))return {kind:'distinct'};
 // Different amounts for a bill or a different event date mean a different instance (next quarter's bill).
 if(r.amountCents&&f.amountCents&&r.amountCents!==f.amountCents)return {kind:'distinct'};
 if(r.eventDate&&f.eventDate&&r.eventDate!==f.eventDate)return {kind:'distinct'};
 const due=r.dueDate||null;
 if(!due||due===f.dueDate)return {kind:'duplicate',taskId:t.id};
 return {kind:'update',taskId:t.id,changes:[{field:'dueAt',from:f.dueDate,to:due}]};
}
export function findDuplicate(r:ExtractedResponsibility,open:Task[]):DuplicateVerdict{
 for(const t of open){const v=compare(r,t);if(v.kind!=='distinct')return v;}
 return {kind:'distinct'};
}
