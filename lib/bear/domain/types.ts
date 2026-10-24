// Load Bear domain model. PARA is internal (Area → Project → Resource → Archive);
// the UI never shows the acronym. Every AI-derived value is a Traced<T> so the
// origin, confidence and verification state of each field is auditable.

export type TraceSource='model'|'rules'|'user'|'demo'|'derived';
export type Traced<T>={value:T|null;source:TraceSource;confidence:number;userVerified:boolean;lastUpdated:string};
export const traced=<T,>(value:T|null,source:TraceSource,confidence:number,userVerified=false,lastUpdated=new Date().toISOString()):Traced<T>=>({value,source,confidence,userVerified,lastUpdated});

export type Id=string;
export type ISODate=string;      // yyyy-mm-dd
export type ISODateTime=string;  // full ISO timestamp

export interface Owned{id:Id;userId:Id;createdAt:ISODateTime;updatedAt:ISODateTime}

// ---------- Profile (User, Area, Person, PINSProfile, LifeRhythm, NotificationPreference) ----------
export const areaKeys=['work','family','home','money','health','me'] as const;
export type AreaKey=typeof areaKeys[number];
export interface Area extends Owned{key:AreaKey;label:string;archived:boolean}

export const personRoles=['me','partner','child','parent','family','pet','other'] as const;
export type PersonRole=typeof personRoles[number];
export interface Person extends Owned{role:PersonRole;name:string;archived:boolean}

export const needsOptions=['School & childcare','Appointments','Work deadlines','Meals & groceries','Bills & money','Birthdays & presents','Housework','Family calendar','Health','Activities & sport','Forms & admin','Things I just forget'] as const;
export const interestOptions=['Family time','Friends','Movement','Quiet','Creativity','Travel','Learning','Career','Outdoors','Date time','Community','Doing absolutely nothing'] as const;
export const strengthOptions=['Planning ahead','Getting things done','Looking after people','Money','Work','Routines','Cooking','Staying active','Problem solving','Asking for help','Keeping calm in chaos'] as const;
export const toneOptions=['warm','direct','cheeky'] as const;
export type Tone=typeof toneOptions[number];
export const leadTimeOptions=['same_day','day_before','few_days','week'] as const;
export const nudgeToleranceOptions=['minimal','gentle','keen'] as const;
export const planningDetailOptions=['just_the_task','a_few_steps','full_plan'] as const;
export const proactiveOptions=['often','sometimes','rarely'] as const;
export interface Preferences{
 reminderLeadTime:typeof leadTimeOptions[number];
 nudgeTolerance:typeof nudgeToleranceOptions[number];
 planningDetail:typeof planningDetailOptions[number];
 proactiveSuggestions:typeof proactiveOptions[number];
 tone:Tone;
}
export interface PINSProfile{preferences:Preferences;interests:string[];needs:string[];strengths:string[]}

export const rhythmKinds=['morning_rush','commute','work','school_run','after_school','dinner','bedtime','admin','my_time','sleep','weekend','custom'] as const;
export type RhythmKind=typeof rhythmKinds[number];
export const weekdays=['mon','tue','wed','thu','fri','sat','sun'] as const;
export type Weekday=typeof weekdays[number];
// A recurring block in the week. startMinute/endMinute are minutes from midnight local time.
export interface RhythmBlock{id:Id;kind:RhythmKind;label:string;days:Weekday[];startMinute:number;endMinute:number;capacity:'none'|'low'|'some'|'good'}
export interface LifeRhythm{timezone:string;blocks:RhythmBlock[]}

export const emptyMomentOptions=['morning_scramble','mid_afternoon','after_work','dinner_bedtime','sunday_night','it_changes','none'] as const;
export type EmptyMoment=typeof emptyMomentOptions[number];

export interface NotificationPreference{pushEnabled:boolean;quietStartMinute:number;quietEndMinute:number;permission:'unknown'|'granted'|'denied'}

export const dayModes=['good','full','wiped','chaos'] as const;
export type DayMode=typeof dayModes[number];

export interface Profile extends Owned{
 name:string;
 onboardingComplete:boolean;
 onboardingStep:number;
 areas:AreaKey[];
 people:{role:PersonRole;name:string}[];
 pins:PINSProfile;
 lifeRhythm:LifeRhythm;
 emptyMoments:EmptyMoment[];
 notification:NotificationPreference;
 dayMode:DayMode|null;
 dayModeSetAt:ISODateTime|null;
 demoOffered:boolean;
 revision:number;
}

