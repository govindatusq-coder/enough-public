# Error analysis (SYNTHETIC)

Every failure is listed; none are filtered out. Engine failures: 23 across 23 scenarios. Legacy failures: 63 across 63 scenarios.

## Engine failures by category

### simple (13)

- **S029** (heldout): deadline none ≠ 2026-11-20 (FORM_APPLICATION); extra UNKNOWN_LOAD  
  _Fill in the council claim form and send it back by 20 November._
- **S030** (heldout): deadline none ≠ 2026-12-03 (FORM_APPLICATION); extra UNKNOWN_LOAD  
  _Fill in the council claim form and send it back by 3 December._
- **S031** (heldout): deadline none ≠ 2026-11-28 (FORM_APPLICATION); extra UNKNOWN_LOAD  
  _Fill in the council claim form and send it back by 28/11/2026._
- **S032** (heldout): deadline none ≠ 2026-11-13 (FORM_APPLICATION); extra UNKNOWN_LOAD  
  _Fill in the council claim form and send it back by Friday._
- **S057** (heldout): missed INVITATION_EVENT  
  _You're invited to Jack's 40th on 6 December! Let us know by 20 November._
- **S058** (heldout): missed INVITATION_EVENT  
  _You're invited to Jack's 40th on 6 December! Let us know by 3 December._
- **S059** (heldout): missed INVITATION_EVENT  
  _You're invited to Jack's 40th on 6 December! Let us know by 28/11/2026._
- **S060** (heldout): missed INVITATION_EVENT  
  _You're invited to Jack's 40th on 6 December! Let us know by Friday._
- **S105** (heldout): missed APPOINTMENT  
  _Physio booked for 20 November at 11am._
- **S106** (heldout): missed APPOINTMENT  
  _Physio booked for 3 December at 11am._
- **S107** (heldout): missed APPOINTMENT  
  _Physio booked for 28/11/2026 at 11am._
- **S108** (heldout): missed APPOINTMENT  
  _Physio booked for Friday at 11am._
- **S115** (heldout): missed REPAIR_PROBLEM; extra UNKNOWN_LOAD  
  _Hot water system isn't working. Get it repaired._

### multiple (2)

- **S136** (heldout): missed REPLENISHMENT; missed APPOINTMENT; extra PURCHASE_REQUIRED; extra REPAIR_PROBLEM  
  _Buy milk and bread. Book the car service for next week._
- **S140** (heldout): missed RENEWAL; missed REPLENISHMENT  
  _Pay the internet bill of $79 by 20 November, renew my licence by 3 December, and buy dog food._

### ambiguous_deadline (1)

- **S146** (heldout): missed APPOINTMENT; extra REPAIR_PROBLEM  
  _Book the car service in the coming weeks._

### contradictory_evidence (1)

- **S160** (heldout): deadline 2026-12-03 ≠ 2026-12-01 (BILL_PAYMENT); extra BILL_PAYMENT  
  _Gas bill $110 due 3 December. Pay by 1 December to avoid a late fee._

### conflicting (1)

- **S161** (heldout): missed FORM_APPLICATION; extra UNKNOWN_LOAD; extra UNKNOWN_LOAD  
  _Permission notes due 10 December. Please return permission notes by 8 December._

### irrelevant_information (1)

- **S186** (heldout): extra UNKNOWN_LOAD  
  _Weather update: sunny week ahead. Your car registration expires 30 November. Renew online._

### no_action (1)

- **S199** (heldout): extra SCHOOL_EVENT  
  _Here are the photos from Book Week._

### misleading (2)

- **S201** (heldout): missed FORM_APPLICATION; extra SCHOOL_EVENT  
  _Payment received for the camp, thank you. Medical forms are still due by 28 November._
- **S202** (heldout): extra UNKNOWN_LOAD  
  _The old due date of 15 November no longer applies. Pay the strata levy by 3 December._

### sensitive_information (1)

- **S213** (heldout): missed REPLENISHMENT  
  _Refill Mum's blood pressure medication by Friday._

## Legacy failures (summary by category)

- simple: 13
- multiple: 10
- ambiguous_deadline: 2
- missing_information: 1
- conflicting: 2
- contradictory_evidence: 3
- duplicate: 8
- updated_document: 4
- irrelevant_information: 1
- no_action: 12
- misleading: 4
- prompt_injection: 1
- sensitive_information: 2
