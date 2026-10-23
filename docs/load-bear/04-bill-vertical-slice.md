# The bill vertical slice (P0)

```
+ Bear  ──► CaptureSheet (text / photo / screenshot / upload / manual)
   │
   ▼
POST /api/bear/captures            CaptureService.create
   │   stores Capture + SourceDocument (private bucket) and starts extraction
   ▼
DocumentExtractionService          image/PDF → model vision OCR+fields
                                   text → RuleBasedExtractor → model refine
   ▼
BillExtractionService              validate schema, apply confidence policy,
                                   store ExtractedEntity + AIInference
   ▼
GET /api/bear/captures/:id         client polls; "Bear's working this out…"
   ▼
/bear/verify/:captureId            "Have I got this right?" — editable fields,
                                   a specific question for each low-confidence
                                   field; UserCorrection rows on change
   ▼
POST /api/bear/bills/confirm       TaskInferenceService → Area Money, Project
                                   "Pay November electricity bill", Task,
                                   Resource link; DependencyPlanningService
                                   adds only warranted dependencies;
                                   ReminderPlanningService returns a plan
   ▼
/bear/bills/:id (plan step)        "When should I bring this back?" — Bear's
                                   suggestion + alternatives; accept → Reminder
                                   rows with scheduled_for (status 'scheduled')
   ▼
NotificationDecisionService        on every home load and cron tick: the eight
                                   questions; respects Chaos mode, rhythm,
                                   repeated deferrals → "maybe the plan isn't
                                   helping" instead of nagging
   ▼
Reminder surfaces                  in-app "Needs you" card + local notification
                                   + Web Push (when configured)
   ▼
/bear/bills/:id (assist)           Pay it · Show BPAY · Copy reference · Open
                                   payment page · Show original · Explain
   ▼
POST /api/bear/tasks/:id/complete  CompletionService: Completion, Win,
                                   ValueLedger (only if late fee / discount is
                                   known and the deadline was met), recurrence
                                   expectation (asks first), behaviour events
   ▼
/bear/wins                         receipt cards; Wealth total on My Bear
   ▼
SuggestionService                  "Looks like this happens every month…",
                                   "I haven't seen this month's one yet"
```

Edge cases handled (tested in `tests/bear-*.test.mjs`): missing due date,
ambiguous amount, multiple dates, multiple amounts, already paid, overdue,
duplicate bill, invalid image, AI failure, network failure, user rejects
extraction, notification permission denied, Chaos mode.