// ---------- Capture ----------
export const captureMethods=['text','manual','photo','screenshot','upload','voice'] as const;
export type CaptureMethod=typeof captureMethods[number];
export const captureStatuses=['received','extracting','needs_verification','verified','rejected','failed'] as const;
export type CaptureStatus=typeof captureStatuses[number];
export interface Capture extends Owned{method:CaptureMethod;status:CaptureStatus;text:string|null;documentId:Id|null;extractionId:Id|null;error:string|null;isDemo:boolean}
export interface SourceDocument extends Owned{captureId:Id;objectKey:string;mime:string;bytes:number;originalName:string;isDemo:boolean}

// ---------- Extraction ----------
export const billCategories=['electricity','gas','water','internet','mobile','council_rates','car_registration','insurance','school_fees','childcare','sports_fees','subscription','rent','strata','medical','other'] as const;
export type BillCategory=typeof billCategories[number];
export const recurrences=['weekly','fortnightly','monthly','quarterly','half_yearly','yearly','unknown'] as const;
export type Recurrence=typeof recurrences[number];
export const paymentMethods=['bpay','direct_debit','card_online','post_billpay','centrepay','bank_transfer','in_app','other'] as const;
export type PaymentMethod=typeof paymentMethods[number];
export type DocumentType='bill'|'receipt'|'reminder_notice'|'statement'|'not_a_bill';

export interface Candidate<T>{label:string;value:T;evidence:string}
export interface BillFields{
 documentType:DocumentType;
 biller:Traced<string>;
 billerKey:string|null;
 category:Traced<BillCategory>;
 amountDueCents:Traced<number>;
 dueDate:Traced<ISODate>;
 issueDate:Traced<ISODate>;
 accountReference:Traced<string>;
 isRecurring:Traced<boolean>;
 expectedRecurrence:Traced<Recurrence>;
 paymentMethods:Traced<PaymentMethod[]>;
 paymentUrl:Traced<string>;
 bpayBillerCode:Traced<string>;
 bpayReference:Traced<string>;
 directDebitActive:Traced<boolean>;
 lateFeeCents:Traced<number>;
 earlyDiscountCents:Traced<number>;
 discountDeadline:Traced<ISODate>;
 servicePeriodStart:Traced<ISODate>;
 servicePeriodEnd:Traced<ISODate>;
 personHint:Traced<string>;
 alreadyPaid:Traced<boolean>;
 candidateDates:Candidate<ISODate>[];
 candidateAmounts:Candidate<number>[];
 notes:string|null;
}
export type BillFieldKey=Exclude<keyof BillFields,'documentType'|'billerKey'|'candidateDates'|'candidateAmounts'|'notes'>;
export type GeneralFieldKey='title'|'area'|'when'|'timeOfDay'|'person'|'location'|'isRecurring';
export interface VerificationQuestion{field:BillFieldKey|GeneralFieldKey;question:string;options:{label:string;value:string|number|boolean|null}[]}
// What Bear understood from any capture, before the user confirms it.
export const captureKinds=['bill','appointment','school','form','errand','shopping','message','note','event','other'] as const;
export type CaptureKind=typeof captureKinds[number];
export interface GeneralFields{kind:CaptureKind;summary:string;title:Traced<string>;area:Traced<AreaKey>;when:Traced<ISODate>;timeOfDay:Traced<string>;person:Traced<string>;location:Traced<string>;isRecurring:Traced<boolean>;steps:string[];estimatedMinutes:number|null}
export interface ExtractedEntity extends Owned{captureId:Id;kind:'bill'|'task';status:'draft'|'verified'|'rejected';fields:BillFields;general:GeneralFields;questions:VerificationQuestion[];sourceText:string|null;inferenceId:Id|null;duplicateOfBillId:Id|null}
export interface AIInference extends Owned{captureId:Id|null;service:string;provider:string;model:string;promptHash:string;rawOutput:unknown;latencyMs:number;ok:boolean;error:string|null}
export interface UserCorrection extends Owned{extractionId:Id;field:string;from:unknown;to:unknown}

// ---------- PARA ----------
export interface Project extends Owned{areaKey:AreaKey;title:string;status:'active'|'done'|'archived';dueAt:ISODate|null;resourceDocumentIds:Id[];billId:Id|null}
export const taskKinds=['pay_bill','check_balance','confirm_discount','confirm_discrepancy','transfer_money','save_receipt','appointment','school','form','errand','shopping','message','note','event','custom'] as const;
export type TaskKind=typeof taskKinds[number];
export interface Task extends Owned{projectId:Id;kind:TaskKind;title:string;status:'open'|'done'|'dropped'|'archived';dueAt:ISODate|null;dueTime?:string|null;location?:string|null;notes?:string|null;estimatedMinutes:number;cognitiveEffort:'low'|'medium'|'high';forPerson:string|null;isDemo:boolean}
export interface TaskDependency extends Owned{taskId:Id;dependsOnTaskId:Id}

