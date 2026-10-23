import {billOutputJsonSchema,billOutputSchema,billSystemPrompt,type BillOutput} from '../ai/bill-schema.ts';
import {ProviderError,type StructuredModelProvider} from '../ai/provider.ts';
import {extractBillWithRules,slug} from '../ai/rules.ts';
import {formatAU} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import {traced,type AIInference,type Bill,type BillFieldKey,type BillFields,type ExtractedEntity,type Traced,type VerificationQuestion} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';

// BillExtractionService: runs the rule-based extractor and (when configured) the model,
// reconciles them into Traced fields with honest confidence, and writes the
// ExtractedEntity + AIInference rows. Low-confidence key fields become questions.
export const VERIFY_THRESHOLD=0.75;
export type ExtractionErrorKind='unavailable'|'unsupported'|'ai_failed'|'empty';
export class ExtractionError extends Error{readonly kind:ExtractionErrorKind;constructor(message:string,kind:ExtractionErrorKind='ai_failed'){super(message);this.name='ExtractionError';this.kind=kind;}}

export interface ExtractionInput{captureId:string;text:string|null;images:{mime:string;bytes:Uint8Array}[];documents:{mime:string;bytes:Uint8Array}[];referenceYear?:number}

function toTraced<T>(f:{value:T|null;confidence:number},source:'model'|'rules',at:string):Traced<T>{return traced<T>(f.value,source,f.value===null?0:Math.max(0,Math.min(1,f.confidence)),false,at);}
function pick<T>(model:{value:T|null;confidence:number}|null,rules:{value:T|null;confidence:number},at:string,crossCheck:'exact'|'none'='none'):Traced<T>{
 if(!model)return toTraced(rules,'rules',at);
 if(model.value===null)return rules.value!==null?toTraced({value:rules.value,confidence:Math.min(rules.confidence,0.6)},'rules',at):toTraced(model,'model',at);
 if(crossCheck==='exact'&&rules.value!==null&&rules.confidence>=0.6&&JSON.stringify(rules.value)!==JSON.stringify(model.value))return traced(model.value,'model',Math.min(model.confidence,0.6),false,at);
 return toTraced(model,'model',at);
}
export function reconcile(model:BillOutput|null,rules:BillOutput,at:string):BillFields{
 const m=model;const r=rules;
 const amount=pick(m?.amountDueCents??null,r.amountDueCents,at,'exact');
 const due=pick(m?.dueDate??null,r.dueDate,at,'exact');
 const candidateDates=[...(m?.candidateDates||[]),...r.candidateDates].filter((c,i,arr)=>arr.findIndex(x=>x.date===c.date&&x.label===c.label)===i).map(c=>({label:c.label,value:c.date,evidence:c.evidence}));
 const candidateAmounts=[...(m?.candidateAmounts||[]),...r.candidateAmounts].filter((c,i,arr)=>arr.findIndex(x=>x.cents===c.cents&&x.label===c.label)===i).map(c=>({label:c.label,value:c.cents,evidence:c.evidence}));
 // Several distinct due-looking dates / total-looking amounts: force verification even if the model was sure.
 const dueLike=new Set(candidateDates.filter(c=>/due|pay/i.test(c.label)).map(c=>c.value));if(dueLike.size>1&&due.confidence>0.7)due.confidence=0.6;
 const totalLike=new Set(candidateAmounts.filter(c=>/total|due|payable/i.test(c.label)).map(c=>c.value));if(totalLike.size>1&&amount.confidence>0.7)amount.confidence=0.6;
 const biller=pick(m?.biller??null,r.biller,at);
 return {
  documentType:m?.documentType||r.documentType,
  biller,billerKey:m?.billerKey||r.billerKey||(biller.value?slug(biller.value):null),
  category:pick(m?.category??null,r.category,at),amountDueCents:amount,dueDate:due,
  issueDate:pick(m?.issueDate??null,r.issueDate,at),accountReference:pick(m?.accountReference??null,r.accountReference,at),
  isRecurring:pick(m?.isRecurring??null,r.isRecurring,at),expectedRecurrence:pick(m?.expectedRecurrence??null,r.expectedRecurrence,at),
  paymentMethods:pick(m?.paymentMethods??null,r.paymentMethods,at),paymentUrl:safeUrl(pick(m?.paymentUrl??null,r.paymentUrl,at)),
  bpayBillerCode:pick(m?.bpayBillerCode??null,r.bpayBillerCode,at),bpayReference:pick(m?.bpayReference??null,r.bpayReference,at),
  directDebitActive:pick(m?.directDebitActive??null,r.directDebitActive,at),lateFeeCents:pick(m?.lateFeeCents??null,r.lateFeeCents,at),
  earlyDiscountCents:pick(m?.earlyDiscountCents??null,r.earlyDiscountCents,at),discountDeadline:pick(m?.discountDeadline??null,r.discountDeadline,at),
  servicePeriodStart:pick(m?.servicePeriodStart??null,r.servicePeriodStart,at),servicePeriodEnd:pick(m?.servicePeriodEnd??null,r.servicePeriodEnd,at),
  personHint:pick(m?.personHint??null,r.personHint,at),alreadyPaid:pick(m?.alreadyPaid??null,r.alreadyPaid,at),
  candidateDates,candidateAmounts,notes:m?.notes||null,
 };
}
// Only keep https URLs; never keep anything that looks like it carries credentials.
function safeUrl(t:Traced<string>):Traced<string>{if(!t.value)return t;try{const u=new URL(t.value);if(u.protocol!=='https:'||u.username||u.password||/token=|password=|cvv|card=/i.test(u.search))return {...t,value:null,confidence:0};return {...t,value:u.toString()};}catch{return {...t,value:null,confidence:0};}}

