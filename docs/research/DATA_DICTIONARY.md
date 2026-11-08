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

## Survey responses (`responses.csv` from `scripts/study-export.mjs`)

| Field | Type | Meaning |
|---|---|---|
| participant | string | Same pseudonym as above |
| phase | baseline / weekly / end | When it was answered |
| week | int | 0 (baseline) to 6 (end) |
| instrument | tlx / sus / weekly / context | See PROTOCOL.md |
| completedOn | date | Day answered |
| score | number or empty | Raw TLX (0–100) or SUS (0–100); empty for purpose-built instruments |
| item columns | number | One column per answered item id (e.g. `tlx_mental`, `admin_minutes`); skipped items are empty |
