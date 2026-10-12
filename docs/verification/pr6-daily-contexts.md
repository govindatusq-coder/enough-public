# PR6 — daily contexts and sitting moments

Adds Feeling stressed and Tired after a shift to the home tiles and today dialog. Notes affect recommendations only on their recorded device-local day. Stress favours short walks, especially outdoors and with familiar-place preferences; shift fatigue combines fatigue and limited-time boundaries. All PINS safety checks still run before ranking.

The optional routine question offers Desk work, Driving, Evenings, Feeding and settling, Commute and It varies. It boosts relevant one-to-three-minute sitting breaks, never adds a required step or changes the existing resume-at-gap logic. My Pins displays saved choices. Known choices round-trip through local restore, cloud validation and JSON download.

Reduced AI permission excludes both new health-related daily notes and any limits derived from them. It can receive the known, optional sitting contexts. The full candidate safety filter always uses the original profile locally on the server.

## Validation

- 132 tests, TypeScript and production build pass; diff checks clean.
- Five new tests cover local-day expiry, stress ranking with safety/accessibility, shift limits, relevant routine boosts, skipped/legacy profiles, invalid choices and reduced AI context.
- No migration or dependencies. Browser checks pending: eight home tiles on narrow screens, multi-select and It varies behaviour, setup exit/resume, and unchanged three required routine answers.

## Rollback

Revert ranking and controls, retaining optional `sittingContexts` validation so newer saved profiles remain readable. The context strings can remain in existing today notes; unknown notes never loosen needs.
