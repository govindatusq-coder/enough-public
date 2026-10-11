# PR4 — movement tags

All 44 existing library IDs are preserved and explicitly tagged. Cards and discovery expose Light movement, Moderate movement, Brisk burst, Strength and Breaks up sitting. The existing `effort` field remains the gentle/moderate compatibility signal for older safety rules; `intensity` describes the estimated movement type, not an individual measurement. Tags never override eligibility checks. Seated stretches, cycling and kneeling gardening do not claim a standing/stepping sitting break.

AI output requires both tags. Shared account/archive validation rejects invalid tags and seated sitting-break claims. Untagged legacy AI ideas become light / false without changing bookmarks or history.

## Validation

- 123 Node tests pass; TypeScript and production build pass.
- Four new tests cover all original IDs/tags, legacy restore/export validation, invalid tags and intersections with other discovery filters.
- The migration's normalisation expression was checked with a read-only PostgreSQL query against missing, valid and invalid fixtures. No production records were changed. The trigger and constraint need a staging migration smoke test before release.
- Migration created with `supabase migration new idea_movement_tags`. Run after the existing enough_ideas migration; no RLS or ownership changes. Defaults support writes from the previous app during a rolling release. Account snapshots acquire defaults when parsed/saved.
- Browser/screen-reader rendering has not been exercised. Check chip readability, keyboard filtering and small-screen wrapping in the preview.

## Rollback

Revert the code commit. Keep the harmless JSON tags, or drop `enough_idea_movement_defaults`, `enough_idea_movement_tags` and `enough_default_idea_movement_tags()` in that order. Never remove idea IDs or saved references. Do not apply this migration to production until the release is reviewed.
