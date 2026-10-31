# Priority Engine V1 (behind `priorityEngineV1`)

Purpose: remove prioritising from the person's mental load. Bear works out what deserves
attention, when, and from whom, and shows **one thing worth doing now**, or nothing.

Flag: on by default; set `BEAR_PRIORITY_ENGINE_V1=off` (Vercel env) to switch it off. With it off,
Home, item pages, areas and wins behave exactly as before.

## Where it sits

capture → understand → load pattern → decompose → Load Map → **values + goals** → ownership →
**Priority Engine** → action selection → minimum human action → Bear prepares → wait → follow up →
close → learn. The ten load patterns, the load graph, ownership and waiting are unchanged; the engine
reads them.

Code: `lib/bear/priority/` (pure, deterministic) and `lib/bear/services/priority.ts` (data, learning).

| File | Role |
|---|---|
| `types.ts` | ValuesGoalsMap, PriorityVector, PriorityExplanation, PriorityInput/Result, timing labels |
| `engine.ts` | The pipeline: gates, importance, timing, pressure, leverage, global vs action priority, selection, explanations |
| `input.ts` | Turns a load graph into engine input. **Ownership first**: only the remaining human step is considered |
| `values.ts` | Cautious value inference (domains, caring, repeated load types). The person's own choices win |
| `schema.ts` | Validation for the values and goals map |

## Rules (inspectable, not a weighted sum)

1. **Ownership gate.** No remaining human action means it is never in the person's queue. A direct
   debit due tomorrow is the bank's job; a booked appointment is Bear's to remember.
