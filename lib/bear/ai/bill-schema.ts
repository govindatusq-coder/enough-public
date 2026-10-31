import {z} from 'zod';
import {billCategories,paymentMethods,recurrences} from '../domain/types.ts';

// Structured output the model must return for a bill. Unknown is null, never a guess.
const field=<T extends z.ZodTypeAny>(inner:T)=>z.object({value:inner.nullable(),confidence:z.number().min(0).max(1),evidence:z.string().max(300).nullable()}).strict();
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const billOutputSchema=z.object({
 documentType:z.enum(['bill','receipt','reminder_notice','statement','not_a_bill']),
 biller:field(z.string().max(120)),
 billerKey:z.string().max(80).nullable(),
 category:field(z.enum(billCategories)),
 amountDueCents:field(z.number().int().min(0).max(100000000)),
 currency:z.literal('AUD'),
 dueDate:field(isoDate),
 issueDate:field(isoDate),
 accountReference:field(z.string().max(80)),
 isRecurring:field(z.boolean()),
 expectedRecurrence:field(z.enum(recurrences)),
 paymentMethods:field(z.array(z.enum(paymentMethods)).max(8)),
 paymentUrl:field(z.string().max(500)),
 bpayBillerCode:field(z.string().max(10)),
 bpayReference:field(z.string().max(30)),
 directDebitActive:field(z.boolean()),
 lateFeeCents:field(z.number().int().min(0).max(10000000)),
 earlyDiscountCents:field(z.number().int().min(0).max(10000000)),
 discountDeadline:field(isoDate),
 servicePeriodStart:field(isoDate),
 servicePeriodEnd:field(isoDate),
 personHint:field(z.string().max(80)),
 alreadyPaid:field(z.boolean()),
 candidateDates:z.array(z.object({label:z.string().max(80),date:isoDate,evidence:z.string().max(200)}).strict()).max(12),
 candidateAmounts:z.array(z.object({label:z.string().max(80),cents:z.number().int().min(0),evidence:z.string().max(200)}).strict()).max(12),
 notes:z.string().max(500).nullable(),
}).strict();
export type BillOutput=z.infer<typeof billOutputSchema>;

// JSON schema (structured-output compatible: every property required, no additional properties).
const nullable=(t:Record<string,unknown>)=>({anyOf:[t,{type:'null'}]});
const f=(t:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:['value','confidence','evidence'],properties:{value:nullable(t),confidence:{type:'number',minimum:0,maximum:1},evidence:nullable({type:'string'})}});
const date={type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$',description:'ISO date yyyy-mm-dd'};
const str={type:'string'},bool={type:'boolean'},int={type:'integer',minimum:0};
const properties={
 documentType:{type:'string',enum:['bill','receipt','reminder_notice','statement','not_a_bill']},
 biller:f(str),billerKey:nullable({type:'string',description:'lowercase-hyphenated biller name'}),category:f({type:'string',enum:[...billCategories]}),
 amountDueCents:f({...int,description:'Total amount due in AUD cents'}),currency:{type:'string',enum:['AUD']},
 dueDate:f(date),issueDate:f(date),accountReference:f(str),isRecurring:f(bool),expectedRecurrence:f({type:'string',enum:[...recurrences]}),
 paymentMethods:f({type:'array',items:{type:'string',enum:[...paymentMethods]}}),paymentUrl:f(str),bpayBillerCode:f(str),bpayReference:f(str),
 directDebitActive:f(bool),lateFeeCents:f(int),earlyDiscountCents:f(int),discountDeadline:f(date),servicePeriodStart:f(date),servicePeriodEnd:f(date),
 personHint:f(str),alreadyPaid:f(bool),
 candidateDates:{type:'array',items:{type:'object',additionalProperties:false,required:['label','date','evidence'],properties:{label:str,date,evidence:str}}},
 candidateAmounts:{type:'array',items:{type:'object',additionalProperties:false,required:['label','cents','evidence'],properties:{label:str,cents:int,evidence:str}}},
 notes:nullable(str),
};
export const billOutputJsonSchema={type:'object',additionalProperties:false,required:Object.keys(properties),properties} as const;

export const billSystemPrompt=`You are Load Bear's bill reader for Australian households. Read the supplied bill (image, PDF or text) and return ONLY the structured fields.
Rules:
- Never invent a value. If a field is not clearly present, set value to null and confidence low. A guess with high confidence is the worst outcome.
- Amounts are AUD cents (e.g. $184.60 → 18460). amountDueCents is the total amount due now, not a previous balance, instalment, or usage line.
- Dates are yyyy-mm-dd. Australian bills print day-first (28/11/2026 is 28 November). List EVERY date you see in candidateDates with its label, and EVERY money amount in candidateAmounts, so a person can disambiguate.
- If more than one date could be the due date (e.g. discount date vs. due date), lower dueDate.confidence below 0.7 and explain in evidence.
- documentType is not_a_bill for things that are not bills; receipt or statement when it is only a record of payment. alreadyPaid is true only when the document says the amount has been paid or the balance due is $0 after a payment.
- paymentUrl only when a full https URL is printed. bpayBillerCode is digits only. Do not read card numbers, CVV codes or bank passwords; if present, ignore them and never output them.
- lateFeeCents and earlyDiscountCents only when a specific dollar amount is printed. discountDeadline only when printed.
- evidence is the short verbatim text that supports the value.
- personHint is a name or role printed on the bill (e.g. the account holder's first name, or "Ava" for a school fee) if obvious; otherwise null.`;
