# Continuous ENOUGH suggestions — 11 October 2026

The five-batch daily stop has been replaced by a private, expiring single-request reservation. Users explicitly request every batch, including its pictures. New suggestions appear first; earlier suggestions are retained in an owner-restricted archive and browsed with cursor pagination. The account snapshot retains the latest 100 suggestions and every suggestion referenced by a bookmark, plan, outcome or cost assumption. No suggestion is deleted when that snapshot rolls forward.

## Completed checks

- 98 Node tests pass. New coverage includes 12 consecutive requests in one day, overlapping requests, release after failure, a bounded duplicate retry, unchanged PINS eligibility, 350 browsable ideas, over 100 bookmarks, compact account restoration, cursor boundaries and fresh-first display.
- Production Next.js build and TypeScript pass, including `/api/ideas/history`.
- Applied `20261011045017 continuous_suggestions` to the existing Supabase project.
- `tests/continuous-suggestions.sql` passes transactionally against the migrated database: 12 sequential requests, concurrent denial, token and owner isolation, expiry recovery, 125 retained suggestions, cursor pages, case-insensitive title deduplication, imported suggestions, optimistic revision protection and anonymous denial. All fixtures roll back.
- The Supabase security advisor reports the same existing Auth configuration finding as before this change; no new database findings.
- React review: requests originate in button handlers, in-flight requests are guarded, account changes cancel history reads, functional updates preserve newly arrived ideas, history is paged, picture reads are limited to visible cards/recent preloads, and controls expose pending/error states.

## Release check

After deployment, use the existing signed-in account to request another batch past the former daily allowance, confirm fresh cards and pictures, repeat the request, then reload and confirm both batches remain available. Provider failures remain retryable and never lower PINS boundaries.
