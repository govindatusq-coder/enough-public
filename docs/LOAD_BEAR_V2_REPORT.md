# Load Bear v2: three screens and the Responsibility Resolution Engine

*Less on your mind. More of your life.*

This report covers what was built, what was verified, and what remains. Nothing below is described as working unless it was run.

**About the reference screenshots:** they weren't attached to the request. The screens were built from the written specification: layout, wording, order, labels, icons and colours. Send the screenshots to have the visuals matched more closely.

## 1. Architecture assessment (what was there)

| Area | Found | Used for v2 |
|---|---|---|
| Frontend | Next.js 16 App Router, React client screens, one CSS design system (cream, navy, coral, glass) | Kept; three new screens plus a detail screen |
| Auth | Supabase sign-in; every `/api/bear` route checks the session and same-origin writes | Kept unchanged |
| Data | One store interface (Supabase in production, in-memory for tests). Every entity is a JSON body plus indexed columns, protected by row-level security | Kept. The plan is stored on the task (section 3) |
| AI | Claude through one provider interface: structured output, a fallback model, daily caps | Reused for splitting what she says, gift ideas and drafts |
| Calendar | Bear's own calendar; Outlook calendar connection | Bear's calendar is used for "booked" times |
| Email | Inbound "forward to Bear" (off by default); no outbound sending | Not used for execution. There is no sending |
| Classification and priority | Rule-based sorter, list suggestions with learning, Priority Engine (Bear Ideas) | Sorter and learning reused; the RRE replaces priority on the new screens |
| Notifications | Durable reminder job (GitHub Actions cron, delivery outbox, Web Push), quiet hours | Used for "Bear checks back" follow-ups |
| Execution | Drafts, call notes, prepared forms, bill details, Share Bear | Reused as Bear's level-1 preparation |

**Not available anywhere in the app:** buying, sending email or texts, booking, or submitting forms on her behalf. That caps Bear at preparing and coordinating (levels 1–2). Levels 3–4 were not built because there is nothing real to execute against, and pretending would break the brief.

## 2. Deliverables

