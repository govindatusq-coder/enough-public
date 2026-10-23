import {z} from 'zod';
import {addDays,formatAU,isValidISODate,parseISODate} from '../domain/dates.ts';
import {billCategories,paymentMethods,recurrences,traced,type Area,type Bill,type BillFieldKey,type BillFields,type Project,type Task,type TaskDependency,type UserCorrection} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';
import {recordBehaviour} from './behaviour.ts';
import {keyFields} from './bill-extraction.ts';
import {ensureProfile} from './profile.ts';
import {slug} from '../ai/rules.ts';

// TaskInferenceService + DependencyPlanningService. A verified bill becomes
// Area Money → Project "Pay November electricity bill" → Task "Pay electricity bill"
// with the original document as the Resource, plus only the dependencies the bill warrants.
export const categoryLabels:Record<string,string>={electricity:'Electricity',gas:'Gas',water:'Water',internet:'Internet',mobile:'Mobile phone',council_rates:'Council rates',car_registration:'Car registration',insurance:'Insurance',school_fees:'School fees',childcare:'Childcare',sports_fees:'Sports fees',subscription:'Subscription',rent:'Rent',strata:'Strata',medical:'Medical',other:'Bill'};

const corrections=z.object({
 biller:z.string().trim().min(1).max(120).optional(),category:z.enum(billCategories).optional(),amountDueCents:z.number().int().min(1).max(100000000).optional(),
 dueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),issueDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),accountReference:z.string().trim().max(80).nullable().optional(),
 isRecurring:z.boolean().optional(),expectedRecurrence:z.enum(recurrences).optional(),paymentMethods:z.array(z.enum(paymentMethods)).max(8).optional(),paymentUrl:z.string().url().max(500).nullable().optional(),
 bpayBillerCode:z.string().regex(/^\d{3,10}$/).nullable().optional(),bpayReference:z.string().regex(/^[\dA-Za-z]{4,30}$/).nullable().optional(),directDebitActive:z.boolean().optional(),
 lateFeeCents:z.number().int().min(0).max(10000000).nullable().optional(),earlyDiscountCents:z.number().int().min(0).max(10000000).nullable().optional(),discountDeadline:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
 personHint:z.string().trim().max(80).nullable().optional(),alreadyPaid:z.boolean().optional(),
}).strict();
export const confirmBillSchema=z.object({extractionId:z.string().uuid(),corrections:corrections.default({}),confirmedFields:z.array(z.string().max(40)).max(30).default([]),allowDuplicate:z.boolean().default(false),forPerson:z.string().trim().max(40).nullable().default(null)}).strict();
export type ConfirmBillInput=z.infer<typeof confirmBillSchema>;
export class ConfirmError extends Error{readonly status:number;readonly code:string;constructor(message:string,status=400,code='invalid'){super(message);this.name='ConfirmError';this.status=status;this.code=code;}}

export function applyCorrections(fields:BillFields,input:ConfirmBillInput['corrections'],confirmed:string[]):{fields:BillFields;changes:{field:string;from:unknown;to:unknown}[]}{
 const at=new Date().toISOString();const next:BillFields={...fields};const changes:{field:string;from:unknown;to:unknown}[]=[];
 for(const [key,value] of Object.entries(input) as [BillFieldKey,unknown][]){
  if(value===undefined)continue;const current=next[key] as {value:unknown};
  if(JSON.stringify(current.value)!==JSON.stringify(value))changes.push({field:key,from:current.value,to:value});
  (next as unknown as Record<string,unknown>)[key]=traced(value,'user',1,true,at);
 }
 for(const key of confirmed){const t=(next as unknown as Record<string,{value:unknown;confidence:number;userVerified:boolean;source:string;lastUpdated:string}>)[key];if(t&&typeof t==='object'&&'confidence' in t&&t.value!==null)(next as unknown as Record<string,unknown>)[key]={...t,confidence:1,userVerified:true,lastUpdated:at};}
 if(input.biller&&!next.billerKey)next.billerKey=slug(input.biller);
 if(input.biller&&fields.biller.value!==input.biller)next.billerKey=slug(input.biller);
 return {fields:next,changes};
}
export function projectTitle(f:BillFields){const due=f.dueDate.value?parseISODate(f.dueDate.value):null;const month=due?due.toLocaleDateString('en-AU',{month:'long'}):'';const cat=categoryLabels[f.category.value||'other'].toLowerCase();return `Pay ${month?month+' ':''}${cat==='bill'?(f.biller.value||'bill'):cat+' bill'}`.replace(/\s+/g,' ');}
export function taskTitle(f:BillFields){const cat=f.category.value;return cat&&cat!=='other'?`Pay ${categoryLabels[cat].toLowerCase()} bill`:`Pay ${f.biller.value||'bill'}`;}

