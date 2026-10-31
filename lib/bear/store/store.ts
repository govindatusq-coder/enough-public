import type {AIInference,Area,BehaviourEvent,Bill,Capture,Completion,ExtractedEntity,Owned,Person,Profile,Project,PushSubscriptionRow,RecurringExpectation,Reminder,ReminderInteraction,SourceDocument,Suggestion,Task,TaskDependency,UserCorrection,ValueLedgerEntry,Win} from '../domain/types.ts';

// Table names map 1:1 to public.bear_* tables. Each table stores the full entity
// as `body` plus the indexed columns declared in `indexes` below.
export interface Tables{
 profiles:Profile;areas:Area;people:Person;captures:Capture;source_documents:SourceDocument;extractions:ExtractedEntity;
 ai_inferences:AIInference;user_corrections:UserCorrection;projects:Project;tasks:Task;task_dependencies:TaskDependency;
 bills:Bill;recurring_expectations:RecurringExpectation;reminders:Reminder;reminder_interactions:ReminderInteraction;
 suggestions:Suggestion;completions:Completion;wins:Win;value_ledger:ValueLedgerEntry;behaviour_events:BehaviourEvent;push_subscriptions:PushSubscriptionRow;
}
export type TableName=keyof Tables;

// Columns (beyond id/user_id/created_at/updated_at) that exist as real Postgres columns
// and may be used in `where`/`orderBy`. The value is derived from the entity on write.
export const indexes:{[K in TableName]:{[column:string]:(row:Tables[K])=>unknown}}={
 profiles:{onboarding_complete:r=>r.onboardingComplete,day_mode:r=>r.dayMode,revision:r=>r.revision},
 areas:{key:r=>r.key,archived:r=>r.archived},
 people:{role:r=>r.role,archived:r=>r.archived},
 captures:{status:r=>r.status,method:r=>r.method,is_demo:r=>r.isDemo},
 source_documents:{capture_id:r=>r.captureId,object_key:r=>r.objectKey,mime:r=>r.mime},
 extractions:{capture_id:r=>r.captureId,kind:r=>r.kind,status:r=>r.status},
 ai_inferences:{capture_id:r=>r.captureId,service:r=>r.service,provider:r=>r.provider,model:r=>r.model,ok:r=>r.ok},
 user_corrections:{extraction_id:r=>r.extractionId,field:r=>r.field},
 projects:{area_key:r=>r.areaKey,status:r=>r.status,due_at:r=>r.dueAt,bill_id:r=>r.billId},
 tasks:{project_id:r=>r.projectId,status:r=>r.status,due_at:r=>r.dueAt,kind:r=>r.kind,is_demo:r=>r.isDemo},
 task_dependencies:{task_id:r=>r.taskId,depends_on_task_id:r=>r.dependsOnTaskId},
 bills:{task_id:r=>r.taskId,project_id:r=>r.projectId,status:r=>r.status,due_at:r=>r.dueAt,biller_key:r=>r.billerKey,amount_cents:r=>r.amountCents,is_demo:r=>r.isDemo},
 recurring_expectations:{biller_key:r=>r.billerKey,status:r=>r.status,expected_from:r=>r.expectedFrom,expected_to:r=>r.expectedTo},
 reminders:{task_id:r=>r.taskId,bill_id:r=>r.billId,status:r=>r.status,scheduled_for:r=>r.scheduledFor,kind:r=>r.kind},
 reminder_interactions:{reminder_id:r=>r.reminderId,action:r=>r.action},
 suggestions:{status:r=>r.status,kind:r=>r.kind,dedupe_key:r=>r.dedupeKey},
 completions:{task_id:r=>r.taskId,bill_id:r=>r.billId,completed_at:r=>r.completedAt},
 wins:{completion_id:r=>r.completionId,category:r=>r.category,bill_id:r=>r.billId,is_demo:r=>r.isDemo},
 value_ledger:{kind:r=>r.kind,reason:r=>r.reason,amount_cents:r=>r.amountCents,minutes:r=>r.minutes,occurred_at:r=>r.occurredAt,defensible:r=>r.defensible,is_demo:r=>r.isDemo},
 behaviour_events:{type:r=>r.type,at:r=>r.at,hour_local:r=>r.hourLocal,weekday:r=>r.weekday},
 push_subscriptions:{endpoint:r=>r.endpoint},
};

export type Where={column:string;op?:'eq'|'neq'|'lte'|'gte'|'lt'|'gt'|'in';value:unknown};
export interface Query{where?:Where[];orderBy?:{column:string;ascending?:boolean};limit?:number}

export interface StoredFile{objectKey:string;mime:string;bytes:number}

export interface BearStore{
 readonly userId:string;
 get<K extends TableName>(table:K,id:string):Promise<Tables[K]|null>;
 list<K extends TableName>(table:K,query?:Query):Promise<Tables[K][]>;
 insert<K extends TableName>(table:K,row:Tables[K]):Promise<Tables[K]>;
 update<K extends TableName>(table:K,id:string,patch:Partial<Tables[K]>):Promise<Tables[K]>;
 remove<K extends TableName>(table:K,id:string):Promise<void>;
 putFile(objectKey:string,bytes:Uint8Array,mime:string):Promise<StoredFile>;
 getFile(objectKey:string):Promise<{bytes:Uint8Array;mime:string}|null>;
 fileUrl(objectKey:string,expiresSeconds?:number):Promise<string|null>;
}

export type StoreErrorCode='not_found'|'conflict'|'unavailable'|'invalid';
export class StoreError extends Error{readonly code:StoreErrorCode;constructor(message:string,code:StoreErrorCode='unavailable'){super(message);this.name='StoreError';this.code=code;}}

export const newId=()=>globalThis.crypto.randomUUID();
export const now=()=>new Date().toISOString();
export function stamp<T extends Owned>(userId:string,fields:Omit<T,keyof Owned>&Partial<Owned>):T{
 const at=now();
 return {id:fields.id||newId(),userId,createdAt:fields.createdAt||at,updatedAt:at,...fields} as T;
}