| # | Deliverable | Implemented | Reused | Tested | Not done, or needs setting up |
|---|---|---|---|---|---|
| 1 | Architecture assessment | Section 1 | n/a | n/a | n/a |
| 2 | Schema | Versioned `Plan` on each task (`task.rre`): outcome, kind, people, item, pathways, opportunities, deadlines, dependencies, step index, execution state and log, skips. On the profile: `preferences`, `rreLast`, `rreTrace` | Existing task and profile records | Unit tests | Not normalised into separate tables (section 3) |
| 3 | Migrations | None needed: optional fields, built lazily for older tasks and carried forward | n/a | Older tasks get plans on first view (tested) | n/a |
| 4 | Responsibility extraction | Drop Bear splits many things in one go (rules, then AI when it finds at least as many). Each becomes a responsibility with an outcome, people, item, and a deadline only if one was said (Christmas is the one known date) | Existing sorter and AI splitting | "Four things at once" in the browser; outcome tests | Recurring responsibilities aren't specially modelled |
| 5 | Pathway generator | Rule-based pathways per kind: order online, buy locally, borrow, use one you have; ring or book online; message or call; shortlist then buy; and so on. Each has her minutes (a range), elapsed time, reliability, disruption, needs, lead time, evidence and confidence | n/a | Unit tests | Pathways are rules, not AI-generated: transparent and testable, but fixed per kind |
| 6 | Feasibility evaluator | Online is infeasible under 2 days and uncertain under 4. Unknown stays "uncertain". Ranking: feasible first, then her preference, least disruption, least of her time, most reliable | n/a | Scenario E | No live stock or delivery checks (no data source) |
| 7 | Opportunity engine | Order-online window (deadline minus about 4 days), Christmas buy-early, pay-early. Each has a status: available, expiring, expired or uncertain | n/a | Scenario A; scrunchie; Christmas | No discounts or cancellation slots (no data source) |
| 8 | Recommendation engine | Got a Moment? runs these stages: candidate actions, blocked-dependency filter, context (business hours for calls, no shop trips in 5 minutes), fits-the-time, skipped recently. Then it drops dominated options (Pareto), orders the rest transparently (real deadline risk, closing opportunity, ready to check, medium risk, opportunity, fit, effort), and breaks ties stably. It shows her active minutes, a grounded label and reason, and "just as good" when tied. It is stable for 3 hours and keeps a decision trace (last 10) | `businessOpen` | Scenarios A–H, stability, nothing-fits, phone hours | Uses time of day only: no calendar or location context |
| 9 | Preference learning | One choice is an observation, three consistent choices make an inference, and what she says explicitly always wins. Category corrections are learned per word. "What Bear has learned" (Settings) shows each one, where it came from, and Forget | Existing category learning | Unit test and browser | Only buying method and categories are learned so far |
| 10 | Dependencies and follow-up | Waiting steps (delivery, reply) create a dependency with an expected date and a durable reminder. Bear doesn't offer them until that day passes, then offers "Check …" or "Follow up". "It hasn't come" moves to the next way | Reminder job | Scrunchie, scenario C, not-arrived | Replies aren't detected automatically (inbound email is off by default) |
| 11 | Execution and approval | Give it to Bear prepares her part: where to order (shop search and checkout note), shopping note, borrow message, gift shortlist (AI ideas, no products or prices), drafts, call notes, bill details, form. It is safe to tap twice and logged. Separate states for execution and for the responsibility. Complete only when the outcome is confirmed | Help drafts, forms, bills | Tests: idempotent, "order placed" is not done, nothing claimed sent or bought | No level 3–4 (section 1) |
| 12 | Drop Bear | Header (LOAD BEAR, Mama Bear, settings), "Morning, Sarah." plus "What's on your mind?", one big card with the exact placeholder, photo/PDF (through Bear's reader), voice and coral send. A short acknowledgement, a tip only when time-sensitive, Give it to Bear | Existing input, voice, reader | Browser | Photo reading needs the AI key |
| 13 | Got a Moment? | Heading, subheading, four single-select pills, one card (label, title, "Takes about N minutes.", reason, chevron, Give it to Bear), Not now and Something else, See All Tasks → | n/a | Browser and unit | n/a |
| 14 | Bear Brain | Brain icon, title, subtitle, search, settings. "All Tasks (N)" filter with real counts (also Needs attention, Ready to check, Waiting, plus Calendar, Shared, Bear Helps, Edit categories). Priority Actions (4, expandable) with reasons. The six categories in the specified order, with pastel cards and counts, opening to her checklist rows (tick, share, remind, move, delete, reorder) | Checklist rows and menu | Browser | n/a |
| 15 | Navigation and design | Three tabs (cloud with arrow, clock, brain); active tab coral, inactive navy; frosted; safe area. Settings only in headers. Desktop sidebar | Design tokens | Browser (phone and desktop) | n/a |
| 16 | Responsibility detail | What needs to happen, Next (Give it to Bear or her step button), What Bear has done, the plan with steps, dates, waiting on, other ways ("I'd rather buy it in person" is recorded as explicit), editable category, history | n/a | Browser and unit | n/a |
| 17–18 | Tests | `tests/bear-rre.test.mjs` (18: scrunchie end to end, not-arrived, Christmas, A–H, stability, nothing fits, phone hours, Bear Brain, preferences, safety). `scripts/test-bear-board.mjs` (11 browser steps). Full suite 749 passing; existing 47-step walkthrough passing | n/a | `npm run verify`; both walkthroughs on a production build | No real screen reader (VoiceOver) run |
| 19 | Documentation | This file | n/a | n/a | n/a |
| 20 | Production readiness | Section 4 | n/a | n/a | n/a |

## 3. Design decisions

- **The plan lives on the task, not in new tables.** Every Load Bear entity is already a JSON body with indexed columns behind row-level security, and new tables would need a database migration this environment can't apply. Nothing breaks if a plan is missing: it is built on first view. The plan shape is versioned (`rre-1`) and checked in code. If Bear Brain ever needs database-side queries over pathways, a migration to normalised tables would be the next step.
- **Separate parts.** Understanding, pathways, deadlines and opportunities live in `lib/bear/rre/model.ts`; plan and states in `plan.ts`; the decision in `decide.ts`; preparation in `prepare.ts`; preferences in `prefs.ts`; storage in `service.ts`. Model output is never executed: AI produces only text (ideas, drafts) that she reads.
- **Real deadline risk, not pathway pressure.** "Deadline approaching" is based on the outcome deadline after the shortest lead time of any way that still works. Ordering a scrunchie online being tight doesn't make the scrunchie urgent while it can still be bought locally.
- **Honesty.** Every estimate is a range with a note on where it comes from. "Order by about Thursday" is marked as an estimate, and nothing says delivery is confirmed.

## 4. Production readiness

**Ready:**
- The three screens and the detail screen work end to end against the in-memory store and on a production build, phone and desktop, with no page errors and no sideways scroll.
- Older tasks get plans automatically, and nothing is deleted.
- Each person can only act on their own responsibilities (tested).

**Needs real-world confirmation:**
- Plans saving correctly in Supabase. They use the same task record and update path as everything else, so a quick check after release is enough.
- Gift ideas from the live AI (tested only with a stand-in).
- The "Bear checks back" reminder arriving on a real phone, which needs push enabled on the device.

**Risks:**
- Rule-based kinds can misread unusual phrasing. The kind decides the pathways, so a misread gives a plain "Do it" plan; she can still change the category and the way.
- Business hours are a general weekday 9–5 rule.
- Without live product or delivery data, Bear's "order by" is an estimate. The screens say so.
