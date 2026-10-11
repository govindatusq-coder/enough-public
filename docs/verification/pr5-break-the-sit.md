# PR5 — short sitting breaks

Adds 15 library alternatives lasting one to three minutes, with stable IDs 46–60, four strength ideas and three brisk options. All include an actual standing/stepping action, usual activity, conservative timing, safety copy and exclusions. The original 44 IDs are unchanged. The water-refill example now describes stairs and carries matching effort and exclusions. The library run and ad-break wall push-ups match the landing imagery.

My Moves gains the Break the sit collection, restricted to the current eligible pool. Short breaks receive a small ranking boost. Pain/accessibility, recovery and fatigue block strength/brisk ideas before scoring, even if an AI candidate claims gentle effort. No explicitly assessed safe exception exists yet, so these versions are conservatively withheld.

The optional Yes / No / Not sure sitting-break reflection is persisted in outcomes, validated on restore and cloud save, included in the existing JSON download and removed with account data. My Wins counts only explicit Yes answers from confirmed outcomes, with no target. Templates never supply the answer.

## Validation

- 127 tests, TypeScript and production build pass; diff checks clean.
- New tests verify IDs, short durations, actual movement, category counts, landing examples, safety gates, eligible collection membership and legacy/optional outcome handling.
- The existing AI validator accepts genuine one-minute movement without savings/output; no `minutes < 5` financial/output filter exists. Novelty context remains bounded as the library grows.
- No database migration or new dependency. Browser checks pending: collection navigation, optional answer skip/change, four My Wins return cells on mobile, and all four landing scenes.

## Rollback

Revert the UI/ranking changes but retain IDs 46–60 and optional `brokeSitting` parsing while saved references exist. Do not remove new catalogue records from histories or exports.
