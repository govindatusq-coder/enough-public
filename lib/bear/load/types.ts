// Load Bear's load model. A "load" is a piece of unresolved life the person would otherwise
// carry in their head. Bear captures it, recognises its pattern, decomposes it internally,
// takes ownership of what it genuinely can, and surfaces only the minimum human action.
// Complexity lives here, behind the interface: the UI shows "what needs me" and "what Bear has covered".

export const loadStates=['captured','covered','needs_user','waiting','resolved'] as const;
export type LoadState=typeof loadStates[number];

export const cognitiveOperations=['anticipate','understand','identify','decide','plan','coordinate','remember','monitor','follow_up','close'] as const;
export type CognitiveOperation=typeof cognitiveOperations[number];

export const ownerships=['bear','bear_prepares','human','external_system'] as const;
export type Ownership=typeof ownerships[number];

export const loadDomains=['kids','home','work','money','health','people','life_admin','pets','other'] as const;
export type LoadDomain=typeof loadDomains[number];

export const patternIds=['BILL_PAYMENT','SCHOOL_EVENT','APPOINTMENT','FORM_APPLICATION','REPAIR_PROBLEM','WAITING_FOR_RESPONSE','PURCHASE_REQUIRED','RENEWAL','INVITATION_EVENT','REPLENISHMENT','UNKNOWN_LOAD'] as const;
export type PatternId=typeof patternIds[number];

export type HumanActionKind='decision'|'confirmation'|'information'|'signature'|'payment'|'physical'|'approval';

// What Bear can genuinely do today. Ownership is never claimed beyond this.
export interface Capabilities{
 reminders:boolean;      // in-app reminders (always on)
 push:boolean;           // device push when the app is closed
 email:boolean;          // can read the person's inbox
 calendar:boolean;       // can read or write their calendar
 payments:boolean;       // can see whether a payment went through
 orderTracking:boolean;  // can see deliveries
 providers:boolean;      // can contact services on their behalf
}
export const currentCapabilities=(push=false):Capabilities=>({reminders:true,push,email:false,calendar:false,payments:false,orderTracking:false,providers:false});

// Entities pulled out of the input. Deterministic extraction fills these; AI may add more.
export interface LoadEntities{
 title?:string|null;
 amountCents?:number|null;
 amounts?:number[];
 dueDate?:string|null;        // the act-by date (yyyy-mm-dd)
 eventDate?:string|null;      // when the thing happens
 eventEndDate?:string|null;
 time?:string|null;
 person?:string|null;
 people?:string[];
 provider?:string|null;
 location?:string|null;
 items?:string[];
 reference?:string|null;
 expiryDate?:string|null;
 rsvpDate?:string|null;
 flags?:string[];             // consent, payment, autopay, disputed, duplicate, overdue, telehealth, referral, cancelled, rescheduled, urgent, safety, rental, warranty, booked, submitted, ordered, recurring, ...
}

export interface PatternStepTemplate{
 key:string;
 operation:CognitiveOperation;
 owner:Ownership;
 human?:HumanActionKind;
 // Plain words for the person. {amount} {date} {event} {provider} {person} {item} are filled in.
 label:string;
 cta?:string;
 dependsOn?:string[];
 // Include this step only when the input shows it applies.
 when?:(e:LoadEntities)=>boolean;
 due?:(e:LoadEntities)=>string|null;
 // Do not surface before this date (Rule 7: decisions at the moment they matter).
 surfaceFrom?:(e:LoadEntities,today:string)=>string|null;
 waitingFor?:(e:LoadEntities)=>string;
 // Evidence this step produces when it is done.
 evidence?:string;
 // Needs a capability to be owned outright; otherwise ownership degrades honestly.
 requires?:keyof Capabilities;
 // A decision with named answers; each answer records its own evidence.
 choices?:{label:string;evidence:string}[];
 // Said when the person marks it done.
 doneText?:string;
 // Only becomes active once this evidence exists (e.g. a gift only once they said yes).
 requiresEvidence?:string;
 // Skipped once any of this evidence exists (e.g. no tradie once they chose to fix it themselves).
 skipIf?:string[];
 // A different wording once some evidence exists.
 labelIf?:{evidence:string;label:string}[];
}

