import {type BillOutput} from '../ai/bill-schema.ts';
import {totalCost} from '../domain/items.ts';
import {generalOutputJsonSchema,generalOutputSchema,generalSystemPrompt,type GeneralOutput} from '../ai/general-schema.ts';
import {understandWithRules} from '../ai/general-rules.ts';
import {ProviderError,type StructuredModelProvider} from '../ai/provider.ts';
import {extractBillWithRules,slug} from '../ai/rules.ts';
import {formatAU} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import {traced,type AIInference,type AreaKey,type Bill,type BillFieldKey,type BillFields,type ExtractedEntity,type GeneralFields,type Traced,type VerificationQuestion} from '../domain/types.ts';
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

// Reconcile the model's general understanding (or the rule-based one) into traced fields.
export function reconcileGeneral(model:GeneralOutput|null,rules:GeneralOutput,at:string):GeneralFields{
 const pickG=<T,>(key:'title'|'area'|'when'|'timeOfDay'|'person'|'location'|'isRecurring'|'timing'|'size'):Traced<T>=>{const m=model?(model[key] as {value:T|null;confidence:number}):null;const r=rules[key] as {value:T|null;confidence:number};return pick<T>(m,r,at);};
 const items=(model?.items?.length?model.items:rules.items)||[];
 return {kind:model?.kind||rules.kind,summary:model?.summary||rules.summary,title:pickG<string>('title'),area:pickG<AreaKey>('area'),when:pickG<string>('when'),timeOfDay:pickG<string>('timeOfDay'),person:pickG<string>('person'),location:pickG<string>('location'),isRecurring:pickG<boolean>('isRecurring'),timing:pickG<'time_sensitive'|'flexible'>('timing'),size:model&&model.size.value===null&&(model.steps?.length||0)>=3?traced<'one_go'|'bigger'>('bigger','model',0.6,false,at):pickG<'one_go'|'bigger'>('size'),steps:model?.steps||[],items,estimatedCostCents:totalCost(items),estimatedMinutes:model?.estimatedMinutes??null};
}
export function generalQuestions(g:GeneralFields):VerificationQuestion[]{
 const q:VerificationQuestion[]=[];
 if(g.title.value===null)q.push({field:'title',question:"What should Bear call this?",options:[{label:'Type it',value:null}]});
 else if(g.title.confidence<VERIFY_THRESHOLD)q.push({field:'title',question:`Is "${g.title.value}" the right way to put it?`,options:[{label:'Yes',value:g.title.value},{label:'Change it',value:null}]});
 if(g.when.value===null)q.push({field:'when',question:"When does this need to happen? Leave it blank if there's no date.",options:[{label:'Choose a date',value:null}]});
 else if(g.when.confidence<VERIFY_THRESHOLD)q.push({field:'when',question:`Is ${formatAU(g.when.value)} the date that matters?`,options:[{label:'Yes',value:g.when.value},{label:'Change date',value:null}]});
 if(g.area.value===null||g.area.confidence<VERIFY_THRESHOLD)q.push({field:'area',question:'Which part of life is this?',options:(['work','family','home','money','health','me'] as const).map(a=>({label:a.charAt(0).toUpperCase()+a.slice(1),value:a}))});
 return q;
}

// Understand any capture: text/voice through the rules (and the model when configured),
// images and PDFs through the model only. Produces one ExtractedEntity with both the
// general understanding and, for bills, the detailed bill reading.
export async function extractCapture(store:BearStore,provider:StructuredModelProvider|null,input:ExtractionInput):Promise<ExtractedEntity>{
 const at=new Date().toISOString();
 const needsVision=input.images.length>0||input.documents.length>0;
 if(needsVision&&!provider)throw new ExtractionError("Bear can't read pictures or PDFs until the AI service is connected. You can paste or type it instead.",'unavailable');
 if(!needsVision&&!(input.text&&input.text.trim()))throw new ExtractionError('Tell Bear something first.','empty');
 const billRules=extractBillWithRules(input.text||'',input.referenceYear);
 const generalRules=understandWithRules(input.text||'',input.referenceYear,billRules);
 let model:GeneralOutput|null=null;let inferenceId:string|null=null;
 if(provider){
  const started=Date.now();
  try{
   const result=await provider.extract({schema:generalOutputJsonSchema as unknown as Record<string,unknown>,system:generalSystemPrompt,text:input.text,images:input.images,documents:input.documents});
   const parsed=generalOutputSchema.safeParse(result.output);
   const inference=await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:input.captureId,service:'CaptureUnderstandingService',provider:result.provider,model:result.model,promptHash:hash(generalSystemPrompt),rawOutput:result.output,latencyMs:result.latencyMs,ok:parsed.success,error:parsed.success?null:'schema_invalid'}));
   inferenceId=inference.id;
   if(!parsed.success){if(needsVision)throw new ExtractionError('Bear read it but the result did not make sense. Try a clearer picture or paste the text.','ai_failed');}
   else model=parsed.data;
  }catch(error){
   if(error instanceof ExtractionError)throw error;
   const message=error instanceof ProviderError?error.message:'The AI service had a problem.';
   await store.insert('ai_inferences',stamp<AIInference>(store.userId,{captureId:input.captureId,service:'CaptureUnderstandingService',provider:provider.name,model:provider.model,promptHash:hash(generalSystemPrompt),rawOutput:null,latencyMs:Date.now()-started,ok:false,error:message}));
   if(needsVision||!input.text)throw new ExtractionError(message,error instanceof ProviderError&&error.kind==='unsupported'?'unsupported':'ai_failed');
  }
 }
 // When the model read an image, its extracted text lets the rule-based bill reader cross-check.
 const sourceText=input.text||model?.extractedText||null;
 const billRulesFinal=input.text?billRules:extractBillWithRules(sourceText||'',input.referenceYear);
 const general=reconcileGeneral(model,generalRules,at);
 const isBill=general.kind==='bill'||(!model&&billRulesFinal.documentType==='bill'&&billRulesFinal.amountDueCents.value!==null);
 const fields=reconcile(model?.bill||null,billRulesFinal,at);
 if(isBill&&general.kind!=='bill')general.kind='bill';
 const questions=isBill?verificationQuestions(fields):generalQuestions(general);
 const duplicate=isBill?await findDuplicate(store,fields):null;
 const entity=stamp<ExtractedEntity>(store.userId,{captureId:input.captureId,kind:isBill?'bill':'task',status:'draft',fields,general,questions,sourceText,inferenceId,duplicateOfBillId:duplicate?.id||null});
 return store.insert('extractions',entity);
}
export const extractBill=extractCapture;
function hash(s:string){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return (h>>>0).toString(16);}
export const keyFields:BillFieldKey[]=['biller','amountDueCents','dueDate'];
