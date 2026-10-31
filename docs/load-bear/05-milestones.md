# Implementation milestones

| # | Milestone                                                     | Gate                                   |
|---|---------------------------------------------------------------|----------------------------------------|
| 1 | Domain types, store interface, memory store, migration        | tests + tsc                            |
| 2 | Services: extraction (rules + model), bill, task, reminder, decision, completion, ledger, suggestion, behaviour, capacity, coordination | vertical-slice tests pass |
| 3 | API routes + Supabase store                                   | tsc, build                             |
| 4 | Brand system: fonts, tokens, glass, Mama Bear, nav, shell     | build, Chromium screenshots            |
| 5 | Onboarding (welcome, areas, people, PINS, rhythm, capacity)   | build, journey test                    |
| 6 | Capture sheet, Bear thinking, verification, plan, bill detail | build, browser walk-through            |
| 7 | My Bear, Bear Ideas, My Wins, Me, Chaos mode                  | build                                  |
| 8 | Notifications: service worker, local, push, cron              | build, tests for decision service      |
| 9 | Demo bill, empty/error/loading states, accessibility pass     | build, lint, tests                     |
|10 | BUILD_STATUS, docs, final verification                        |                                        |

After each milestone: `pnpm test`, `pnpm tsc`, `pnpm lint`, `pnpm build`.
