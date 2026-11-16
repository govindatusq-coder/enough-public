// RRE part 3: what Bear learns about how she likes to handle things. Learned only from what she actually does:
// choosing a way to do something, accepting or skipping a suggestion, correcting a category. Every preference says
// where it came from and how sure Bear is, and she can see and remove each one.
import type {Method} from './model.ts';

export interface UserPreference{id:string;dimension:'purchase_method'|'calls_when'|'forms_when';value:string;confidence:number;source:'explicit'|'inferred'|'observed';evidenceCount:number;lastConfirmedAt?:string;createdAt:string;updatedAt:string}
export const describePreference=(p:UserPreference)=>({
 purchase_method:p.value==='online'?'Prefers ordering online when it saves a trip':p.value==='in_person'?'Prefers buying things in person':`Prefers: ${p.value}`,
 calls_when:`Makes phone calls ${p.value}`,
 forms_when:`Does forms and admin ${p.value}`,
} as Record<string,string>)[p.dimension]||p.value;

// Record what she chose. An explicit statement ("I want to buy this in person") is strong; one choice of a pathway is a
// single observation; several consistent observations become an inferred preference. A single choice is never a rule.
export function learn(prefs:UserPreference[]|undefined,dimension:UserPreference['dimension'],value:string,source:'explicit'|'observed',now:Date):UserPreference[]{
 const at=now.toISOString();const list=[...(prefs||[])];const i=list.findIndex(p=>p.dimension===dimension);
 if(i<0){list.push({id:globalThis.crypto.randomUUID(),dimension,value,confidence:source==='explicit'?0.9:0.3,source,evidenceCount:1,createdAt:at,updatedAt:at,...(source==='explicit'?{lastConfirmedAt:at}:{})});return list;}
 const cur=list[i];
 if(cur.value===value){const n=cur.evidenceCount+1;const src=cur.source==='explicit'||source==='explicit'?'explicit':n>=3?'inferred':'observed';
  list[i]={...cur,evidenceCount:n,source:src,confidence:Math.min(0.95,src==='explicit'?0.9:0.3+0.15*(n-1)),updatedAt:at,...(source==='explicit'?{lastConfirmedAt:at}:{})};}
 else if(source==='explicit'||cur.source!=='explicit'){
  // A different choice: explicit always wins; a weaker observation replaces a weaker one but starts over.
  if(source==='explicit'||cur.evidenceCount<=1)list[i]={...cur,value,source,evidenceCount:1,confidence:source==='explicit'?0.9:0.3,updatedAt:at,...(source==='explicit'?{lastConfirmedAt:at}:{})};
  else list[i]={...cur,evidenceCount:cur.evidenceCount-1,confidence:Math.max(0.2,cur.confidence-0.15),updatedAt:at};
 }
 return list;
}
// What the engine uses: only preferences Bear is reasonably sure of. Explicit ones are respected as near-hard constraints.
export function purchasePreference(prefs:UserPreference[]|undefined):{method:Method|null;strength:'explicit'|'inferred'|null}{
 const p=(prefs||[]).find(x=>x.dimension==='purchase_method');
 if(!p)return {method:null,strength:null};
 if(p.source==='explicit')return {method:p.value as Method,strength:'explicit'};
 if(p.confidence>=0.55)return {method:p.value as Method,strength:'inferred'};
 return {method:null,strength:null};
}
