# Cognitive Relief Policy

This is an intelligence upgrade inside the existing Adaptive Responsibility Engine. It isn't a redesign. Bear now picks the help that should take the most off her plate for the least asked of her. It no longer mainly optimises for getting tasks done.

## Objectives, in order

1. Protect against serious foreseeable consequences, missed consequential deadlines and unsafe actions.
2. Respect what she has said, her consent and her choices.
3. Reduce what she has to remember, decide, research, organise, coordinate, monitor and do.
4. Give her time back.
5. Resolve responsibilities.
6. Make progress when resolution isn't possible yet.
7. Earn her coming back by being genuinely useful.

Bear never optimises for throughput, time used, interactions, tasks captured, notifications answered or time in the app.

## Where it lives

| What | File | Reuses |
|---|---|---|
| Burden model, the interventions, utility, the choice, no-intervention | `lib/bear/adaptive/relief-policy.ts` | Attributes, learning, profile |
| Selection with the policy (`reliefMoment`) | `lib/bear/adaptive/strategy.ts` | The shared feasibility checks (`candidatesFor`), `explain`, stability, the nothing-fits message |
| Prepare before presenting, capacity, rollback switch | `lib/bear/rre/service.ts` (`recommend`) | `giveToBear` (internal, reversible preparation only) |
| Backup plans and awareness state | `lib/bear/adaptive/attributes.ts` | The plan's pathways, deadlines and delegation state |
| Push budget | `lib/bear/adaptive/comms.ts` | The existing outbox and quiet hours |
| Bear's shared instructions | `lib/bear/ai/bear-core.ts`, added to the Bear Boost conversation prompt | |
| Reinforcement wording | `lib/bear/adaptive/relief.ts` | The relief events |

No database changes were needed: everything is derived, or stored in existing JSON fields.

## How a decision is made

### Stage 1: feasibility and consequence protection

1. **The hard checks.** These are the same ones Bear Boost has always used: waiting on someone, missing information, a trip out, too long for the window, places closed, a way that can't work in time, skipped recently.
2. **"Don't suggest this kind of thing".** This is respected unless a deadline is at risk.
3. **Consequence protection.** If a deadline is at risk, only those things are considered.

### Stage 2: expected net relief

For each responsibility, Bear works out what it still asks of her (`burdenOf`). It scores nine kinds of mental work, each from 0 to 1:
- remembering
- anticipating
- searching for information
- deciding
- planning
- coordinating
- monitoring
- picking up after an interruption
- doing it

Then it weighs the ways it could help. Each way has an estimate of what it would remove and what it would introduce: questions, approvals, decisions, coordinating, monitoring.

| Intervention | When it's available | What it asks of her |
|---|---|---|
| Bear prepares | Bear's step is next, and it needs no AI or outside action | A quick look |
| She reviews | Already prepared | One check |
| Hand it on (Share Bear) | Someone could reasonably do it, she has help, and the window allows | Choosing someone and sending. Worth less if someone already said no. |
| Do the next step | It fits the window | The step itself |

Utility is calculated as:

```
net relief + meaningful progress + consequence + preference + fit + long-term relief
  − interaction cost − interruption risk − uncertainty − downstream coordination
```

The weights are `RELIEF_WEIGHTS`, version `crp-1`, shifted a little by her profile. A low-energy day ("wiped") raises the interaction cost, and a "chaos" day raises it further.

### Safeguards

- **Consequence first.** A deadline at risk is never starved by easier things.
- **Repeatedly put off.** Things that matter (not aspirations) gain weight each time they're skipped.
- **The easy-task bias guard.** A quick, low-stakes task doesn't beat something that matters and fits nearly as well.
- **Stability.** Asking again soon gives the same suggestion unless something more pressing appeared.

### No intervention

