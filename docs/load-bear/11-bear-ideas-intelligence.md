# Bear Ideas V2: prioritisation, strategic attention, mental-load reduction

Bear Ideas stays what it was: a few things Bear spotted that might save the person a thought. V2 adds
two more kinds of idea (priority and strategic) and makes every idea compete for a small attention
budget. It is not a priority list, not an inbox, and My Bear stays calm.

## Feature flags (all on by default; set the env var to `off` to roll back)
| Flag | Env var | Effect when off |
|---|---|---|
| priorityEngineV2 | `BEAR_PRIORITY_ENGINE_V2` | No importance hierarchy (project/area priors, roles, tidy-up cap) |
| strategicAttentionV1 | `BEAR_STRATEGIC_ATTENTION_V1` | No protect-time / squeezed-out / block check ideas |
| mentalLoadOpportunityV1 | `BEAR_MENTAL_LOAD_V1` | No take-over, head-start, nudge/reply drafts, line-up, let-go ideas |
| bearIdeasIntelligenceV2 | `BEAR_IDEAS_V2` | Old Bear Ideas page and the old "One thing worth doing now" card on My Bear |

## Pipeline (`lib/bear/services/ideas.ts` → `lib/bear/strategy/ideas.ts`)
1. **Candidates** from four sources:
   - the original pattern suggestions (recurring bills, annual bills, bill increases, early-payment discounts,
     related areas, missing bills), unchanged, with their own accept / "Not relevant" behaviour;
   - **Mental Load Opportunity Engine** (family A): take_over (important + hard to start → Bear carries more,
     smaller steps; honest that the person still makes the calls), prepare (lead time), follow_up (a nudge
     draft to copy), reduce_coordination (an RSVP reply draft), reduce_decisions (line up a brain dump, tell
     Bear what matters), simplify (let quiet things go);
   - **Priority Engine** (family B): worth_doing_now (moved here from My Bear), unlock_project,
     prevent_future_pressure;
   - **Strategic Attention Engine** (family C, `lib/bear/strategy/attention.ts`): protect_time,
     reprioritise ("This keeps getting squeezed out"), make_room_check ("Got a decent block today?").
2. **History**: dismissed, set aside and done ideas rest for a cooldown (`profile.ideaHistory`).
3. **Value**: load removed + pressure prevented + strategic progress + decisions saved + money + leverage,
   minus effort, uncertainty and the interruption itself, times a learned multiplier per idea type.
4. **Dedupe**: one idea per thing (task, project, bill), the most useful one.
5. **Attention budget**: max 5; a Full day 3, Wiped 2, Chaos or "Nothing right now" only what can't wait.
   "What have you got room for?" filters out ideas bigger than the room (asked only when it changes what shows).
6. **Nothing useful → nothing** (value floor).
7. **Diversity**: at most two of a type, two strategic, two priority; a mental-load idea keeps a seat so
   strategic ideas never crowd out load reduction.
8. **Rank**: critical first, then value.

## Importance (not priority)
- Task and project edit ask "How much does this matter?": 🔴 Really matters / 🟠 Matters / 🟢 Low stakes / ○ Bear decide.
- Projects also ask "What does this mainly do for you?": 🚀 Moves me forward / 🏠 Keeps things running /
  🛡 Prevents trouble / ❤️ Matters to me / ○ Bear decide (internal roles progress / maintain / prevent / restore).
- Explicit and inferred importance are stored apart (`ImportanceSignal`); inference never overwrites the person's say.
- Hierarchy: Area → Project → Task with confidence decaying upward. A rated project pulls its tasks halfway to
  its level; an unrated project borrows 20% from its strongest tasks; the area prior is ±0.05. Tidy-up tasks
  (fonts, references, formatting) are capped low inside even the most important project.

## Strategic attention
- Watches the **progress clock** of projects that matter (importance × role weight ≥ 0.5), never task age.
- Expected interval: 7 days (really matters), 14 (matters), 28 otherwise. Neglect only after that.
- **Activity is not progress**: tidy-ups, edits and re-ordering don't reset the clock.
- Momentum: moving, stable (new), stalled, blocked (everything waiting on others), dormant (paused).
- No due date ≠ low priority, and Bear never invents a deadline or says overdue/late/behind without one.
- Lots of upkeep done + a stalled important project → one gentle line ("You've kept lots of everyday things
  running lately. X could use a turn too."). No shaming words.
- "I'll make room" → "Roughly when feels realistic?" (Today / Tomorrow / This week / Not sure), stored as an
  intent window. No calendar access, and the copy says so. When the window arrives: "Got a decent block today?"
  Yes → "Great. The little stuff can wait. Nothing urgent needs you right now. Next: …" only if the Priority
  Engine finds nothing critical; otherwise "One thing first: …".
- "Not this week" keeps importance. Three deferrals → one "This keeps getting squeezed out" idea:
  Protect it more / Lower its importance / Pause it.

## Learning without reactive-work bias
- Accepting or dismissing ideas changes which **kinds** of idea Bear offers (multiplier 0.5–1.3; strategic
  floor 0.75 so they quieten but are never silenced). It never changes importance.
- Busyness is not importance: completed upkeep never raises upkeep or lowers a project.
- Only the person's explicit choices ("Lower its importance", the traffic light) change importance.

## My Bear and My Wins
- My Bear: no recommendation card. Greeting, How's today?, area tiles and Bear's handling are unchanged.
- My Wins "Pressure prevented" adds: real steps on a project that matters this week, everyday things kept
  running, and "Bear kept N little things out of your head while you moved X forward."

## Tests
- `tests/bear-ideas-regression.test.mjs`: the original Bear Ideas (8).
- `tests/bear-ideas-intelligence.test.mjs`: scenarios, competition, the 20-idea attention budget, capacity,
  Chaos, reactive-bias, history, My Bear calm, My Wins (21).
