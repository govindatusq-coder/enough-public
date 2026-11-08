// The Responsibility Engine's public contract. CAPTURE → INTERPRET → PLAN → COORDINATE → ACT → VERIFY →
// CLOSE are internal stages; people never see these words. The engine is used by the consumer app and the
// enterprise API alike, so everything here is plain data with no UI or storage concerns.

// How Bear knows a fact: the source states it, Bear worked it out, or nobody knows yet.
export type FactBasis='explicit'|'inferred'|'unknown';
export interface EvidenceReference{sourceId:string;location?:string;excerpt?:string}
export interface ExtractedResponsibility{
 title:string;description?:string;domain?:string;responsibilityPattern?:string;
 dueDate?:string|null;dueDateBasis:FactBasis;dueDateEvidence?:string|null;
 eventDate?:string|null;eventDateBasis:FactBasis;
 amountCents?:number|null;responsiblePerson?:string|null;
 requiredActions:string[];dependencies:string[];missingInformation:string[];
 sourceEvidence:EvidenceReference[];confidence:number;requiresConfirmation:boolean;
 groupKey?:string|null;   // responsibilities from the same event or bill share a key
}
export interface ResponsibilityExtraction{
 sourceId:string;sourceType:'image'|'document'|'voice'|'text'|'message';
 responsibilities:ExtractedResponsibility[];extractionTimestamp:string;processingStatus:'success'|'partial'|'failed';
 warnings:string[];       // e.g. instructions inside the source that were ignored
}

// The lifecycle, derived from what Bear actually knows. Not every responsibility visits every state.
export const responsibilityStates=['identified','needs_clarification','planned','ready','in_progress','waiting','completed_unverified','verified','closed','cancelled'] as const;
export type ResponsibilityState=typeof responsibilityStates[number];
export type VerificationMethod='user_confirmation'|'document'|'forwarded_email'|'integration';
export interface ResponsibilityEvent{
 id:string;userId:string;createdAt:string;updatedAt:string;
 responsibilityId:string;eventType:'state_changed'|'state_conflict'|'update_proposed'|'update_applied'|'duplicate_merged'|'action_prepared'|'action_failed'|'approval_requested'|'verified';
 previousState?:ResponsibilityState|null;nextState?:ResponsibilityState|null;
 actor:'user'|'system'|'integration';at:string;evidenceId?:string|null;
 // Minimal, non-sensitive metadata only (never notice text, names or amounts).
 metadata?:Record<string,string|number|boolean|null>;
}
