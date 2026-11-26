# The Adaptive Responsibility Engine

Load Bear keeps its three screens:
- **Drop Bear**, where she unloads what's on her mind
- **Got a Moment?**, for help that suits her right now
- **Bear Brain**, which organises everything Bear is holding

Underneath them sits one shared layer, in `lib/bear/adaptive/`. It changes what Bear does, not only how things look.

Founding idea: task organisers are great if you have control over your time. Many people don't. Bear has to fit the day she is actually having.

## How it fits together

| Part | File | What it does |
|---|---|---|
| Temporal profile | `profile.ts` | Ten dimensions, each scored 0–1 with a confidence, from her onboarding answers. Scoring is deterministic and versioned (`tp-1`), with no AI. A blend of four internal starting profiles (planner, juggler, improviser, on-call carer). The blend is never shown to her, and nothing is inferred from nationality, gender, age or occupation. |
| Responsibility attributes | `attributes.ts` | What a responsibility *is*, apart from which list it's in. See the attributes section below. |
| Capability registry | `capabilities.ts` | What Bear can really do. Each capability lists whether it's available, whether it acts outside the app, whether it needs approval, whether it can be undone, what evidence it leaves, and its fallback. Buying and paying are never available. |
| List sets | `lists.ts` | Bear's originals plus four suggested sets, with attribute-based placement rules. |
| Learning | `learning.ts` | Four separate stores: where she puts things, which kinds of help she takes, when she gets things done, and her feedback (including suppressed kinds). Each can be inspected and reset. |
| Strategy selection | `strategy.ts` | The seven strategies, the effective window, versioned weights (`aw-1`) and the choice itself. |
| Relief events | `relief.ts` | Reinforcement for real outcomes, and the words used for them. |
| Feedback | `feedback.ts` | Optional feedback, at most once a day. |
| Communication | `comms.ts` | Her choice of how Bear helps through the day decides which reminders reach her phone. |
| Experiments | `flags.ts` | Conditions A–E for evaluation, development only. |
| Storage | `service.ts` | Saving her answers, choosing lists, learning from her moves, resets. |

The responsibility attributes in `attributes.ts` are:
- domain (one of 20), pattern and context tags
- business hours and location needs
- her minutes versus Bear's minutes
- cognitive and emotional effort
- interruptibility, whether it can be resumed, and the minimum useful window
- readiness and missing information
- execution mode
- whether Bear could prepare it, act on it, or hand it to someone else
- the cognitive-labour stages (Daminger: anticipation, identification, decision, execution, monitoring), and who carries each
- the latest useful moment to act
- a confidence for each inferred field

Attributes are derived from the task and Bear's existing plan, so a responsibility exists once and is never duplicated.

### No database migration was needed

Tasks and profiles are stored as JSON bodies. Every new field is optional, and when it's absent Bear behaves exactly as before:
- **Profile:** `temporal`, `country`, `listStyle`, `adaptive`.
- **Task detail:** a computed `carrying` field.
- **Relief events:** use the existing behaviour-event table (type `relief`).

## Onboarding: "How your days work"

Seven one-tap questions, one per screen, every one skippable:
1. control over her day
2. how things get done
3. what gets in the way
4. what she'd like help with
5. whether others can help
6. how Bear should help through the day
7. where she lives

The answers are scored on the server. Bear then shows a warm, specific explanation and suggested lists. She can keep them, choose a different style, edit them, or keep Bear's originals.

Notifications are never switched on from these answers. The same flow is in Settings › How your days work. The old onboarding questions (what she carries, household, Load Map) are now Settings › My Load Map.

## Bear Brain lists

| Set | Lists | Suggested for |
|---|---|---|
| Bear's originals | Night Time, Phone Calls, Organise Follow-Up, Organise Time-Permitting, This Week & Weekend, Aspirations | Everyone, until she chooses |
| By area of life | Work, Family, Home, Money, My Wellbeing, Personal Goals | High control, planning ahead |
| Around my routine | Before Work, Business Hours, After Work (After Pickup with children), Nighttime, This Week & Weekend, Waiting on Others | Fixed routine, less control |
| By the time I've got | Quick Wins, A Longer Window, When Places Are Open, When I'm Out, Quiet Moments, Waiting on Others | Flexible but unpredictable |
| What I need help with | Bear Can Prepare, Needs Arranging, Someone Else Can Do It, When I Have Capacity, Waiting on Others, Just for Me | Little control, unpredictable |

Choosing a set deletes nothing: things in lists that go away return to My Brain Dump, and Bear suggests a new place. She can mix in lists from other sets in Settings › Categories.

When something isn't filed by her, Bear places it in this order:
1. Her own filing.
2. Bear's earlier suggestion.
3. Her corrections. Two explicit moves of the same kind of thing are enough.
4. Word learning.
5. Attribute rules.
6. The original fallback.

Bear's own guesses never teach it, and a change in what it has learned never moves something she has already filed.

## Choosing what to offer (Got a Moment?)

