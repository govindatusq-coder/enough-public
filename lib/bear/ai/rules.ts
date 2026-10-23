// Deterministic, no-model extraction for bill text. Always runs; it is the only
// extractor when no model key is configured and a cross-check when one is.
import {DATE_SPAN,parseAUDate} from '../domain/dates.ts';
import {MONEY_SPAN,parseAUD} from '../domain/money.ts';
import type {BillCategory,PaymentMethod,Recurrence} from '../domain/types.ts';
import type {BillOutput} from './bill-schema.ts';

export const knownBillers:{match:RegExp;name:string;key:string;category:BillCategory;recurrence:Recurrence}[]=[
 {match:/energy\s*australia/i,name:'Energy Australia',key:'energy-australia',category:'electricity',recurrence:'quarterly'},
 {match:/\bagl\b/i,name:'AGL',key:'agl',category:'electricity',recurrence:'quarterly'},
 {match:/origin\s*energy/i,name:'Origin Energy',key:'origin-energy',category:'electricity',recurrence:'quarterly'},
 {match:/red\s*energy/i,name:'Red Energy',key:'red-energy',category:'electricity',recurrence:'quarterly'},
 {match:/alinta/i,name:'Alinta Energy',key:'alinta-energy',category:'electricity',recurrence:'quarterly'},
 {match:/\btelstra\b/i,name:'Telstra',key:'telstra',category:'internet',recurrence:'monthly'},
 {match:/\boptus\b/i,name:'Optus',key:'optus',category:'mobile',recurrence:'monthly'},
 {match:/\baussie\s*broadband\b/i,name:'Aussie Broadband',key:'aussie-broadband',category:'internet',recurrence:'monthly'},
 {match:/\btpg\b/i,name:'TPG',key:'tpg',category:'internet',recurrence:'monthly'},
 {match:/\bvodafone\b/i,name:'Vodafone',key:'vodafone',category:'mobile',recurrence:'monthly'},
 {match:/sydney\s*water/i,name:'Sydney Water',key:'sydney-water',category:'water',recurrence:'quarterly'},
 {match:/yarra\s*valley\s*water/i,name:'Yarra Valley Water',key:'yarra-valley-water',category:'water',recurrence:'quarterly'},
 {match:/\bcouncil\b.*\brates?\b|\brates?\s*notice\b/i,name:'Council rates',key:'council-rates',category:'council_rates',recurrence:'quarterly'},
 {match:/service\s*nsw|vicroads|\bregistration\s*renewal\b|\brego\b/i,name:'Vehicle registration',key:'vehicle-registration',category:'car_registration',recurrence:'yearly'},
 {match:/\bnrma\b|\bracv\b|\brac\b|\bsuncorp\b|\baami\b|\byoui\b|\bbudget\s*direct\b|\ballianz\b/i,name:'Insurance',key:'insurance',category:'insurance',recurrence:'yearly'},
 {match:/\bschool\s*fees?\b|\btuition\b|\bcollege\b.*\bfees?\b/i,name:'School fees',key:'school-fees',category:'school_fees',recurrence:'quarterly'},
 {match:/\bchildcare\b|\bearly\s*learning\b|\bkindy\b|\bday\s*care\b/i,name:'Childcare',key:'childcare',category:'childcare',recurrence:'fortnightly'},
 {match:/\bstrata\b|\bowners\s*corporation\b|\bbody\s*corporate\b/i,name:'Strata levies',key:'strata',category:'strata',recurrence:'quarterly'},
 {match:/\bnetflix\b|\bspotify\b|\bdisney\+|\bstan\b|\bbinge\b|\bkayo\b/i,name:'Subscription',key:'subscription',category:'subscription',recurrence:'monthly'},
 {match:/\bswimming\b|\bfootball\b|\bnetball\b|\bsoccer\b|\bgymnastics\b|\bdance\b.*\bfees?\b|\bclub\s*fees?\b/i,name:'Sports fees',key:'sports-fees',category:'sports_fees',recurrence:'quarterly'},
 {match:/\bgas\b/i,name:'Gas',key:'gas',category:'gas',recurrence:'quarterly'},
 {match:/\belectricity\b|\bpower\b/i,name:'Electricity',key:'electricity',category:'electricity',recurrence:'quarterly'},
 {match:/\bwater\b/i,name:'Water',key:'water',category:'water',recurrence:'quarterly'},
 {match:/\bnbn\b|\binternet\b|\bbroadband\b/i,name:'Internet',key:'internet',category:'internet',recurrence:'monthly'},
 {match:/\bmobile\b|\bphone\b/i,name:'Mobile phone',key:'mobile',category:'mobile',recurrence:'monthly'},
];
export const slug=(s:string)=>s.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

type F<T>={value:T|null;confidence:number;evidence:string|null};
const none=<T,>():F<T>=>({value:null,confidence:0,evidence:null});
const got=<T,>(value:T,confidence:number,evidence:string):F<T>=>({value,confidence,evidence:evidence.slice(0,300)});

