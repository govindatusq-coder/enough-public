import {z} from 'zod';
import {formatAUD} from '../domain/money.ts';
import type {ValueLedgerEntry,Win} from '../domain/types.ts';
import {stamp,type BearStore} from '../store/store.ts';

// Bear only counts a saving automatically when it can read a stated fee or discount off the
// bill. When the person knows they saved money some other way, they can tell Bear, and it is
// counted and labelled as what they told Bear. Nothing is estimated.
const reasonShort={late_fee_avoided:'late fee avoided',early_discount_used:'early payment discount',discount_used:'discount used',better_price:'better price'} as const;
export const winSavingSchema=z.object({cents:z.number().int().min(0).max(100000000),reason:z.enum(['late_fee_avoided','early_discount_used','discount_used','better_price']),note:z.string().trim().max(120).optional()}).strict();
export type WinSavingInput=z.infer<typeof winSavingSchema>;
const MARK=' (you told Bear)';

export async function setWinSaving(store:BearStore,winId:string,input:WinSavingInput,now=new Date()):Promise<Win>{
 const win=await store.get('wins',winId);if(!win)throw new Error('not_found');
 const completion=await store.get('completions',win.completionId);
 const taskId=completion?.taskId||null;
 const ledger=await store.list('value_ledger',{where:[{column:'kind',value:'wealth'}]});
 for(const e of ledger)if(e.source==='user'&&e.sourceTaskId===taskId&&taskId)await store.remove('value_ledger',e.id);
 if(input.cents>0)await store.insert('value_ledger',stamp<ValueLedgerEntry>(store.userId,{kind:'wealth',reason:input.reason,label:`${win.title}: ${reasonShort[input.reason]}${input.note?` (${input.note})`:''}`,amountCents:input.cents,minutes:null,occurredAt:completion?.completedAt||win.createdAt||now.toISOString(),sourceTaskId:taskId,sourceBillId:win.billId,defensible:true,isDemo:win.isDemo,source:'user'}));
 const segments=win.detail.split(' · ').filter(x=>x&&!x.endsWith(MARK));
 if(input.cents>0)segments.push(`+${formatAUD(input.cents)} ${reasonShort[input.reason]}${MARK}`);
 const autoCents=ledger.filter(e=>e.sourceTaskId===taskId&&e.source!=='user'&&e.defensible).reduce((s,e)=>s+(e.amountCents||0),0);
 return store.update('wins',win.id,{detail:segments.join(' · '),amountCents:autoCents+input.cents||null});
}
