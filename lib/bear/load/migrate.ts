import {buildNode} from './graph.ts';
import {recompute} from './engine.ts';
import type {Capabilities,LoadGraph} from './types.ts';
import type {Bill,Task} from '../domain/types.ts';

// Existing items, mapped conservatively. A bill is structured data with a known closure
// (payment), so it maps safely to BILL_PAYMENT. Anything else is not re-classified after the
// fact: it becomes UNKNOWN_LOAD in the captured state, and keeps working exactly as before.
export function legacyGraph(task:Task,bill:Bill|null,today:string,caps:Capabilities):LoadGraph{
 const at=new Date().toISOString();
 const node=bill
  ?buildNode('BILL_PAYMENT',{amountCents:bill.amountCents,dueDate:bill.dueAt,provider:bill.biller,flags:[...(bill.fields.directDebitActive.value?['autopay']:[])]},{title:task.title,text:'',today,role:'primary',parentId:null,confidence:1})
  :buildNode('UNKNOWN_LOAD',{dueDate:task.dueAt},{title:task.title,text:'',today,role:'primary',parentId:null,confidence:0});
 // Unknown legacy items are not interrogated: no clarification is pushed at the person.
 if(!bill)node.clarification=null;
 if(task.status==='done')node.evidence.push({key:bill?'payment_confirmed':'user_resolved',at,source:'user'});
 if(task.status==='dropped'||task.status==='archived')node.evidence.push({key:'user_resolved',at,source:'user'});
 return recompute({version:1,primaryId:node.id,nodes:[node],createdAt:task.createdAt,updatedAt:at,migrated:true},today,caps);
}
