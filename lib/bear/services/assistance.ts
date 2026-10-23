import {formatAU} from '../domain/dates.ts';
import {formatAUD} from '../domain/money.ts';
import type {Bill} from '../domain/types.ts';
import type {BearStore} from '../store/store.ts';
// Assistance Bear can offer for a bill. Bear facilitates; the user executes payments.
export interface AssistOption{key:string;label:string;detail:string|null;href:string|null;copy:string|null}
export async function assistanceFor(store:BearStore,bill:Bill):Promise<{options:AssistOption[];explanation:string;contactDraft:string|null;increase:{previousCents:number;deltaCents:number}|null}>{
 const f=bill.fields;const options:AssistOption[]=[];
 if(f.paymentUrl.value)options.push({key:'open_payment',label:'Open payment page',detail:new URL(f.paymentUrl.value).hostname,href:f.paymentUrl.value,copy:null});
 if(f.bpayBillerCode.value)options.push({key:'bpay',label:'Show BPAY details',detail:`Biller code ${f.bpayBillerCode.value}${f.bpayReference.value?' · Ref '+f.bpayReference.value:''}`,href:null,copy:f.bpayReference.value||f.bpayBillerCode.value});
 if(f.bpayReference.value)options.push({key:'copy_reference',label:'Copy payment reference',detail:f.bpayReference.value,href:null,copy:f.bpayReference.value});
 else if(f.accountReference.value)options.push({key:'copy_account',label:'Copy account number',detail:f.accountReference.value,href:null,copy:f.accountReference.value});
 options.push({key:'amount',label:'Show amount',detail:formatAUD(bill.amountCents),href:null,copy:(bill.amountCents/100).toFixed(2)});
 if(bill.documentId){const doc=await store.get('source_documents',bill.documentId);const url=doc?await store.fileUrl(doc.objectKey):null;if(url)options.push({key:'original',label:'Show original bill',detail:doc?.originalName||null,href:url,copy:null});}
 if(f.directDebitActive.value===true)options.push({key:'direct_debit',label:'Direct debit is set up',detail:'The bill says this will be taken automatically. Check your account on the day and mark it paid.',href:null,copy:null});
 let increase:{previousCents:number;deltaCents:number}|null=null;
 if(bill.previousBillId){const prev=await store.get('bills',bill.previousBillId);if(prev&&bill.amountCents>prev.amountCents)increase={previousCents:prev.amountCents,deltaCents:bill.amountCents-prev.amountCents};}
 const parts=[`${bill.biller} is asking for ${formatAUD(bill.amountCents)}${bill.dueAt?' by '+formatAU(bill.dueAt):''}.`];
 if(f.servicePeriodStart.value&&f.servicePeriodEnd.value)parts.push(`It covers ${formatAU(f.servicePeriodStart.value,'short')} to ${formatAU(f.servicePeriodEnd.value,'short')}.`);
 if(f.lateFeeCents.value)parts.push(`Paying after the due date adds a ${formatAUD(f.lateFeeCents.value)} late fee.`);
 if(f.earlyDiscountCents.value)parts.push(`Paying by ${f.discountDeadline.value?formatAU(f.discountDeadline.value,'short'):'the due date'} keeps a ${formatAUD(f.earlyDiscountCents.value)} discount.`);
 if(increase)parts.push(`It is ${formatAUD(increase.deltaCents)} more than the previous ${formatAUD(increase.previousCents)} bill.`);
 const contactDraft=increase?`Hi ${bill.biller},\n\nMy latest bill${f.accountReference.value?' (account '+f.accountReference.value+')':''} for ${formatAUD(bill.amountCents)} is ${formatAUD(increase.deltaCents)} higher than my previous bill of ${formatAUD(increase.previousCents)}. Could you explain what changed${f.servicePeriodStart.value?' for the period '+formatAU(f.servicePeriodStart.value,'short')+' to '+formatAU(f.servicePeriodEnd.value||f.servicePeriodStart.value,'short'):''}?\n\nThanks`:null;
 return {options,explanation:parts.join(' '),contactDraft,increase};
}
