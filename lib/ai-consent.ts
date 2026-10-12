import {z} from 'zod';

export const AI_CONSENT_VERSION=1;
export const aiConsentChoices=['full','without-health','declined'] as const;
export const aiConsentSchema=z.object({
 choice:z.enum(aiConsentChoices),
 version:z.number().int().min(1).max(10000),
 decidedAt:z.string().datetime({offset:true})
}).strict();
export type AiConsent=z.infer<typeof aiConsentSchema>;
export type AiConsentChoice=AiConsent['choice'];
export class AiConsentRequired extends Error{
 constructor(message='Choose whether OpenAI can prepare ideas and pictures in AI and privacy settings first.'){super(message);}
}
export function createAiConsent(choice:AiConsentChoice,now=new Date()):AiConsent{
 return aiConsentSchema.parse({choice,version:AI_CONSENT_VERSION,decidedAt:now.toISOString()});
}
export function requireAiConsent(value:unknown):AiConsent{
 const parsed=aiConsentSchema.safeParse(value);
 if(!parsed.success||parsed.data.version!==AI_CONSENT_VERSION||parsed.data.choice==='declined')throw new AiConsentRequired();
 return parsed.data;
}
export function hasAiConsent(value:unknown){try{requireAiConsent(value);return true;}catch{return false;}}
export function checkCurrentAiConsent(expected:AiConsent,value:unknown){
 const current=requireAiConsent(value);
 if(current.choice!==expected.choice||current.version!==expected.version||current.decidedAt!==expected.decidedAt)throw new AiConsentRequired('Your AI choice changed while this request was being prepared. Review it before requesting another batch.');
}
export const aiConsentLabels:Record<AiConsentChoice,string>={full:'Use AI ideas', 'without-health':'Use AI ideas without my health needs',declined:'Not now'};