When nothing consequential is at stake and offering anything would cost more than it gives, Bear doesn't intervene. The threshold is `NO_INTERVENTION_BELOW`, and it also applies on a "chaos" day. Bear then says that nothing needs her right now, and that everything is in Bear Brain. It never says Bear is "watching" something unless a follow-up really exists.

### Prepare before presenting

When the chosen help is "Bear prepares", it's done before the card is shown. She sees "Bear has got it ready. It just needs a quick look." with **Review it**.

Gift ideas aren't prepared this way, because they use the AI service when it's available. They're prepared when she taps.

## Other behaviour

- **Interruptions.** Leaving a task part-way in Bear Boost saves her place. The policy then favours picking it up ("Pick up where you left off. Bear kept your place.").
- **Backup plans.** Each responsibility carries backup plans, kept quietly and never shown. Examples: places are closed, so it's kept for opening hours; another way to do it; a helper says no, so it comes back to her unchanged; the deadline is getting close, so it moves up.
- **Awareness state.** Each responsibility has an internal awareness state, not shown as a new status:
  - captured
  - understood but not ready
  - ready for her
  - prepared for approval
  - in progress
  - awaiting someone else
  - accepted by someone else
  - monitored
  - completed
  - cancelled
- **Notifications.** At most three pushes a day, on top of her own choice of how Bear helps. Anything due within a day always gets through, and everything still shows in the app.
- **Minimum viable interaction.** Optional questions are never asked on a day she's said is hard.
- **Reinforcement.** It says what happened, never how she feels. Examples:
  - "That's sorted. Nothing more to do on it."
  - "Daniel accepted this. You don't need to organise it yourself."
  - "Bear has prepared the information you need."
  - "Bear kept everything where you left it."

## User-facing changes

All of these are small, inside existing components.

- **The task card**, when handing on is the best help, leads with **Ask someone** and offers **I'll do it**. Otherwise it's as before.
- **The card's note** can say "Bear has got it ready. It just needs a quick look." or "Pick up where you left off."
- **When nothing is offered**, the wording is "Nothing needs you right now…", or on a chaos day "It's been a lot today…".
- **Bear Brain** shows prepared suggestions as Ready to check. That's their true state.

Separately, at your request:
- Onboarding starts with the three-screen "How Bear works".
- Her name is asked only if sign-up didn't give it.
- Each question is centred, with an illustration.
- Bear Brain's links (Calendar, Share Bear, Bear Helps, Edit categories) have a back button to Bear Brain.

## Rollback

Set `BEAR_RELIEF_POLICY=off` in the environment, then redeploy or restart. Bear Boost returns to the earlier adaptive scoring; everything else is unaffected.

This is an operations switch, not an experiment: nobody is enrolled in anything. For comparisons in development, `BEAR_ENGINE_CONDITION` (A–E) still works. It is ignored in production.

## Evaluation

`node scripts/relief-compare.mjs` runs the previous engine and the relief policy on identical scenarios: two identical accounts per scenario, the same tasks, capabilities and times. It covers 16 scenario types:

| Scenario type | Expectation fixed in advance |
|---|---|
| Routines | none |
| Competing tasks | none |
| Very little time | none |
| A low-energy day | none |
| Missing information | none |
| A declined helper | none |
| Her saying no | none |
| A chaos day | only what's consequential |
| The wrong profile | none |
| Previously rejected | none |
| A high-stakes deadline | it's offered first |
| Repeatedly put off | it's offered first |
| No intervention is best | nothing, or something tiny |
| Frequent interruptions | none |
| Unpredictable caregiving | none |
| A lot of control | none |

Every measure is observable:
- how many things need her attention afterwards
- her steps and decisions on what's offered
- whether it was prepared before being shown
- whether it fits the window and business hours
- whether the deadline or deferral expectations held
- whether her "no" was respected
- whether an optional question was asked on a hard day
- any false completion

None of the measures uses either policy's own relief estimate.

These are synthetic engineering results, not evidence of relief for real people.
