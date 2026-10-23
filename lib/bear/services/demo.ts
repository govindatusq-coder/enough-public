import {addDays,todayISO} from '../domain/dates.ts';
import type {BearStore} from '../store/store.ts';
import {createCapture} from './capture.ts';
import {ensureProfile} from './profile.ts';
// First-run demonstration bill. Clearly labelled as example data everywhere it appears.
// It flows through the real capture → extraction → verification path (text, rule-based).
export function demoBillText(now=new Date()){
 const today=todayISO('Australia/Sydney',now);const due=addDays(today,9);const issued=addDays(today,-5);const discount=addDays(today,5);
 const fmt=(iso:string)=>{const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;};
 return `EXAMPLE BILL (demo data)
Energy Australia
Electricity bill
Account number: 1234 5678 90
Bill date: ${fmt(issued)}
Service period: ${fmt(addDays(issued,-90))} to ${fmt(issued)}
Total amount due: $184.60
Due date: ${fmt(due)}
Pay by ${fmt(discount)} to receive a $9.00 pay-on-time discount
Late payment fee: $15.00 applies after the due date
BPAY Biller code: 3111  Ref: 1234 5678 9012
Pay online at https://www.energyaustralia.com.au/pay
This bill is issued quarterly.`;
}
export async function seedDemo(store:BearStore,now=new Date()){
 const profile=await ensureProfile(store);
 const result=await createCapture(store,null,{method:'text',text:demoBillText(now),isDemo:true,referenceYear:now.getFullYear()});
 await store.update('profiles',profile.id,{demoOffered:true});
 return result;
}