// ---------- Bill ----------
export type BillStatus='watching'|'due_soon'|'paid'|'dropped'|'archived';
export interface Bill extends Owned{taskId:Id;projectId:Id;extractionId:Id|null;documentId:Id|null;status:BillStatus;billerKey:string|null;biller:string;category:BillCategory;amountCents:number;dueAt:ISODate|null;fields:BillFields;paidAt:ISODateTime|null;isDemo:boolean;recurringExpectationId:Id|null;previousBillId:Id|null}
export interface RecurringExpectation extends Owned{billerKey:string;biller:string;category:BillCategory;recurrence:Recurrence;status:'expecting'|'arrived'|'missing'|'cancelled';lastDueAt:ISODate;expectedFrom:ISODate;expectedTo:ISODate;typicalAmountCents:number|null;observedDueDates:ISODate[];lastBillId:Id}

// ---------- Reminder ----------
export type ReminderKind='planned'|'follow_up'|'deadline';
export type ReminderStatus='scheduled'|'delivered'|'actioned'|'snoozed'|'dismissed'|'cancelled';
export interface ReminderPlan{scheduledFor:ISODateTime;label:string;rationale:string;windowId:Id|null;score:number}
export interface Reminder extends Owned{taskId:Id;billId:Id|null;kind:ReminderKind;status:ReminderStatus;scheduledFor:ISODateTime;plan:ReminderPlan;followUpIfUnpaid:boolean;attempts:number;deliveredAt:ISODateTime|null;deliveredVia:('in_app'|'local'|'push')[];message:string}
export type ReminderAction='delivered'|'opened'|'snoozed'|'dismissed'|'helped'|'completed'|'not_important'|'rescheduled';
export interface ReminderInteraction extends Owned{reminderId:Id;action:ReminderAction;detail:string|null}

// ---------- Suggestion ----------
export const suggestionKinds=['expect_recurring','watch_annual','bill_increased','discount_available','add_related_areas','missing_expected','plan_not_helping','demo_bill'] as const;
export type SuggestionKind=typeof suggestionKinds[number];
export interface Suggestion extends Owned{kind:SuggestionKind;status:'open'|'accepted'|'rejected'|'expired';dedupeKey:string;title:string;body:string;actionLabel:string;payload:Record<string,unknown>}

// ---------- Completion, Win, Ledger ----------
export interface Completion extends Owned{taskId:Id;billId:Id|null;completedAt:ISODateTime;daysBeforeDue:number|null;method:string|null}
export type WinCategory='handled'|'money'|'time'|'me';
export interface Win extends Owned{completionId:Id;category:WinCategory;title:string;detail:string;amountCents:number|null;minutes:number|null;billId:Id|null;isDemo:boolean}
export type LedgerKind='wealth'|'health'|'happiness';
export type WealthReason='late_fee_avoided'|'early_discount_used'|'subscription_cancelled'|'better_price'|'discount_used'|'duplicate_charge';
export interface ValueLedgerEntry extends Owned{kind:LedgerKind;reason:WealthReason|'care_task'|'protected_time';label:string;amountCents:number|null;minutes:number|null;occurredAt:ISODateTime;sourceTaskId:Id|null;sourceBillId:Id|null;defensible:boolean;isDemo:boolean}

// ---------- Behaviour ----------
export const behaviourTypes=['suggestion_accepted','suggestion_rejected','task_completed','reminder_delivered','reminder_opened','reminder_snoozed','reminder_dismissed','capture_created','capture_rejected','field_corrected','task_dropped','day_mode_set','rhythm_changed','assist_used','plan_accepted','plan_changed'] as const;
export type BehaviourType=typeof behaviourTypes[number];
export interface BehaviourEvent extends Owned{type:BehaviourType;at:ISODateTime;hourLocal:number;weekday:Weekday;detail:Record<string,unknown>}

export interface PushSubscriptionRow extends Owned{endpoint:string;keys:{p256dh:string;auth:string};userAgent:string|null}

// ---------- Capacity (derived) ----------
export interface CapacityWindow{id:Id;start:ISODateTime;end:ISODateTime;label:string;time:number;cognitive:number;physical:number;emotionalLoad:number;routineFit:number;history:number;score:number;protected:boolean}
