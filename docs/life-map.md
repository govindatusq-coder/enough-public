# Life Map and the opportunity engine

Enough finds movement hiding inside things people already do. Recommendations come from a curated library, matched to a structured picture of the person's week. AI only rewords a chosen opportunity, and the app works fully without it.

## Data

| Piece | File | Stored in |
| --- | --- | --- |
| Life Map: contexts, recurring moments, permissions, movement styles, hard NOs, extra-time tolerance, profiling answers | `lib/life-map.ts` | `state.lifeMap` |
| Opportunity library (104 curated entries, structured metadata) | `lib/opportunities.ts` | code |
| Feedback events: opportunity, response, optional reason, surface, situation, time, Life Map snapshot | `lib/opportunity-log.ts` | `state.opportunityFeedback` (max 600) |
| "Did it happen?" moments: planned, done or skipped, minutes, extra minutes | `lib/opportunity-log.ts` | `state.opportunityMoments` (max 1000) |
| Illustration library: category → watercolour files with fallback | `lib/illustrations.ts` | `public/illustrations/` |
| Progressive-profiling question bank | `lib/profiling.ts` | answers in `state.lifeMap.profiling` |

All three state fields are optional and strictly validated in `lib/account-validation.ts` and `lib/journey.ts`. They live in the existing `enough_accounts.state_json` document, so no SQL migration is needed.

## Pipeline (`lib/opportunity-engine.ts`)

1. **Retrieve**: opportunities touching the person's life contexts or recurring moments, plus a few universal ones. `requires` keeps kids', pet, office and commuting ideas away from people without them. Right now retrieves by the situation the person just named.
2. **Hard filter** (`exclusionReason`): hard NOs, equipment, stairs, floor, vigorous intensity unless "Get a bit puffed" is chosen, "Leave me alone" permissions, extra time above tolerance, profiling exclusions (for example "can't leave the kids' venue"), and two rejections.
3. **Rank**: weighted sum in `rankingWeights` (moment and context match, permission, style, utility, burden, extra minutes, pairing with something already happening, previous accept, rejection and reasons, recent repeats, novelty, small daily rotation). Weights sit in one object so they can be tuned from feedback data.
4. **Select**: `diversify` picks a varied set, with penalties for the same moment, picture or movement style. Home shows three, Right now shows one, and the onboarding payoff shows three from different moments.

## Honesty rules

Life Map copy is conditional ("Next time…", "If…") because Enough knows what tends to happen, not what is happening. Direct copy is used only after the person says what's happening (Right now). AI wording (`/api/personalise`) is re-checked by `validatePersonalised`. It must keep the activity, the minute range and the extra-time limit, and it may not invent times, days, weather, distances, people or workouts. Any failure returns the template copy.

## Adding an opportunity

Add an `o({...})` entry to `lib/opportunities.ts`. Set the moments in priority order, the hard-constraint tags it would break, `extraScales` if the extra time equals the movement time, and an `imageCategory`. `tests/opportunity-engine.test.mjs` checks every entry for valid fields, conditional copy, banned words and an existing illustration.

## AI wording allowance

Each signed-in person gets 40 rewordings per UTC day, enforced in Postgres by `public.enough_take_wording_slot()` (migration `supabase/migrations/20261025090000_wording_quota.sql`). The check runs before any model call, and if it can't run the endpoint makes no model request and the app keeps its template copy. Each device also caches a day's result, or a failure, per card.

## iPhone app

The iPhone app doesn't show the Life Map yet. It keeps any account fields it doesn't model and sends them back untouched on save (`AccountFields` in `ios/Enough/Enough/Services/EnoughAPI.swift`), so using both on one account doesn't erase the Life Map, feedback or moments.

## Automatic AI pictures

Bespoke AI pictures for classic AI ideas are off. Set `ENOUGH_AI_PICTURES=on` on the server to turn them back on.
