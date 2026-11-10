import type {StructuredModelProvider} from '../ai/provider.ts';
import {findSchoolMatch} from '../coverage/matching.ts';
import {readSchoolNotice} from '../coverage/packs/school.ts';
import {todayISO} from '../domain/dates.ts';
import {maybeAutoSetup} from '../services/auto-setup.ts';
import {recordBehaviour} from '../services/behaviour.ts';
import {MAX_FILE_BYTES,createCapture,supportedDocumentMimes,supportedImageMimes} from '../services/capture.ts';
import {actOnLoad} from '../services/load.ts';
import type {BearStore} from '../store/store.ts';
import {tokenFromAddress} from './address.ts';
import type {InboundRegistry} from './registry.ts';
import type {InboundMailProvider} from './resend.ts';
import {verifySignature} from './signature.ts';

// Forward-to-Bear. Inbound message → authenticate source → identify account → claim (idempotent)
// → fetch content → captures through the SAME extraction, School pack and auto-setup as everything
// else → apply real confirmations as evidence → done. The email is untrusted input throughout: it is
// read as data, never executed, and it can't reach any account except the one its token routes to.
// Nothing here logs subjects, senders or bodies.
export const LIMITS={maxBodyBytes:256*1024,maxTextChars:20000,maxAttachments:5,maxAttachmentBytes:MAX_FILE_BYTES,minImageBytes:15*1024};
const ALLOWED=new Set<string>([...supportedImageMimes,...supportedDocumentMimes]);
export type InboundOutcome='rejected'|'ignored'|'duplicate'|'processed'|'failed';
export interface InboundDeps{
 secret:string|undefined;domain:string|undefined;registry:InboundRegistry;mail:InboundMailProvider;
 storeFor:(userId:string)=>BearStore;ai:StructuredModelProvider|null;now?:Date;
}
export interface InboundResult{status:number;outcome:InboundOutcome;captures:number;reason?:string}

export function htmlToText(html:string){
 return html.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|tr|h\d)>/gi,'\n').replace(/<[^>]+>/g,' ')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&rsquo;/g,'’').replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n+/g,'\n').trim();
}
// A confirmation the school or a provider sent: real evidence, recorded as coming from an email.
const CONFIRMS:{re:RegExp;evidence:string}[]=[
 {re:/\b(payment (?:has been |was )?(?:received|successful|processed)|(?:we(?:’|')ve|we have|i(?:’|')ve|i have) (?:now )?received your payment|thank you for your payment|receipt (?:for|no\.?|number))\b/i,evidence:'payment_confirmed'},
 {re:/\b(consent (?:has been |was )?(?:received|submitted|given)|permission (?:has been |was )?(?:received|submitted))\b/i,evidence:'submission_confirmed'},
 {re:/\b(booking (?:is |has been )?confirmed|your (?:interview|appointment) (?:is|has been) booked|you have booked)\b/i,evidence:'booked'},
];

