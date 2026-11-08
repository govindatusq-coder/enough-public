import type {CoveragePack} from '../types.ts';

// Lightweight definitions only. These packs describe what they WILL cover; until they are built they
// do nothing beyond what the core Load Patterns already do, and they never claim more.
const base=(id:CoveragePack['id'],name:string,patterns:CoveragePack['patterns'],obligations:string[],boundaries:string[]):CoveragePack=>({
 id,name,status:'definition',patterns,obligations,
 sources:['typed or pasted text','photos and screenshots','PDFs','the iPhone share sheet'],
 anticipates:[],dependencies:[],prepares:[],humanActions:['everything that needs a payment, signature, booking or contact'],
 completionEvidence:['you tell Bear it is done'],followUpWhen:[],boundaries:['Not built yet: handled by Bear’s general understanding for now.',...boundaries],
 silentWhen:['nothing needs you'],requires:['store','extract','remind'],
});
export const billsPack=base('bills','Household bills',['BILL_PAYMENT','RENEWAL'],['bills','recurring charges','early-payment discounts'],['Bear can’t see your bank, so it can’t confirm a payment went through.']);
export const carPack=base('car','Car',['RENEWAL','APPOINTMENT','REPAIR_PROBLEM'],['registration','insurance','servicing','tyres and repairs'],['Bear can’t book a service or check rego status for you.']);
export const homePack=base('home','Home',['REPAIR_PROBLEM','REPLENISHMENT','PURCHASE_REQUIRED'],['repairs','household supplies','maintenance'],['Bear can’t contact tradies for you.']);
export const familyPack=base('family','Family events',['INVITATION_EVENT','PURCHASE_REQUIRED'],['birthdays','parties','gifts','family gatherings'],['Bear can’t RSVP or buy presents for you.']);
export const healthPack=base('health','Health admin',['APPOINTMENT','REPLENISHMENT','FORM_APPLICATION'],['appointments','referrals','prescriptions','claims'],['Bear can’t book appointments or see Medicare or health fund records.','Bear never guesses health details.']);
