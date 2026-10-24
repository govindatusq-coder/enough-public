import {z} from 'zod';
import {areaKeys} from '../domain/types.ts';
import {billOutputJsonSchema,billOutputSchema} from './bill-schema.ts';

// What Bear understands from ANY input (photo, screenshot, PDF, pasted or spoken text).
// A bill is one kind; when the input is a bill the detailed bill reading is attached.
export const captureKinds=['bill','appointment','school','form','errand','shopping','message','note','event','other'] as const;
export type CaptureKind=typeof captureKinds[number];
const field=<T extends z.ZodTypeAny>(inner:T)=>z.object({value:inner.nullable(),confidence:z.number().min(0).max(1),evidence:z.string().max(300).nullable()}).strict();
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const generalOutputSchema=z.object({
 kind:z.enum(captureKinds),
 summary:z.string().max(300),
 title:field(z.string().max(120)),
 area:field(z.enum(areaKeys)),
 when:field(isoDate),
 timeOfDay:field(z.string().regex(/^\d{2}:\d{2}$/)),
 person:field(z.string().max(80)),
 location:field(z.string().max(160)),
 isRecurring:field(z.boolean()),
 steps:z.array(z.string().max(120)).max(6),
 estimatedMinutes:z.number().int().min(1).max(600).nullable(),
 extractedText:z.string().max(6000).nullable(),
 bill:billOutputSchema.nullable(),
}).strict();
export type GeneralOutput=z.infer<typeof generalOutputSchema>;

const nullable=(t:Record<string,unknown>)=>({anyOf:[t,{type:'null'}]});
const f=(t:Record<string,unknown>)=>({type:'object',additionalProperties:false,required:['value','confidence','evidence'],properties:{value:nullable(t),confidence:{type:'number',minimum:0,maximum:1},evidence:nullable({type:'string'})}});
export const generalOutputJsonSchema={type:'object',additionalProperties:false,required:['kind','summary','title','area','when','timeOfDay','person','location','isRecurring','steps','estimatedMinutes','extractedText','bill'],properties:{
 kind:{type:'string',enum:[...captureKinds]},summary:{type:'string'},title:f({type:'string'}),area:f({type:'string',enum:[...areaKeys]}),
 when:f({type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}),timeOfDay:f({type:'string',pattern:'^\\d{2}:\\d{2}$'}),person:f({type:'string'}),location:f({type:'string'}),isRecurring:f({type:'boolean'}),
 steps:{type:'array',items:{type:'string'}},estimatedMinutes:nullable({type:'integer',minimum:1}),extractedText:nullable({type:'string'}),
 bill:nullable(billOutputJsonSchema),
}} as const;

export const generalSystemPrompt=`You are Load Bear's reader. A busy person has handed you something messy: a photo, screenshot, PDF, pasted text or spoken note. Work out what it is and what it means for them, and return ONLY the structured fields.
Rules:
- kind: bill (any invoice, rates notice, fee, registration, insurance renewal), appointment (medical, dentist, meeting), school (notes from school or childcare, excursions, permission slips, uniform days), form (anything to fill in or sign), errand, shopping (lists), message (a text or email screenshot asking for something), note (a free-form thought), event (party, sports game, birthday), other.
- title: a short imperative task in plain Australian English, e.g. "Pay electricity bill", "Book Ava's dentist", "Return the excursion form", "Buy a present for Max". Never leave it empty when anything is readable.
- area: work, family, home, money, health or me. Bills are money. Children's things are family. Medical is health.
- when: the date the person must act by (a due date, the event date, an RSVP date). yyyy-mm-dd. Australian text prints day-first. Null when no date is readable. timeOfDay HH:MM 24h when printed.
- person: the family member it concerns, if named. location when printed.
- steps: 1–5 concrete sub-steps only when the task genuinely needs them, otherwise an empty list.
- extractedText: the readable text of the input, cleaned, up to 6000 characters. For spoken notes, the transcript.
- bill: when kind is bill, fill the full bill reading using the bill rules; otherwise null.
- Never invent values. When something is unknown, leave it empty rather than guessing, and list any field you are unsure about in uncertain. Never output card numbers, CVVs or passwords.
Bill rules: amounts in AUD cents; the total due now; list every date in candidateDates and every amount in candidateAmounts; lower confidence when ambiguous; alreadyPaid only when stated.`;