export function verificationQuestions(f:BillFields):VerificationQuestion[]{
 const q:VerificationQuestion[]=[];
 const dateOptions=f.candidateDates.filter(c=>c.value!==f.dueDate.value).slice(0,3).map(c=>({label:`${formatAU(c.value)} (${c.label})`,value:c.value}));
 if(f.dueDate.value===null)q.push({field:'dueDate',question:"I couldn't find a due date. When does this need to be paid?",options:[...dateOptions,{label:'Choose a date',value:null}]});
 else if(f.dueDate.confidence<VERIFY_THRESHOLD)q.push({field:'dueDate',question:`Is ${formatAU(f.dueDate.value)} the payment due date?`,options:[{label:'Yes',value:f.dueDate.value},...dateOptions,{label:'Change date',value:null}]});
 const amountOptions=f.candidateAmounts.filter(c=>c.value!==f.amountDueCents.value&&c.value>0).slice(0,3).map(c=>({label:`${formatAUD(c.value)} (${c.label.replace('_',' ')})`,value:c.value}));
 if(f.amountDueCents.value===null)q.push({field:'amountDueCents',question:"I couldn't find the amount due. How much is it?",options:[...amountOptions,{label:'Type the amount',value:null}]});
 else if(f.amountDueCents.confidence<VERIFY_THRESHOLD)q.push({field:'amountDueCents',question:`Is ${formatAUD(f.amountDueCents.value)} the amount due?`,options:[{label:'Yes',value:f.amountDueCents.value},...amountOptions,{label:'Change amount',value:null}]});
 if(f.biller.value===null)q.push({field:'biller',question:'Who is this bill from?',options:[{label:'Type the biller',value:null}]});
 else if(f.biller.confidence<VERIFY_THRESHOLD)q.push({field:'biller',question:`Is this bill from ${f.biller.value}?`,options:[{label:'Yes',value:f.biller.value},{label:'Change',value:null}]});
 if(f.alreadyPaid.value===true)q.push({field:'alreadyPaid',question:'This looks like it has already been paid. Is that right?',options:[{label:"Yes, it's paid",value:true},{label:'No, it still needs paying',value:false}]});
 return q;
}

export async function findDuplicate(store:BearStore,f:BillFields):Promise<Bill|null>{
 if(!f.billerKey)return null;
 const bills=await store.list('bills',{where:[{column:'biller_key',value:f.billerKey},{column:'status',op:'in',value:['watching','due_soon','paid']}]});
 return bills.find(b=>(f.dueDate.value&&b.dueAt===f.dueDate.value&&(f.amountDueCents.value===null||b.amountCents===f.amountDueCents.value))||(f.accountReference.value&&b.fields.accountReference.value===f.accountReference.value&&f.dueDate.value===b.dueAt))||null;
}

export async function extractBill(store:BearStore,provider:StructuredModelProvider|null,input:ExtractionInput):Promise<ExtractedEntity>{
 const at=new Date().toISOString();
 const needsVision=input.images.length>0||input.documents.length>0;
 if(needsVision&&!provider)throw new ExtractionError("Bear can't read pictures or PDFs until the AI service is connected. You can paste the bill text or type it in instead.",'unavailable');
 if(!needsVision&&!(input.text&&input.text.trim()))throw new ExtractionError('Tell Bear something about the bill first.','empty');
 const rules=extractBillWithRules(input.text||'',input.referenceYear);
 let model:BillOutput|null=null;let inferenceId:string|null=null;
 if(provider){
  const started=Date.now();
  try{
   const result=await provider.extract({schema:billOutputJsonSchema as unknown as Record<string,unknown>,system:billSystemPrompt,text:input.text,images:input.images,documents:input.documents});
   const parsed=billOutputSchema.safeParse(result.output);
   const inference=await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:input.captureId,service:'BillExtractionService',provider:result.provider,model:result.model,promptHash:hash(billSystemPrompt),rawOutput:result.output,latencyMs:result.latencyMs,ok:parsed.success,error:parsed.success?null:'schema_invalid'}));
   inferenceId=inference.id;
   if(!parsed.success){if(needsVision)throw new ExtractionError('Bear read the document but the result did not make sense. Try a clearer picture or paste the text.','ai_failed');}
   else model=parsed.data;
  }catch(error){
   if(error instanceof ExtractionError)throw error;
   const message=error instanceof ProviderError?error.message:'The AI service had a problem.';
   await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:input.captureId,service:'BillExtractionService',provider:provider.name,model:provider.model,promptHash:hash(billSystemPrompt),rawOutput:null,latencyMs:Date.now()-started,ok:false,error:message}));
   // With text we can still fall back to the rule-based read; with only an image there is nothing to read.
   if(needsVision||!input.text)throw new ExtractionError(message,error instanceof ProviderError&&error.kind==='unsupported'?'unsupported':'ai_failed');
  }
 }
 const fields=reconcile(model,rules,at);
 const duplicate=await findDuplicate(store,fields);
 const entity=stamp<ExtractedEntity>(store.userId,{captureId:input.captureId,kind:'bill',status:'draft',fields,questions:verificationQuestions(fields),sourceText:input.text,inferenceId,duplicateOfBillId:duplicate?.id||null});
 return store.insert('extractions',entity);
}
function hash(s:string){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return (h>>>0).toString(16);}
export const keyFields:BillFieldKey[]=['biller','amountDueCents','dueDate'];
