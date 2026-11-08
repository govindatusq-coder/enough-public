import type {CognitiveOperation,Ownership,PatternId} from '../load/types.ts';

// Bear Coverage Packs: a category of life Bear can progressively help manage (School Admin,
// Household Bills, Car...). Not separate apps: each pack layers category-specific understanding
// onto the existing Load Patterns, LoadGraph, ownership and Bear Ideas. A pack never claims a
// capability that isn't implemented: `status` says whether it is real ('full') or a definition only.
export type PackId='school'|'bills'|'car'|'home'|'family'|'health';
export type CapabilityKey='store'|'extract'|'decompose'|'prioritise'|'remind'|'notify'|'draft'|'record_confirmation'|'inbound_email'|'read_email'|'calendar'|'bank'|'pay'|'contact_external'|'submit_forms'|'book'|'verify_external';
export interface CoveragePack{
 id:PackId;name:string;status:'full'|'definition';
 patterns:PatternId[];                   // the existing Load Patterns it interprets
 obligations:string[];                   // 1. what it recognises
 sources:string[];                       // 2. information it can process
 anticipates:string[];                   // 3. recurring events (only from the person's own history)
 dependencies:string[];                  // 4. dependencies it understands
 prepares:string[];                      // 5. actions it prepares
 humanActions:string[];                  // 6. actions requiring a human
 completionEvidence:string[];            // 7. evidence that confirms completion
 followUpWhen:string[];                  // 8. when it follows up
 boundaries:string[];                    // 9. what it cannot do or see (shown honestly)
 silentWhen:string[];                    // 10. when it stays quiet
 requires:CapabilityKey[];               // capabilities its prepared actions depend on
}

// Evidence levels. Inferred is never shown as confirmed. A deadline passing, a reminder being
// delivered or a drafted message are not evidence that anything happened.
export type EvidenceLevel='confirmed'|'user_confirmed'|'inferred'|'unknown';
export type EvidenceSource='user'|'receipt'|'email'|'provider'|'time'|'system'|null;
export interface CompletionEvidence{level:EvidenceLevel;source:EvidenceSource;confidence:number;verifiedAt:string|null}

// Responsibility per cognitive operation (metadata over the existing LoadGraph, not a new lifecycle).
export type ResponsibilityState='recognised'|'prepared'|'awaiting_human'|'awaiting_external'|'awaiting_verification'|'confirmed';
export interface OperationResponsibility{
 operation:CognitiveOperation;actor:Ownership;capability:CapabilityKey;state:ResponsibilityState;
 evidence:EvidenceLevel;confidence:number;lastVerifiedAt:string|null;nextAction:string|null;humanRequired:boolean;
 performedByBear:boolean;   // counts towards Responsibility Transferred only when backed by a real system event
}