For each request, Bear works through these steps:
1. **Hard feasibility checks.** These are shared with the original picker: waiting on someone, missing information, a trip out, longer than the window, businesses closed, a way that can't work in time, skipped recently.
2. **"Don't suggest this kind of thing".** This is respected unless the deadline is at risk.
3. **An explainable score.** Each candidate is scored:

   `consequence + deadline + dependency + context + readiness + relief + preference − effort − interruption − burden`

   The weights start from `BASE_WEIGHTS`, blended by her profile through `ARCHETYPE_DELTAS`, and are versioned.
4. **Ties.** These are broken by the original transparent order.

The window allows for real life: `minutes × (0.6 + 0.4 × predictability) − 1`, and "Not sure" means 5 minutes.

The strategy is chosen per responsibility and moment, never fixed per person:

| Strategy | When |
|---|---|
| Prioritise | Deadline at risk, or due soon |
| Offload | Bear has it ready to review, or can prepare it first |
| Synchronise | A call or booking while places are open |
| Match opportunity | "Not sure" how long, or it simply fits |
| Adapt | Can be stopped part-way and her days are often interrupted |
| Allocate | Planning-style days and a step of 20 minutes or more |
| Protect | Nothing needs her (the offer is a break) |

The main button says what happens next: **Give it to Bear**, **Review it**, **Make the call** or **Let's do it**. A short note says why, only from true facts.

If she has help, the step is a real effort for the window, and the rule says someone else could do it, Bear notes that it could ask someone.

When nothing fits, Bear offers one of these instead:
- something Bear could prepare
- something someone else could take
- setting time aside (for planning-style days)
- a break

**With no profile, the choice is exactly what Got a Moment always made.** Experimental conditions are read from `BEAR_ENGINE_CONDITION` only outside production.

## Reinforcement (relief, not gamification)

Relief events are recorded only for real outcomes:
- captured
- information prepared
- decision simplified
- dependency resolved
- ownership accepted
- completed
- monitoring established
- progress preserved
- recovery chosen

Each event carries its source and how it was verified: user confirmed, recipient confirmed, system record, or unverified. There are no streaks, no counts of opens, and no estimates of time saved.

The words suit how her days work. For example, "Sorted, ahead of time." is used only when it genuinely was; "That's one less thing to carry." is another.

Optional feedback is offered at most once a day, after "Not now":
- Not the right moment
- Too much effort
- I'd rather Bear handle this
- Don't suggest this kind of thing

A quiet "That helped" is also offered after finishing.

## Communication

Her answer to "How would you like Bear to help you throughout the day?" decides which reminders are pushed:

| Answer | What reaches her phone |
|---|---|
| Only when I open the app | Nothing |
| When something important needs attention | Only things due within a day |
| A gentle daily check-in | At most one a day |
| Help me decide as I go | Everything, as before |

Everything still shows in the app.

## Share Bear and transfer

Share Bear by text is a genuine transfer. The task is hers until the person accepts, and Bear watches it afterwards (reminders, follow-ups, and news to her). A decline returns it to her unchanged. The older link share keeps its three modes: information, action and transfer.

## Evaluation

**Eval200** (`evaluation/eval200`) covers 200 benchmark scenarios. See its README.

**The temporal-autonomy harness** is `scripts/adaptive-harness.mjs`, run against `research/temporal-autonomy/synthetic-tasks.json`:
- 500 synthetic responsibilities in 20 domains
- × 4 profiles × 3 countries = 6,000 configurations
- × 5 conditions = 30,000 evaluations, run through the real code
- about a quarter include an adverse case:
  - missing information
  - a wrong estimate
  - a declined helper
  - an unavailable third party
  - her declining
  - very little time
  - clashing deadlines

Results are saved in `research/temporal-autonomy/runs/`.

Each measure is reported separately, with no combined score. The labels are hand-assigned, and the list each set "should" use is a harness assumption. These are engineering tests, not evidence about real people's load, relief or autonomy.

## Running

```
npm test                                   # unit and integration tests
node scripts/adaptive-harness.mjs          # 30,000 evaluations (about an hour)
node scripts/eval200-run.mjs --label ...   # Eval200
BEAR_TEST_MODE=start node scripts/test-bear-board.mjs     # 15-step walkthrough (after npm run build)
BEAR_TEST_MODE=start node scripts/test-bear-browser.mjs   # full walkthrough
BEAR_ENGINE_CONDITION=D npm run dev        # force a condition locally (ignored in production)
```

## Not done, or limited

- **Bear's own reading without AI** is rule-based. Better rules help (titles, times, background sentences), but the AI path, used in production when available, wasn't evaluated here.
- **Country** sets dates and time zones. Spelling, currency, administrative terms and public holidays aren't localised yet; the app's wording is Australian English.
- **Generic tasks** (for example "plan the week's dinners") have nothing useful for Bear to prepare yet.
- **No new integrations.** Nothing new reads email, calendars, school portals or banks. Synchronise uses business hours and her learned usual hours, not her calendar.
- **The "daily check-in"** limits pushes to one a day. It isn't a composed daily summary.
- **The research instrumentation** records structured, wordless events. The research export, consent wording and enrolment of real people into conditions are not built. Production never enrols anyone.
