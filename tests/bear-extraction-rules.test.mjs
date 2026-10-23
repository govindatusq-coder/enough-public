import test from 'node:test';
import assert from 'node:assert/strict';
import {extractBillWithRules} from '../lib/bear/ai/rules.ts';
import {parseAUDate,addMonths,zonedDateTime,localParts,formatAU} from '../lib/bear/domain/dates.ts';
import {parseAUD,formatAUD} from '../lib/bear/domain/money.ts';
import {billOutputSchema} from '../lib/bear/ai/bill-schema.ts';
import {demoBillText} from '../lib/bear/services/demo.ts';

test('Australian dates are read day-first in every common printed form',()=>{
 for(const [text,iso] of [['28/11/2026','2026-11-28'],['28.11.26','2026-11-28'],['28 November 2026','2026-11-28'],['28 Nov 2026','2026-11-28'],['November 28, 2026','2026-11-28'],['2026-11-28','2026-11-28'],['28th Nov','2026-11-28'],['31/02/2026',null],['13/13/2026',null],['not a date',null]])assert.equal(parseAUDate(text,2026),iso,text);
 assert.equal(addMonths('2026-01-31',1),'2026-02-28');assert.equal(addMonths('2026-11-30',3),'2027-02-28');
 assert.equal(formatAU('2026-11-28'),'28 November 2026');
 const local=localParts(zonedDateTime('2026-11-10',19*60+30,'Australia/Sydney'),'Australia/Sydney');
 assert.equal(local.hour,19);assert.equal(local.minute,30);assert.equal(local.date,'2026-11-10');
});
test('AUD amounts parse and format in cents',()=>{
 assert.equal(parseAUD('$1,234.56'),123456);assert.equal(parseAUD('184.60'),18460);assert.equal(parseAUD('$15'),1500);assert.equal(parseAUD('nothing'),null);
 assert.equal(formatAUD(18460),'$184.60');assert.equal(formatAUD(1500),'$15.00');assert.equal(formatAUD(-250),'-$2.50');
});
test('the rule-based extractor reads a realistic electricity bill without a model',()=>{
 const out=extractBillWithRules(demoBillText(new Date('2026-11-10T09:00:00+11:00')),2026);
 assert.equal(billOutputSchema.safeParse(out).success,true,'rules output satisfies the structured schema');
 assert.equal(out.documentType,'bill');assert.equal(out.biller.value,'Energy Australia');assert.equal(out.category.value,'electricity');
 assert.equal(out.amountDueCents.value,18460);assert.ok(out.amountDueCents.confidence>=0.8);
 assert.equal(out.dueDate.value,'2026-11-19');assert.ok(out.dueDate.confidence>=0.8,'discount line is not mistaken for a second due date');
 assert.equal(out.discountDeadline.value,'2026-11-15');assert.equal(out.earlyDiscountCents.value,900);assert.equal(out.lateFeeCents.value,1500);
 assert.equal(out.bpayBillerCode.value,'3111');assert.equal(out.bpayReference.value,'123456789012');assert.equal(out.paymentUrl.value,'https://www.energyaustralia.com.au/pay');
 assert.deepEqual(out.paymentMethods.value,['bpay','card_online']);assert.equal(out.expectedRecurrence.value,'quarterly');assert.equal(out.isRecurring.value,true);
 assert.equal(out.servicePeriodStart.value,'2026-08-07');assert.equal(out.servicePeriodEnd.value,'2026-11-05');
});
test('unknown billers fall back to the first line with low confidence and other categories are recognised',()=>{
 const club=extractBillWithRules("Ava's Swimming Club\nTerm 4 fees\nTotal amount due: $120.00\nDue date: 12/11/2026",2026);
 assert.equal(club.biller.value,"Ava's Swimming Club");assert.ok(club.biller.confidence<0.75);assert.equal(club.category.value,'sports_fees');
 const rego=extractBillWithRules('Service NSW\nRegistration renewal\nAmount payable: $892.00\nPay by 03/01/2027',2026);
 assert.equal(rego.category.value,'car_registration');assert.equal(rego.amountDueCents.value,89200);assert.equal(rego.dueDate.value,'2027-01-03');assert.equal(rego.expectedRecurrence.value,'yearly');
 const rates=extractBillWithRules('City of Sydney\nRates notice\nTotal amount due $412.30\nDue 30/11/2026\nDirect debit will be deducted automatically',2026);
 assert.equal(rates.category.value,'council_rates');assert.equal(rates.directDebitActive.value,true);
 assert.equal(extractBillWithRules('Dinner with Sam on Friday',2026).documentType,'not_a_bill');
 const bare=extractBillWithRules('Telstra 89.00',2026);assert.equal(bare.amountDueCents.value,8900);assert.ok(bare.amountDueCents.confidence<0.75);
});
test('payment URLs are only kept when safe',async()=>{
 const {reconcile}=await import('../lib/bear/services/bill-extraction.ts');
 const rules=extractBillWithRules('Optus\nTotal amount due: $65.00\nDue date: 01/12/2026\nPay at http://optus.example/pay?token=abc',2026);
 const fields=reconcile(null,rules,new Date().toISOString());
 assert.equal(fields.paymentUrl.value,null,'http and token-bearing URLs are dropped');
});
