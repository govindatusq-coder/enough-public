# Goal fitting and follow-through (web, `adaptiveGoalFittingV1`)

Enough is two systems.

```
SYSTEM A — DISCOVERY (frozen)                 SYSTEM B — FITTING + FOLLOW-THROUGH (new)
Life Map → opportunity engine → suggestion    "I'd do that" → Could this become one of yours?
→ picture → explanation → "I'd do that"       → at most one material question → Goal-Fitting Engine
                                              → "Here's how we'll treat it" → invitations (or quiet)
                                              → check-in → learning → adaptive usual → My Wins
```

System B starts after "I'd do that" and never changes which idea is suggested, its wording, minutes, extra time, picture, Best fit or ranking.

## How System A stays frozen

- No System A file changed: `lib/opportunities.ts`, `lib/opportunity-engine.ts`, `lib/opportunity-copy.ts`, `lib/profiling.ts`, `lib/illustrations.ts`, `lib/opportunity-log.ts`, `lib/personalise-http.ts`, `app/api/*`, the card and picture components.
- The engine reads `lifeMap` (except `fitting`), `opportunityFeedback` and `opportunityMoments`. System B never adds engine inputs:
  - New Life Map answers live in `lifeMap.fitting`, which the engine never reads.
  - Goal-fitting questions are a separate bank (`fittingQuestions`). They never write into `lifeMap.profiling`, which the engine reads.
  - "I'd do that" still records the same accept and planned moment as before.
  - The first check-in settles that planned moment exactly as "It happened" or "Not this time" did. Later check-ins write only System B records.
  - "Depends on the day" on the extra-time screen is a compatibility mapping: the engine receives `extraTime: 'few'`, and `fitting.extraTimeVaries` remembers the person's own answer.
- `tests/fixtures/suggestion-baseline.json` records System A's output for 13 personas. It was recorded from the unchanged code in its own commit. `tests/goal-fitting.test.mjs` checks every persona still matches it exactly, with and without the new answers. To record a deliberate, reviewed change to suggestions: `TZ=UTC node scripts/suggestion-baseline.mjs`.

## Data (all inside `enough_accounts.state_json`)

| Field | What | Limit |
| --- | --- | --- |
| `lifeMap.fitting` | friction, goal feeling, suggestion style, extra time varies, work pattern, answers to goal-fitting questions | strict schema |
| `commitments` | `AdaptiveMovementCommitment[]` (`lib/goal-fitting.ts`) | 60 |
| `followThrough` | events: accepted, not today (+reason), did it (+minutes), did something else, check-in skipped, review | 1500 |
| `dayLoad` | "Full-on day?" for today only | one |

All fields are optional and strictly validated on the server (`lib/account-validation.ts`) and in the browser (`lib/journey.ts`). No SQL migration is needed. Existing saved ideas, accepted ideas, wins, profile and preferences are untouched.

An idea accepted before this release has no commitment. Its planned moment keeps the old "It happened / Not this time" buttons, plus "Make it one of yours". Tapping that creates the commitment then and there, linked to that moment, with no invented history.

## Goal-Fitting Engine (`fitCommitment`)

Inputs: the suggestion exactly as shown (snapshot), its moment, the Life Map, `fitting`, answers and history. Output: an `AdaptiveMovementCommitment`.

- **Usually**: starts at the suggested minutes. It comes down only when:
  - the idea costs extra time for someone short of time or with competing demands; or
  - fatigue, pain or "good days only" walking apply (then about 60%, within the idea's own range).
- **On a full-on day**: 5 minutes for a usual of 10 or more (3 with physical limits), 2 for 5–9, otherwise "Even a minute counts."
- **If it feels good**: the idea's maximum, as "Take the longer loop" style words. It's left out with pain, or when the extra time would exceed a "none" tolerance.
- **Anchor, conditions, abort conditions and fallbacks** come from the moment and the idea. A camera that must stay on, or kids you can't leave, narrows the idea to "sometimes" and an alternative version rather than dropping it.
- **Demand sensitivity**: high for "I start resisting them", "I don't like being told what to do" or "Keep it very low-pressure"; low for "Helpful" with "Help me commit"; otherwise medium.
- **At most one question**, and only if its answer changes feasibility: camera off, leaving the kids' venue, walking comfort, work predictability.

## Invitations (`decideInvitation`)

The decision is `usual`, `minimum`, `alternative` or `stay_quiet`, with a reason. It stays quiet when the commitment:

- is paused, retired, set to "Don't bring it up" or "Just today";
- was already answered today;
- the person has already moved 30+ minutes today;
- is a weekday moment on a weekend (unless their work pattern is shifts or varies);
- has had no's in a row (spacing after 3 no's, quiet after 5; after 2 and 4 for high demand sensitivity);
- is "Sometimes" or "Now and then" and was offered yesterday.

Otherwise:

- **alternative** when the fit is poor;
- **minimum** on a full-on day, or after recent "too busy" or "too tired" answers;
- **usual** when none of those apply.

Home shows at most one invitation a day. The copy is conditional ("If there's a listening meeting today…") because Enough doesn't know what is happening. With high demand sensitivity it softens to "if you feel like it". Saying no has no penalty.

## Check-ins and learning (`recordCheckIn`, `learn`)

- **Check-in options**: "Did it" (5 / 10 / 15 / 30+), "Not today" (optional reason), "Did something else" (kind and minutes) or "Skip".
- **Lighter over time**: after four consistent answers it becomes one tap.
- **No roll-forward**: unanswered check-ins disappear after the next day, and nothing carries over.
- **The usual adapts down** when three or more recent "Did it" answers sit at least 3 minutes below it, for example to "Around 8–10 minutes". It is recorded as something Enough learnt.
- **Never raised silently**: after three longer sessions, Enough offers "Make 25 minutes your usual?"
- **"Still worth suggesting?"** appears after a run of no's, two "chore" or "not a good fit" answers, or every three weeks. It is asked no more than once a fortnight. The options are keep, less often or stop (pause).
- "Not for me" on a suggestion is unchanged (System A).

## Screens

- **Onboarding**: two short optional screens after extra time: "What tends to get in the way?" and "How do exercise goals usually feel?" with "How should Enough suggest things?". Extra time gains "Depends on the day".
- **Home**: Best fit and others are unchanged. Below them, "Yours" shows check-ins, at most one invitation, or nothing.
- **My Moves**: "Your movement that fits": usually, full-on day, works best; Did one, Change, Pause.
- **My Wins**: per-opportunity lines, then movement, extra time and opportunities used. "Most of this fitted into things you were already doing." No streaks, debts or red misses.
- **My Enough**: the rows are:
  - My routines
  - What gets in my way
  - What I like
  - What Enough should avoid
  - How much extra time I'm okay with
  - How I like suggestions

  Under them, a "Things Enough has learnt" list.

## Feature flag

`adaptiveGoalFittingV1` (`lib/flags.ts`) is on by default.

- **Off for everyone**: set `NEXT_PUBLIC_ADAPTIVE_GOAL_FITTING_V1=off` on Vercel and redeploy.
- **Compare in one browser**: add `?adaptiveGoalFittingV1=off` (or `=on`) to the URL. The choice is remembered on that device.

With the flag off, "I'd do that" and every page behave exactly as before. Saved commitments are kept, just not shown.
