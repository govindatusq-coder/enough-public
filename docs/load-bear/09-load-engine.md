# Load Pattern Engine (architecture and onboarding refactor)

Load Bear is not a task manager. Each thing given to Bear is a **load**: unresolved life the
person would otherwise carry in their head. The engine works out what the load is, what Bear
can genuinely carry, and the **smallest thing only the person can do now** (or nothing).
The visual design was preserved; the intelligence underneath changed.

## Pipeline

```
input → extraction (deterministic, + AI reading when connected)
      → recognition (signal scoring; AI kind is a tie-breaker only)
      → composite detection (attached patterns: a camp carries a form and a payment)
      → decomposition (pattern step templates, filtered by what the input shows)
      → Load Map personalisation (lead times, usual providers, handover)
      → ownership (capability-checked; Bear never pays, never claims an integration it lacks)
      → minimum human action → state → plain-words view
```

Code: `lib/bear/load/*` (pure, no I/O) and `lib/bear/services/load.ts` (storage, reminders, completion).

| File | Role |
|---|---|
| `types.ts` | LoadState, CognitiveOperation, Ownership, LoadPattern, LoadGraph/LoadNode/LoadStep, WaitingState, CognitiveLoadVector, LoadMap, Capabilities |
| `patterns.ts` | The 10 V1 patterns + UNKNOWN_LOAD, version `2026.10-v1` |
| `extract.ts` | Dates (with roles: due / event / RSVP / expiry), amounts, items, provider, person, ~70 flags |
| `recognise.ts` | Scoring, threshold, `dominates` rules (a Year 6 dinner is school before social) |
| `graph.ts` | Decomposition into a LoadGraph; one clarifying question for genuinely missing facts |
| `ownership.ts` | Bear Ownership Engine |
| `action.ts` | Minimum Human Action Engine |
| `waiting.ts` | Waiting Engine (time-based resurfacing; no fake monitoring) |
| `closure.ts` | Closure Engine |
| `engine.ts` | Orchestration, actions, spawning follow-on loads, re-planning on new facts |
| `view.ts` | What the person sees: needs you / covered / waiting / coming up |
| `vector.ts` | Cognitive responsibility absorbed (internal analytics only) |
| `loadmap.ts` | Load Map schema, onboarding options, progressive learning, reset |
| `migrate.ts` | Conservative mapping of existing items |

## States

`captured → covered | needs_user | waiting → resolved`. "Nothing for you to do right now" and
"waiting" are success states. Resolved only when the pattern's closure condition holds
(payment confirmed, problem fixed, correct item in hand…), never because a reminder was
dismissed, an email sent, an appointment booked or an order placed. Tests enforce that no
pattern can close on those.

## Ownership and honesty

Capabilities today: in-app reminders (yes), push (when VAPID keys are set), email, calendar,
payments, order tracking, provider contact (all **no**). So:

* "I'll bring this back Friday if you haven't heard" is said only because a reminder exists
  for that day (`syncLoadReminder` keeps exactly one in step). It never says "I'm watching your inbox".
* Payments are always the person's. Direct-debit confirmation is asked, not checked (marked `degraded`).
* Contacting a tradie is the person's (marked `degraded: Bear can't contact tradies yet`).
* "No rush" items (PDA-friendly) get no reminders and no promised dates unless the person chooses nudges.

## Minimum human action

One step at a time, chosen from active human steps: missing facts and safety first, then the
earliest deadline, then natural order. Steps surface only when they matter (packing two days
before camp; a bill three days before due, or five for people who "forget until it's urgent";
renewals two weeks out). Everything else stays in the Details fold on the item page.

## Composite loads and follow-ons

The primary node carries attached nodes with their own closure. Parent closure can require
`children_resolved`. Some answers spawn a new attached load: "There's a follow-up" (appointment),
"It needs returning" (purchase), "I'll query it" / "Ask for a payment plan" (bill).

## Unknown loads

Below threshold the load is `UNKNOWN_LOAD`, with one question: "What would make this feel
sorted?" (decide / arrange / wait / get done / something else). A plain to-do with an action verb
("Return the library books by Friday") skips the question. Unknowns are logged as
`pattern_unknown` behaviour events with only the near-miss pattern scores and a length bucket,
never the person's words. Nothing is auto-promoted into the library.

## Load Map and learning

Stored on the profile (`profile.loadMap`, JSONB). Built in onboarding, editable in Settings →
My Load Map ("Change my Load Map", "Reset what Bear learned"). Learning is small and visible:
bill lead time (after the person moves bill reminders to the same lead twice), follow-up window
(after repeated "still waiting" or quick chasing), usual provider (used twice → suggested).
No demographic fields exist; responsibility is asked, never inferred.

## Onboarding (content changed, shell preserved)

Welcome (Less on your mind. More in your day. / Let's begin) → What's yours to carry? (9 domains,
existing tile system) → Your life at a glance (name, household, ages, work, caring, country +
state; all skippable) → What tends to get you? (8 tiles → cognitive profile) → What would you
hand over? → How should Bear behave? (existing preference cards) → Give Bear one real thing
(the real capture sheet; the result is shown by the real engine on the item page).

## Existing pages

* **My Bear**: same layout. The greeting chip says "1 thing needs you: …" (overdue still wins);
  Bear's handling shows **Covered · Waiting · Need you** with "Nothing for you to do right now".
  Area tile numbers come from minimum human actions for engine loads.
* **Item page**: a Bear panel under the title card: headline, one thing that needs you (with
  its choices), covered, waiting for, coming up. The plan (How I read this, steps) is behind
  **Details**. Editing a date re-plans the load.
* **Bill page**: the same panel (read-only; paying stays on the existing "I've paid it").
* **Settings**: My Load Map section.

## Migration

No SQL migration was needed: every table stores the entity as JSONB `body`. Existing items are
mapped lazily on first read: bills → `BILL_PAYMENT` (structured data, known closure); anything
else → `UNKNOWN_LOAD`, kept as it was and never questioned (`migrated: true`). Nothing is deleted
or reclassified by guesswork.

## Tests

* `tests/fixtures/load-cases.mjs`: 100 messy cases, 10 per pattern.
* `tests/load-harness.mjs` scores each on recognition, decomposition, ownership (no false
  capability claims), human burden and closure (and that look-alike progress does not close).
* `node scripts/load-stress.mjs` prints the table. Quality gates in `tests/bear-load-engine.test.mjs`.
* `tests/bear-load-service.test.mjs`: capture → Home, acting, closure, reopen, migration, learning.

Caveat: the fixtures were written alongside the engine. They are curated product checks, not a
blind evaluation; real captures will find gaps (that is what `pattern_unknown` is for).

## Known limitations

* Recognition is keyword-based; without the AI service, readings come from rules, so some
  messages land as UNKNOWN_LOAD and ask one question.
* Waiting is time-based only (no inbox, order tracking or bank feeds).
* Provider contact, booking and payment are always the person's.
* Onboarding no longer collects the weekly rhythm; reminder timing uses defaults until it is
  set again (Settings → Adjust these).
* Recurrence: renewals record the next expiry; replenishment estimates the next run; a new
  load for the next cycle is not created automatically yet.
