# Suggestion movement quality — 11 October 2026

The generator previously treated ordinary seated hand activity as movement. The candidate validator trusted a free-text movement label and clamped any movement duration into 1–60 minutes. Consequently a stationary hobby such as sewing a cushion cover while listening could be assigned 25 movement minutes and rank as a strong recommendation.

New candidates require an explicit physical instruction, a recognised movement mode, and separate total-activity and moving durations. The action must describe movement appropriate to its mode and be present in the displayed instructions. Zero, fractional, exaggerated, or impossible moving durations are rejected. The prompt forbids stationary hobbies, finger-only tasks and static standing as substitutes for movement; it may return fewer ideas rather than pad the result. A 20-minute podcast with a one-minute mobility pause counts one movement minute.

Discovery also checks earlier AI descriptions for a physical action. Non-movement ideas remain in private saved/archive history but do not re-enter the recommendation pool. Saved ideas explain this distinction. Confirmed outcomes, PINS and safety boundaries are preserved. Seven ambiguous library instructions now explicitly describe their movement; stationary appointment waiting is replaced by a short comfortable stroll, and cooking counts active preparation rather than the entire cooking period.

## Validation

- 108 Node tests pass. Regression cases cover crafts, reading, listening, typing, small-object sorting, generic labels, topic-only movement mentions, invalid duration claims, short seated mobility, current hard boundaries, and restoration of legacy bookmarks and actual outcomes.
- TypeScript and the production Next.js build pass.
- Optional movement metadata preserves compatibility with earlier private account snapshots and cursor archive reads. No database schema change is required.
- Generation and image preparation still happen only in explicit suggestion requests. Existing credentials and image caching are unchanged.

The instruction check is a conservative product guard; it does not measure completed movement. Only the user's confirmed outcomes enter My Wins. Production verification should request one new batch, inspect its physical instructions and moving estimates, and verify that earlier non-movement ideas no longer appear in discovery.