function lineOf(text:string,index:number){const start=text.lastIndexOf('\n',index)+1;const end=text.indexOf('\n',index);return text.slice(start,end<0?undefined:end).trim();}

export function extractBillWithRules(text:string,referenceYear=new Date().getFullYear()):BillOutput{
 const clean=text.replace(/\r/g,'');
 // Dates with labels from their line.
 const candidateDates:BillOutput['candidateDates']=[];
 for(const m of clean.matchAll(DATE_SPAN)){const iso=parseAUDate(m[0],referenceYear);if(!iso)continue;const line=lineOf(clean,m.index!);if(candidateDates.some(c=>c.date===iso&&c.evidence===line))continue;candidateDates.push({label:labelDate(line),date:iso,evidence:line.slice(0,200)});}
 const candidateAmounts:BillOutput['candidateAmounts']=[];
 for(const m of clean.matchAll(MONEY_SPAN)){const cents=parseAUD(m[0]);if(cents===null)continue;const line=lineOf(clean,m.index!);candidateAmounts.push({label:labelAmount(line),cents,evidence:line.slice(0,200)});}

 const dueCands=candidateDates.filter(c=>c.label==='due');
 const discountCands=candidateDates.filter(c=>c.label==='discount');
 const issueCands=candidateDates.filter(c=>c.label==='issued');
 const distinctDue=[...new Set(dueCands.map(c=>c.date))];
 const dueDate:F<string>=distinctDue.length===1?got(distinctDue[0],0.85,dueCands[0].evidence):distinctDue.length>1?got(distinctDue[0],0.45,dueCands.map(c=>c.evidence).join(' | ')):candidateDates.length===1?got(candidateDates[0].date,0.4,candidateDates[0].evidence):none();
 const issueDate:F<string>=issueCands.length?got(issueCands[0].date,0.8,issueCands[0].evidence):none();
 const discountDeadline:F<string>=discountCands.length?got(discountCands[0].date,0.75,discountCands[0].evidence):none();

 const totalCands=candidateAmounts.filter(c=>c.label==='total_due');
 const distinctTotals=[...new Set(totalCands.map(c=>c.cents))];
 const amountDueCents:F<number>=distinctTotals.length===1?got(distinctTotals[0],0.85,totalCands[0].evidence):distinctTotals.length>1?got(Math.max(...distinctTotals),0.45,totalCands.map(c=>c.evidence).join(' | ')):candidateAmounts.length===1?got(candidateAmounts[0].cents,0.4,candidateAmounts[0].evidence):candidateAmounts.length>1?got(Math.max(...candidateAmounts.map(c=>c.cents)),0.3,'largest amount seen'):none();
 const lateCand=candidateAmounts.find(c=>c.label==='late_fee');const discCand=candidateAmounts.find(c=>c.label==='discount');
 const lateFeeCents:F<number>=lateCand?got(lateCand.cents,0.8,lateCand.evidence):none();
 const earlyDiscountCents:F<number>=discCand?got(discCand.cents,0.8,discCand.evidence):none();

 const biller=knownBillers.find(b=>b.match.test(clean));
 const firstLine=clean.split('\n').map(l=>l.trim()).find(l=>l&&!/^example bill/i.test(l)&&!MONEY_SPAN.test(l)&&!/\d{2}\/\d{2}/.test(l)&&l.length<=60)||null;
 const billerField:F<string>=!biller&&firstLine?got(firstLine.replace(/\s+(pty|ltd|limited)\b.*$/i,''),0.5,firstLine):biller?got(biller.name,biller.key===biller.category||['electricity','gas','water','internet','mobile','insurance','subscription','childcare','school-fees','sports-fees','council-rates','strata','vehicle-registration'].includes(biller.key)?0.55:0.9,(clean.match(biller.match)||[''])[0]):none();
 const category:F<BillCategory>=biller?got(biller.category,biller.key===biller.category?0.6:0.85,biller.name):none();

 const bpayCode=/biller\s*code\s*:?\s*(\d{4,6})/i.exec(clean);const bpayRef=/\bref(?:erence)?\s*(?:no\.?|number)?\s*:?\s*(\d[\d ]{5,24}\d)/i.exec(clean);
 const bpayBillerCode:F<string>=bpayCode?got(bpayCode[1],0.9,bpayCode[0]):none();
 const bpayReference:F<string>=bpayRef&&/bpay/i.test(clean)?got(bpayRef[1].replace(/\s/g,''),0.75,bpayRef[0]):none();
 const acct=/account\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9][A-Z0-9 -]{3,24}[A-Z0-9])/i.exec(clean);
 const accountReference:F<string>=acct?got(acct[1].trim(),0.7,acct[0]):none();
 const methods:PaymentMethod[]=[];if(/bpay/i.test(clean))methods.push('bpay');if(/direct\s*debit/i.test(clean))methods.push('direct_debit');if(/pay\s*online|credit\s*card|visa|mastercard/i.test(clean))methods.push('card_online');if(/post\s*billpay|australia\s*post/i.test(clean))methods.push('post_billpay');if(/centrepay/i.test(clean))methods.push('centrepay');if(/\bbsb\b/i.test(clean))methods.push('bank_transfer');
 const paymentMethods:F<PaymentMethod[]>=methods.length?got(methods,0.8,methods.join(',')):none();
 const url=/https:\/\/[^\s)>"']+/i.exec(clean);const paymentUrl:F<string>=url?got(url[0],0.6,url[0]):none();
 const ddActive=/direct\s*debit\s*(?:is\s*)?(?:active|set\s*up|will\s*be\s*deducted|scheduled)|will\s*be\s*(?:debited|deducted)\s*(?:automatically|from\s*your)/i.test(clean);
 const directDebitActive:F<boolean>=ddActive?got(true,0.8,'direct debit wording'):none();
 const paid=/\b(?:amount\s*paid|paid\s*in\s*full|payment\s*received|thank\s*you\s*for\s*your\s*payment|balance\s*due\s*:?\s*\$?0(?:\.00)?)\b/i.test(clean)&&!/\bamount\s*due\b.*\$\s?[1-9]/i.test(clean);
 const periodMatch=/(?:service|billing|supply)\s*period\s*:?\s*(.+?)\s*(?:to|-|–)\s*(.+?)(?:\n|$)/i.exec(clean);
 const servicePeriodStart:F<string>=periodMatch&&parseAUDate(periodMatch[1],referenceYear)?got(parseAUDate(periodMatch[1],referenceYear)!,0.7,periodMatch[0]):none();
 const servicePeriodEnd:F<string>=periodMatch&&parseAUDate(periodMatch[2].trim(),referenceYear)?got(parseAUDate(periodMatch[2].trim(),referenceYear)!,0.7,periodMatch[0]):none();
 const recurringWords=/\bmonthly\b|\bquarterly\b|\bfortnightly\b|\bannual\b|\byearly\b|\bper\s*(?:month|quarter|year)\b|\bnext\s*bill\b/i.exec(clean);
 const recurrenceFromText:Recurrence|null=recurringWords?(/month/i.test(recurringWords[0])?'monthly':/quarter/i.test(recurringWords[0])?'quarterly':/fortnight/i.test(recurringWords[0])?'fortnightly':/annual|year/i.test(recurringWords[0])?'yearly':null):null;
 const isRecurring:F<boolean>=recurringWords||biller?got(true,biller?0.6:0.5,recurringWords?.[0]||biller?.name||''):none();
 const expectedRecurrence:F<Recurrence>=recurrenceFromText?got(recurrenceFromText,0.7,recurringWords![0]):biller?got(biller.recurrence,0.4,'typical for '+biller.name):none();
 const looksLikeBill=amountDueCents.value!==null||dueDate.value!==null||!!biller||/\bbill\b|\binvoice\b|\bamount\s*due\b|\bpayable\b/i.test(clean);
 const documentType:BillOutput['documentType']=!looksLikeBill?'not_a_bill':paid?'receipt':/\breminder\b|\boverdue\b|\bfinal\s*notice\b/i.test(clean)?'reminder_notice':'bill';
 return {documentType,biller:billerField,billerKey:biller?biller.key:null,category,amountDueCents,currency:'AUD',dueDate,issueDate,accountReference,isRecurring,expectedRecurrence,paymentMethods,paymentUrl,bpayBillerCode,bpayReference,directDebitActive,lateFeeCents,earlyDiscountCents,discountDeadline,servicePeriodStart,servicePeriodEnd,personHint:none(),alreadyPaid:paid?got(true,0.7,'paid wording'):none(),candidateDates,candidateAmounts,notes:null};
}
function labelDate(line:string){const l=line.toLowerCase();if(/discount|early\s*payment|pay\s*on\s*time/.test(l))return 'discount';if(/pay\s*by|due|payable\s*by|payment\s*date/.test(l))return 'due';if(/issue|issued|bill\s*date|invoice\s*date|date\s*of\s*issue|statement\s*date/.test(l))return 'issued';if(/period|from|to|reading/.test(l))return 'period';return 'other';}
function labelAmount(line:string){const l=line.toLowerCase();if(/late\s*fee|late\s*payment|dishonour/.test(l))return 'late_fee';if(/discount|save|pay\s*on\s*time\s*(?:and|&)|reduced/.test(l))return 'discount';if(/total\s*(?:amount\s*)?due|amount\s*due|amount\s*payable|total\s*payable|please\s*pay|new\s*charges\s*total|balance\s*due|total\s*now\s*due/.test(l))return 'total_due';if(/previous|last\s*bill|paid|credit|payment\s*received/.test(l))return 'previous';if(/gst/.test(l))return 'gst';return 'line';}