export async function processInbound(rawBody:string,headers:Headers|Record<string,string|undefined>,d:InboundDeps):Promise<InboundResult>{
 const now=d.now||new Date();
 if(!d.secret||!d.domain)return {status:503,outcome:'rejected',captures:0,reason:'not_configured'};
 if(Buffer.byteLength(rawBody)>LIMITS.maxBodyBytes)return {status:413,outcome:'rejected',captures:0,reason:'too_large'};
 const sig=verifySignature(rawBody,headers,d.secret,Math.floor(now.getTime()/1000));
 if(!sig.ok)return {status:401,outcome:'rejected',captures:0,reason:sig.reason};
 let event:{type?:string;data?:{email_id?:string;message_id?:string;to?:string[];received_for?:string[];subject?:string}};
 try{event=JSON.parse(rawBody);}catch{return {status:400,outcome:'rejected',captures:0,reason:'malformed'};}
 if(event?.type!=='email.received'||!event.data?.email_id||typeof event.data.email_id!=='string')return {status:200,outcome:'ignored',captures:0,reason:'not_inbound'};
 // The account comes ONLY from an unguessable token in a recipient address on our domain.
 const recipients=[...(Array.isArray(event.data.to)?event.data.to:[]),...(Array.isArray(event.data.received_for)?event.data.received_for:[])].filter(x=>typeof x==='string');
 const token=recipients.map(r=>tokenFromAddress(r,d.domain!)).find(Boolean);
 if(!token)return {status:200,outcome:'ignored',captures:0,reason:'no_route'};
 const userId=await d.registry.userForToken(token);
 if(!userId)return {status:200,outcome:'ignored',captures:0,reason:'no_route'};
 const key=event.data.message_id||event.data.email_id;
 if(!(await d.registry.claim(userId,key)))return {status:200,outcome:'duplicate',captures:0};
 const store=d.storeFor(userId);
 try{
  const email=await d.mail.getEmail(event.data.email_id);
  const subject=(email.subject||event.data.subject||'').slice(0,300);
  const body=(email.text&&email.text.trim())||(email.html?htmlToText(email.html):'');
  const text=[subject,body].filter(Boolean).join('\n').slice(0,LIMITS.maxTextChars);
  let captures=0;
  // Real confirmations first: they close things rather than create them.
  const confirmed=await applyConfirmation(store,text,now);
  if(text.trim()&&!confirmed){const {extraction}=await createCapture(store,d.ai,{method:'email',text,referenceYear:now.getFullYear()});captures++;await maybeAutoSetup(store,extraction,now,d.ai).catch(()=>null);}
  // Attachments: only pictures and PDFs, within limits, and only when Bear can read them.
  const atts=(await d.mail.listAttachments(event.data.email_id)).filter(a=>ALLOWED.has(a.contentType.toLowerCase())&&a.size>0&&a.size<=LIMITS.maxAttachmentBytes&&!(a.contentType.startsWith('image/')&&a.size<LIMITS.minImageBytes)).slice(0,LIMITS.maxAttachments);
  if(d.ai)for(const a of atts){try{const bytes=await d.mail.download(a.downloadUrl,LIMITS.maxAttachmentBytes);const {extraction}=await createCapture(store,d.ai,{method:'email',file:{bytes,mime:a.contentType.toLowerCase(),name:a.filename.slice(0,120)},referenceYear:now.getFullYear()});captures++;await maybeAutoSetup(store,extraction,now,d.ai).catch(()=>null);}catch{/* one bad attachment never blocks the rest */}}
  await recordBehaviour(store,'research_signal',{signal:'inbound_email',captures,attachments:atts.length,confirmed:!!confirmed},now);
  await d.registry.finish(userId,key,captures||confirmed?'done':'ignored');
  return {status:200,outcome:'processed',captures};
 }catch{
  // Let the provider's retry try again; nothing about the message is logged.
  await d.registry.release(userId,key);
  return {status:500,outcome:'failed',captures:0,reason:'processing_failed'};
 }
}

// A forwarded confirmation ("Payment received", "Consent submitted", "Booking confirmed") about an event
// Bear holds marks that step done with email evidence, the strongest evidence Bear can have today.
export async function applyConfirmation(store:BearStore,text:string,now:Date):Promise<string|null>{
 const hit=CONFIRMS.find(c=>c.re.test(text));if(!hit)return null;
 const profile=(await store.list('profiles',{limit:1}))[0];
 const reading=readSchoolNotice(text,todayISO(profile?.lifeRhythm?.timezone||'Australia/Sydney',now));
 if(!reading.isSchool)return null;
 const match=await findSchoolMatch(store,reading);if(!match)return null;
 for(const n of match.task.load!.nodes)for(const st of n.steps)if(st.evidence===hit.evidence&&st.status==='pending'){await actOnLoad(store,match.task.id,{stepId:st.id,source:'email'},now);return hit.evidence;}
 return null;
}