export async function confirmBill(store:BearStore,input:ConfirmBillInput){
 const extraction=await store.get('extractions',input.extractionId);
 if(!extraction)throw new ConfirmError('That capture could not be found.',404,'not_found');
 if(extraction.status==='verified')throw new ConfirmError("Bear already has this one.",409,'already_confirmed');
 const {fields,changes}=applyCorrections(extraction.fields,input.corrections,input.confirmedFields);
 for(const c of changes){await store.insert('user_corrections',stamp<UserCorrection>(store.userId,{extractionId:extraction.id,field:c.field,from:c.from,to:c.to}));await recordBehaviour(store,'field_corrected',{field:c.field});}
 // Mandatory human confirmation: every key field must be present and verified.
 for(const key of keyFields){const t=fields[key];if(t.value===null||t.value===''||!t.userVerified)throw new ConfirmError(key==='dueDate'?'Bear needs a due date before it can look after this.':key==='amountDueCents'?'Bear needs the amount before it can look after this.':'Bear needs to know who the bill is from.',400,'unverified_'+key);}
 if(!isValidISODate(fields.dueDate.value))throw new ConfirmError('That due date is not valid.',400,'invalid_date');
 if(fields.alreadyPaid.value===true)throw new ConfirmError("This bill is marked as already paid, so there is nothing to carry. Change that if it still needs paying.",400,'already_paid');
 if(extraction.duplicateOfBillId&&!input.allowDuplicate){const dup=await store.get('bills',extraction.duplicateOfBillId);if(dup&&dup.status!=='dropped')throw new ConfirmError(`Bear is already watching a ${dup.biller} bill for ${formatAU(dup.dueAt)}.`,409,'duplicate');}
 const profile=await ensureProfile(store);
 let area=(await store.list('areas',{where:[{column:'key',value:'money'}]}))[0];
 if(!area)area=await store.insert('areas',stamp<Area>(store.userId,{key:'money',label:'Money',archived:false}));
 else if(area.archived)await store.update('areas',area.id,{archived:false});
 if(!profile.areas.includes('money'))await store.update('profiles',profile.id,{areas:[...profile.areas,'money']});
 const capture=await store.get('captures',extraction.captureId);
 const dueAt=fields.dueDate.value!;
 const project=await store.insert('projects',stamp<Project>(store.userId,{areaKey:'money',title:projectTitle(fields),status:'active',dueAt,resourceDocumentIds:capture?.documentId?[capture.documentId]:[],billId:null}));
 const task=await store.insert('tasks',stamp<Task>(store.userId,{projectId:project.id,kind:'pay_bill',title:taskTitle(fields),status:'open',dueAt,estimatedMinutes:fields.paymentUrl.value||fields.bpayBillerCode.value?2:5,cognitiveEffort:'low',forPerson:input.forPerson||fields.personHint.value||null,isDemo:!!capture?.isDemo}));
 const previous=fields.billerKey?(await store.list('bills',{where:[{column:'biller_key',value:fields.billerKey},{column:'status',op:'in',value:['paid','watching','due_soon']}],orderBy:{column:'due_at',ascending:false},limit:1}))[0]:undefined;
 const bill=await store.insert('bills',stamp<Bill>(store.userId,{taskId:task.id,projectId:project.id,extractionId:extraction.id,documentId:capture?.documentId||null,status:'watching',billerKey:fields.billerKey,biller:fields.biller.value!,category:fields.category.value||'other',amountCents:fields.amountDueCents.value!,dueAt,fields,paidAt:null,isDemo:!!capture?.isDemo,recurringExpectationId:null,previousBillId:previous?.id||null}));
 await store.update('projects',project.id,{billId:bill.id});
 await store.update('extractions',extraction.id,{status:'verified',fields});
 if(capture)await store.update('captures',capture.id,{status:'verified'});
 const dependencies=await planDependencies(store,task,bill,profile.pins.preferences.planningDetail);
 return {bill,task,project,dependencies};
}

// Only dependencies the bill actually warrants. The user never sees PM complexity otherwise.
export async function planDependencies(store:BearStore,task:Task,bill:Bill,detail:'just_the_task'|'a_few_steps'|'full_plan'){
 const created:Task[]=[];const f=bill.fields;
 const add=async(kind:Task['kind'],title:string,dueAt:string|null,minutes:number)=>{const t=await store.insert('tasks',stamp<Task>(store.userId,{projectId:task.projectId,kind,title,status:'open',dueAt,estimatedMinutes:minutes,cognitiveEffort:'low',forPerson:task.forPerson,isDemo:task.isDemo}));await store.insert('task_dependencies',stamp<TaskDependency>(store.userId,{taskId:task.id,dependsOnTaskId:t.id}));created.push(t);};
 if(detail==='just_the_task')return created;
 if(f.earlyDiscountCents.value&&f.discountDeadline.value&&f.discountDeadline.value<bill.dueAt!)await add('confirm_discount',`Pay by ${formatAU(f.discountDeadline.value,'short')} to keep the discount`,f.discountDeadline.value,1);
 if(bill.previousBillId){const prev=await store.get('bills',bill.previousBillId);if(prev&&prev.amountCents>0&&bill.amountCents>prev.amountCents*1.25)await add('confirm_discrepancy',`Check why this is higher than last time`,null,3);}
 if(detail==='full_plan'&&bill.amountCents>=50000&&!f.directDebitActive.value)await add('check_balance','Check the account balance',bill.dueAt?addDays(bill.dueAt,-2):null,1);
 return created;
}