export interface LoadPattern{
 id:PatternId;
 name:string;
 domain:LoadDomain;
 description:string;
 recognition:{signals:{match:RegExp;weight:number}[];entityHints:string[];confidenceThreshold:number;competingPatterns?:PatternId[];captureKinds?:string[];
  // When this pattern is also recognised and the context matches, it outranks a competitor
  // (a Year 6 dinner is a school event before it is a social one).
  dominates?:{pattern:PatternId;when:RegExp}[]};
 interpretation:{requiredEntities:(keyof LoadEntities)[];optionalEntities:(keyof LoadEntities)[];waivers?:Partial<Record<keyof LoadEntities,string[]>>};
 cognitiveOperations:CognitiveOperation[];
 decomposition:{steps:PatternStepTemplate[];typicalDependencies:string[];decisions:string[];actions:string[];possibleWaitingStates:string[]};
 ownershipRules:{bearCanOwn:CognitiveOperation[];bearCanPrepare:string[];humanRequired:string[];externalSystemPossible:string[]};
 intervention:{minimumHumanActionStrategy:string;surfaceRules:string[];hideRules:string[];escalationRules:string[]};
 waiting:{supported:boolean;monitoringStrategies?:string[];escalationStrategies?:string[]};
 closure:{conditions:string[][];conditionsFor?:(e:LoadEntities)=>string[][];evidence:string[];description:string};
 recurrence?:{supported:boolean;strategy?:string};
 // Patterns this one may carry as attached sub-loads, and what signals them.
 attaches?:{pattern:PatternId;when:(e:LoadEntities,text:string)=>boolean}[];
}

export interface WaitingState{
 waitingFor:string;
 startedAt:string;
 expectedBy?:string|null;
 monitoringMethod:'system'|'integration'|'user_confirmation'|'time_based';
 nextCheckAt?:string|null;
 escalationAt?:string|null;
}

export interface Evidence{key:string;at:string;source:'user'|'system'|'time'}

export interface LoadStep{
 id:string;key:string;label:string;cta:string|null;
 operation:CognitiveOperation;owner:Ownership;human:HumanActionKind|null;
 dependsOn:string[];status:'pending'|'done'|'skipped';
 dueAt:string|null;surfaceFrom:string|null;waitingFor:string|null;evidence:string|null;
 // Set when the ownership engine had to degrade a claim because a capability is missing.
 degraded:string|null;
 choices:{label:string;evidence:string}[]|null;
 doneText:string|null;
 requiresEvidence:string|null;
 skipIf:string[];
 labelIf:{evidence:string;label:string}[];
}

export interface LoadNode{
 id:string;pattern:PatternId;role:'primary'|'attached';parentId:string|null;
 title:string;confidence:number;entities:LoadEntities;
 steps:LoadStep[];state:LoadState;waiting:WaitingState|null;
 evidence:Evidence[];resolvedAt:string|null;
 clarification:{question:string;choices:string[]}|null;
 // An attached load that only matters once the parent has this evidence (a present once they said yes).
 gate:{evidence:string;notNeededIf:string[]}|null;
}

export interface LoadGraph{version:1;primaryId:string;nodes:LoadNode[];createdAt:string;updatedAt:string;migrated?:boolean}

export interface MinimumHumanAction{nodeId:string;stepId:string;kind:HumanActionKind;headline:string;cta:string;dueAt:string|null;choices:{label:string;evidence:string}[]|null}

export type CognitiveLoadVector=Record<CognitiveOperation,Ownership|null>;

// ---------- Load Map: the person and household, not individual tasks ----------
export interface LoadMap{
 domains:Partial<Record<LoadDomain,boolean>>;
 household?:{adults?:number;children?:{ageBand:'0-4'|'5-11'|'12-17'|'18+'}[];dependants?:number;pets?:boolean;shape?:string[]};
 responsibilities?:{area:string;who:'me'|'shared'|'someone_else'}[];
 workPattern?:{type?:string;schedule?:string;flexibility?:string};
 caringResponsibilities?:string[];
 locationContext?:{country?:string;region?:string;localityType?:'urban'|'regional'|'rural'|'unknown'};
 cognitiveProfile?:Partial<Record<'remembering'|'deciding'|'planning'|'initiating'|'coordinating'|'monitoring'|'followingUp',number>>;
 struggles?:string[];
 handover?:string[];
 preferences?:{canWait?:'leave'|'gentle'|'visible';urgent?:'tell'|'persistent'|'help';ignored?:'keep'|'ask'|'back_off';reminderStyle?:string;persistence?:string;preferredTiming?:string;bundling?:string;interruptionTolerance?:string};
 providers?:{pattern:PatternId;name:string;uses:number}[];
 learned?:{billLeadDays?:number;followUpDays?:number;choices?:Record<string,number>};
}
