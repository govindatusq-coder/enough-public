# Research export data dictionary (`lib/bear/engine/research-export.ts`)

Exported only for participants with `profile.research.consent = true`. One row per participant per export.

| Field | Type | Meaning |
|---|---|---|
| participant | string | HMAC-SHA256(user id, study secret), first 16 hex chars. Not reversible without the secret. |
| studyDay | date | Export date |
| responsibilitiesSubmitted | int | Captures (all methods) |
| interpretedAutomatically | int | Extractions set up without a manual check |
| needingClarification | int | Lifecycle entries into needs_clarification |
| userCorrections | int | Field corrections made by the person (approximate) |
| remindersDelivered | int | Reminders delivered |
| remindersUnwanted | int | Reminders dismissed or marked not important |
| actionsPrepared | int | Actions Bear prepared (drafts etc.) recorded in the lifecycle log |
| completed | int | Responsibilities completed |
| verifiedOutcomes | int | Completions with confirmed or user-confirmed evidence |
| capturesByMethod | object | Counts by capture method (text, photo, email, …) |
| operationsBearCarried | object | Counts of cognitive operations Bear genuinely performed (Responsibility Transferred) |
| unresolvedPastDue | int | Open, time-sensitive items past their date |

Excluded: titles, notes, names, children, amounts, event dates, documents, health details, free text.
