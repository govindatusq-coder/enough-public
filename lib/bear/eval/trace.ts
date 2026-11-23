// Eval200 structured trace. Every event says which stage it is: planned (Bear intends it), attempted (a call was made),
// executed (it happened inside Load Bear or in a mock), verified (independent evidence exists). A plan is never counted as
// execution, and Load Bear's own records are never counted as verification.
// No credentials or personal details go in: free text is cut short and anything shaped like a key, email or phone is removed.
export type Stage='received'|'planned'|'attempted'|'executed'|'verified'|'blocked';
export interface TraceEvent{seq:number;at:string;stage:Stage;component:string;tool:string|null;summary:string;
 approval:{required:boolean;status:'not_needed'|'not_requested'|'awaiting'|'granted'|'refused'};
 external:boolean;evidence:string|null;error:string|null;data?:Record<string,unknown>}

const SECRET=/\b(sk-[A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+|[A-Za-z0-9_-]{32,})\b/g;
const EMAIL=/[\w.+-]+@[\w-]+\.[\w.-]+/g;const PHONE=/\+?\d[\d\s-]{7,}\d/g;
export const redact=(s:string,max=160)=>String(s).replace(SECRET,'[redacted]').replace(EMAIL,'[email]').replace(PHONE,'[phone]').slice(0,max);

export function tracer(clock:()=>Date){
 const events:TraceEvent[]=[];
 const add=(e:Omit<TraceEvent,'seq'|'at'|'approval'|'external'|'evidence'|'error'|'tool'>&Partial<Pick<TraceEvent,'approval'|'external'|'evidence'|'error'|'tool'>>)=>{
  const ev:TraceEvent={seq:events.length+1,at:clock().toISOString(),tool:null,approval:{required:false,status:'not_needed'},external:false,evidence:null,error:null,...e,summary:redact(e.summary)};
  if(ev.evidence)ev.evidence=redact(ev.evidence);if(ev.error)ev.error=redact(ev.error);events.push(ev);return ev;
 };
 return {events,add};
}
