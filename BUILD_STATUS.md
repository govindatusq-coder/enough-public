# Load Bear — BUILD STATUS

Last updated: 23 October 2026.

## Completed
- Brand board studied; visual system documented (`docs/load-bear/00-visual-system.md`).
- Architecture, data model, extraction schema, vertical slice, milestones and external configuration documented (`docs/load-bear/01`–`06`).
- **P0 bill workflow, end to end and real:** sign-in → onboarding (Areas, People, PINS, Life Rhythm, Capacity) → Give it to Bear (text, typed, photo, screenshot, PDF) → Bear-thinking extraction (rule-based always; Anthropic vision when a key exists) with per-field confidence and provenance → "Have I got this right?" with specific questions for uncertain fields and user corrections recorded → Area/Project/Task/Bill creation with warranted dependencies → reminder plan from the capacity map and coordination engine → reminders actually scheduled (rows + in-app delivery + local notification + Web Push when configured) → notification decision engine (no guilt, quiet hours, day mode, deferral changes the plan) → assistance (payment page, BPAY, copy reference, original bill, explain, draft a question) → mark paid → Completion, Win, defensible Wealth entry, recurring expectation → My Wins, My Bear ledgers → Bear Ideas (recurring, discount, increase, related areas, missing expected; "Not relevant" trains suppression).
- Chaos Mode (How's today?), first-run example bill clearly labelled and excluded from totals, empty/loading/error/offline states, accessibility basics (labels, focus rings, reduced motion, large targets, no colour-only meaning).
- Supabase migration for 21 `bear_*` tables with owner-only RLS and a private `bear-documents` bucket; request-scoped Supabase store; in-memory store for tests and local development.
- Tests: 162 passing (vertical slice, edge cases, extractor, decision engine, capacity, coordination, store isolation). TypeScript, lint and production build clean. 21-step Chromium walk-through of the real screens passes (`docs/load-bear/07-verification.md`).
- Cron delivery route + Vercel cron (hourly) + GitHub Actions workflow (15-minute) for push reminders.

## In progress
- Nothing. The MVP is complete pending the external configuration below.

## Blocked (needs credentials / platform configuration — see `docs/load-bear/06-external-configuration.md`)
- Apply `supabase/migrations/20261023120000_load_bear.sql` to the Supabase project.
- Set `ANTHROPIC_API_KEY` on the server to turn on photo / screenshot / PDF reading (text and typed bills already work).
- Generate VAPID keys and set `BEAR_VAPID_*`, `BEAR_CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` to turn on push delivery; enable the GitHub Actions variable `BEAR_REMINDERS_ENABLED` or rely on Vercel cron.
- Add `/auth/callback?next=/bear` to the Supabase Auth redirect allow-list.
- Real-device checks on iOS Safari (Add to Home Screen, notifications) and a real-provider extraction run.

## Next (P1)
- Voice capture (architected in the capture sheet, marked "coming soon").
- Health and Happiness ledger sources beyond bills; behaviour-learned reminder windows get more weight as data accumulates.
- Licensed Australian lifestyle photography into the onboarding tile art slots.
- Partner/delegation terms in the coordination engine.
