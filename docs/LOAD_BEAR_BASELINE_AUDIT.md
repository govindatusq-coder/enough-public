# Load Bear baseline audit

Taken before the execution-layer work, on branch `claude/keen-lamport-xfglo3` at commit `8e08923` (production at the same commit). Describes what exists, not what is planned.

## Stack
Next.js 16.3.4 (App Router), React 19.2.6, TypeScript, Zod, Supabase (Postgres, row-level security, auth), Anthropic SDK (`lib/bear/ai/anthropic.ts`, model from `BEAR_MODEL`), Capacitor 8.5 iPhone shell with a native Share Extension, Vercel Hobby (`vercel.json` builds only `main` and the preview branch). Node 22 type-stripping runs the tests, so no constructor parameter properties and `.ts` import extensions in `lib/`.

## Tests (at the time of audit)
564 passing (`node --test tests/*.test.mjs`), `tsc --noEmit` clean, lint clean, `scripts/priority-stress.mjs` 110/110, `scripts/load-stress.mjs` 100/100, Playwright walkthrough `scripts/test-bear-browser.mjs` passing (mobile and desktop).

## Data
Per-user tables store a JSONB `body` plus index columns, behind a `BearStore` abstraction (`MemoryBackend` for tests, `SupabaseStore` in production). Migrations in `supabase/migrations/` (all additive, rollback SQL in comments): `load_bear`, `inbound_email`, `responsibility_events`, `enterprise`, `study_responses` and two earlier ones. **The later four have not been confirmed as applied to production.** The event log degrades quietly when its table is missing; the execution layer deliberately does not (it refuses to act).

## What already works
Capture (text, photo, screenshot, upload; voice shows as unavailable), forwarded email (off by default), Outlook add-in (read-only, live), extraction, ten load patterns with ownership and closure rules, School admin coverage pack, duplicate detection with update proposals, plan graphs with validation, priority (v1/v2, relational, strategic attention), Bear Ideas orchestrator, reminders and push (needs VAPID keys), the lifecycle state machine and append-only event log, an action capability registry, the decision layer (rule-based) with Outlook first-read, draft reply, offers memory, an enterprise API v1 (off), a research study (off), and the evaluation harnesses.

## AI calls
Provider chosen by `providerFromEnv()`; used for reading images/documents and structured extraction when `ANTHROPIC_API_KEY` is set (it is present in production). Rule-based extraction runs without it. No fine-tuning anywhere.

## Integrations and environment
Connected: Supabase, Anthropic (key present), Vercel. Awaiting configuration: Resend inbound (`BEAR_INBOUND_*`, `RESEND_API_KEY`), web push (`BEAR_VAPID_*`), service-role key for cron and inbound/enterprise (`SUPABASE_SERVICE_ROLE_KEY` was not in the Vercel variable list when last viewed). Unsupported: calendar, bank, payments, outbound email, form submission, booking. Flags default ON unless stated: priority/strategic/ideas/relational/coverage/responsibility engine. Default OFF: `BEAR_INBOUND_EMAIL_ENABLED`, `BEAR_ENTERPRISE_API_ENABLED`, `BEAR_HOUSEHOLD_ENABLED`, `BEAR_STUDY_ENABLED`, `BEAR_DECISIONS_ENABLED` (enabled in production by the owner), `BEAR_EXECUTION_ENABLED`.

## Design
Frozen. Mama Bear, navy/coral/mustard/teal/cream, liquid glass, existing navigation. The task page already presents "on it / needs you / all sorted" through `LoadPanel` in the app's own words.

## Risks found
Event log failures were silent (fine for history, wrong for execution): fixed in the execution layer. Approvals were a boolean not tied to details: fixed. Forwarded-email confirmations used a narrower phrase list than the decision layer: fixed (`received your payment`). No real integration can execute an outward action today.
