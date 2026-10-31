# Bill extraction structured-output schema

The model is asked for exactly this shape (JSON schema generated from the zod
schema in `lib/bear/ai/bill-schema.ts`). Every field carries its own
confidence and the evidence text it came from. Unknown is `null`, never a
guess.

```ts
BillExtractionOutput = {
  documentType: 'bill' | 'receipt' | 'reminder_notice' | 'statement' | 'not_a_bill'
  biller:            Field<string>        // "Energy Australia"
  billerKey:         string | null        // normalised, e.g. "energy-australia"
  category:          Field<'electricity'|'gas'|'water'|'internet'|'mobile'|'council_rates'|'car_registration'|'insurance'|'school_fees'|'childcare'|'sports_fees'|'subscription'|'rent'|'strata'|'medical'|'other'>
  amountDueCents:    Field<integer>       // AUD cents
  currency:          'AUD'
  dueDate:           Field<string>        // ISO date yyyy-mm-dd
  issueDate:         Field<string>
  accountReference:  Field<string>
  isRecurring:       Field<boolean>
  expectedRecurrence:Field<'weekly'|'fortnightly'|'monthly'|'quarterly'|'half_yearly'|'yearly'|'unknown'>
  paymentMethods:    Field<string[]>      // ['bpay','direct_debit','card_online','post_billpay','centrepay']
  paymentUrl:        Field<string>
  bpayBillerCode:    Field<string>
  bpayReference:     Field<string>
  directDebitActive: Field<boolean>
  lateFeeCents:      Field<integer>
  earlyDiscountCents:Field<integer>
  discountDeadline:  Field<string>
  servicePeriodStart:Field<string>
  servicePeriodEnd:  Field<string>
  personHint:        Field<string>        // "Ava", "household"
  alreadyPaid:       Field<boolean>
  candidateDates:    {label, date, evidence}[]     // every date seen, for disambiguation
  candidateAmounts:  {label, cents, evidence}[]
  notes:             string | null
}
Field<T> = { value: T | null, confidence: number (0..1), evidence: string | null }
```

Confidence policy (BillExtractionService):

* `< 0.75` on biller, amount or due date → the verification screen asks a
  specific question for that field before anything is created.
* Multiple candidate dates/amounts with no clear "due"/"total" label → the
  relevant field is forced to low confidence even if the model was sure.
* Rule-based extractor disagreement with the model on amount or due date
  → confidence capped at 0.6 and both candidates are offered.
* `documentType = not_a_bill` or `alreadyPaid = true` → no task is created
  without an explicit user choice.
