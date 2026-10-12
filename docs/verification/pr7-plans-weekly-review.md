# PR7 — routine links and weekly reflection

Support plans can link to a selected life routine or sitting context without making a plan field mandatory. The confirmation form adds an optional planned-moment answer (Yes / Different time / No) when a support plan exists. It is validated, shown in outcome history and included in existing downloads.

The dashboard's existing week card offers one optional review per device-local Monday week. What worked, barrier and small fix are each capped at 240 characters. Each active support plan offers Keep / Change / Pause. Keep retains the plan; Change stores the choice and provides an edit link; Pause retains accepted intent and suppresses in-app reminders. Saving an edited support plan resumes it. Calendar exports cannot be remotely cancelled; the pause form explains that calendar events must be edited there.

Review notes and choices live in the ordinary private account snapshot, are included in its download and disappear with existing account deletion. They are not sent in AI context. There are no missed-week records, catch-up messages or inferred outcomes. Legacy profiles do not acquire a review. The validator allows 520 reviews and rejects overflow instead of dropping history.

## Validation

- 137 tests, TypeScript and production build pass; diff checks clean.
- Tests cover Sydney and New York Monday boundaries including daylight saving; optional/legacy plan fields; reflection export; pause semantics; one-record-per-week storage; invalid choices, repeated IDs, stale references and 240-character limits.
- No database migration or dependency. Browser checks pending: opening the review, cancelling without saving, keyboard selection, narrow-screen notes, changing a plan, and paused reminder suppression.

## Rollback

Retain `weeklyReviews`, `planMoment`, `routineAnchor` and `paused` parsing when reverting UI. Preserve reminder suppression for stored paused plans. Removing these fields from the strict schema would prevent newer accounts from saving.