2. **Gates.** *Safety* (gas, sparks, brakes…) is tier 0 and goes first. *Non-negotiable* (registration,
   licence, passport, insurance, tax, essential medication, or anything the person marked "must not
   slip") gets an importance floor and tier 1 when its safe time is within two weeks. *Overdue* is tier 1.
3. **WHY → importance**: consequence by pattern and flags, plus values alignment, plus goal and
   responsibility links, plus the person's own answer ("Very important / Nice if possible / Not particularly").
   Strengths, preferences and aversion never change importance.
4. **WHEN**:
   * **Deadline**: explicit, or implied ("urgent", "no reply yet", "expired", "nearly out").
   * **Lead time**: processing ("takes 3 weeks"), passports (6 weeks), booking (2 weeks), inspections,
     deliveries, replies to a disputed bill.
   * **Latest safe action** = deadline − lead time − handover day (forms, payments, packing) − a day for long work.
   * **Latest comfortable action** = safe − buffer. Buffer: 1 day, +1–2 for aversion, +1 for congested days,
     +1 if put off before, +¼ of lead time, +1 for essentials, +1 for people who "forget until it's urgent".
   * **Future pressure risk** comes from future urgency, aversion, dependants, congestion and lead time.
   * **Pressure prevention value** = days of carrying it saved + dependants unblocked + risk avoided,
     scaled by how small the action is.
   * **Dependency leverage** = pending steps downstream of this one in the load graph.
5. **HOW**:
   * **Effort**: about 2–10 minutes for decisions, signatures and payments; 60 for writing or long work.
   * **Capacity** comes from the person's weekly rhythm (if set), the time of day, and How's today.
   * **Aversion** is learned from "Not today" and starts higher for forms, renewals and bills.
   * **Strengths** only affect presentation.
6. **Surface now** only when there is a human action that isn't held back ("no rush", snoozed, or a
   check that can't happen yet), it is important enough, and at least one of these holds:
   * it is safety;
   * it is overdue;
   * its comfortable time has arrived;
   * it is a *quick win* (a ≤5-minute decision, signature or piece of information due within a week,
     or a payment due within 2 days);
   * it is important maintenance that has waited a long time.

   On a Chaos day only what can't wait gets through.
7. **Selection**: one thing, ranked by tier, then action priority, then importance, then the
   latest safe date. Need-you counts only what genuinely benefits from the person now.
8. **High aversion + important** → `prepare_more`: an honest smaller first step ("Just find the renewal
   notice"), surfaced earlier. Never more nagging, and never a claim of work Bear hasn't done.

Global priority (does it matter overall) and action priority (is now the moment) are separate; a
registration renewal can matter more than anything else and still not be today's one thing.

## Learning (small, visible, resettable)

* **"Not today"** snoozes until tomorrow, counts as a postponement for that kind of load (raising aversion,
  so it comes back earlier with more support), and asks *what made today a bad fit?* only from the second time.
* **Stated reasons**: "Not actually important" lowers importance for that kind of load and marks this item
  "not"; "Don't want to deal with this" raises aversion.
* **Choosing a low-ranked item twice**: Bear asks "How important is this to you?" on that kind of item,
  instead of assuming the person just likes it.
* **Existing learning**: bill lead time, follow-up window and usual providers. All of it lives in
  Settings → My Load Map, with "Reset what Bear learned".

## What the person sees (existing design, nothing redesigned)

* **My Bear**: one compact card under How's today: *One thing worth doing now*, with the minutes and
  why, plus Do this now · Why this one? · Not today. With nothing to do there is no card, and Bear's
  handling says "Nothing for you to do right now". Need you stays small. My Bear still fits one phone
  screen at 390×844.
* **Why this one?**: a sheet with a headline ("It isn't the most urgent thing. But now is a good time
  to do it.") and 1–3 reasons. Buttons: Sounds good / Not today.
* **Item page**: *Why this matters* (1–3 reasons, a calm timing label), a small timeline (good time to
  act → gets tighter → deadline) where a lead time makes it useful, the smaller first step for aversive
  items, and the one importance question only when Bear is unsure.
* **Areas**: calm labels (Worth doing now, Good to do this week, Coming up, Waiting, Bear is handling it,
  Later is fine) instead of "No rush"; ordered by what is worth doing first.
* **My Wins**: *Pressure prevented*: handled before urgent, last-minute rushes avoided, follow-ups Bear
  remembered, and things you didn't have to keep in your head. All counted from real completions,
  reminders and replies.
* **Settings**: *What matters to you*: confirm values (Bear's guesses are labelled as guesses), and add
  goals, responsibilities and "must not slip" items.

## Data

All stored in existing JSONB bodies, so no SQL migration is needed:

* `profile.valuesMap`;
* `task.snoozedUntil`, `task.postpones` and `task.importance`;
* `completion.timing` (a snapshot of latest safe and comfortable dates when done).

Priority itself is computed on read, which is cheap and always uses the current date. Existing data is
untouched; older items without a load graph are simply not prioritised.

## Tests

* `tests/fixtures/priority-cases.mjs`: 100 scenarios (10 per pattern) plus conflict tests A–J, all run
  through the real load and priority engines.
* `node scripts/priority-stress.mjs` prints results by pattern.
* `tests/bear-priority.test.mjs`: every fixture, the spec's worked example, and properties (strength
  never raises importance, aversion never lowers it, Chaos day, trajectory without panic words).
* `tests/bear-priority-service.test.mjs`: Home pick, nothing-to-do state, "Not today" learning,
  importance override, the flag, My Wins counts and area ordering.

Caveat: the fixtures and rules were written together. They are product checks, not a blind evaluation.

## Known limitations

* The numbers are uncalibrated heuristics; they need real usage to tune.
* Capacity is only known when the person has set a weekly rhythm (onboarding no longer asks), so
  "available minutes" is usually unknown and treated as fine.
* Bear cannot yet prepare external things (compare insurers, fill in forms, find appointment times). The
  "first step" is a smaller human step, not Bear's work.
* Congestion only looks at other open loads' deadlines, not a calendar (no calendar integration).
* My Bear scrolls on very small phones (320×640). It did before this change too.
* Ideas that are accepted mostly adjust expectations Bear owns. Only the example bill becomes a load,
  and it is prioritised like any other.
