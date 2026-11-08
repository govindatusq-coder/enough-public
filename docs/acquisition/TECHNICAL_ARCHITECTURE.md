# Technical architecture (Phase 0 audit, updated)

- **Stack:** Next.js 16 (App Router, React 19, TypeScript), Supabase (Postgres + RLS, Auth, Storage), Vercel
  (hosting, cron), Anthropic (optional AI reader), Capacitor iPhone shell + native Share Extension.
- **Repository layout:** `app/bear` (consumer UI), `app/api/bear` (consumer API), `app/api/v1` (enterprise API),
  `lib/bear/*` (all logic), `components/bear` (UI), `supabase/migrations`, `tests` (node:test),
  `scripts` (stress fixtures, Playwright walkthrough), `evaluation` (benchmark), `commercial` (model).
  The repository also contains an unrelated product ("Enough"); see KNOWN_LIMITATIONS.md.
- **Layers (consumer app and enterprise API share them):**
  1. Interface: `app/bear`, `components/bear`.
  2. Application services: `lib/bear/services` (capture, auto-setup, completion, reminders, ideas, home...).
  3. Responsibility Engine: `lib/bear/engine` (extract, state, events, duplicates, plan, actions,
     intervention, household, view), built on `lib/bear/load` (Load Pattern Engine: patterns, graphs,
     ownership, minimum human action, closure), `lib/bear/priority` (priority, relational), `lib/bear/strategy`
     (strategic attention, Bear Ideas orchestrator), `lib/bear/coverage` (Coverage Packs, School Admin,
     capabilities, evidence).
  4. Persistence: `lib/bear/store` (BearStore with Supabase and in-memory implementations; JSONB bodies).
  5. External integrations: `lib/bear/ai` (Anthropic), `lib/bear/inbound` (Resend), `lib/bear/server/push.ts`.
  6. Enterprise API: `lib/bear/enterprise` (framework-agnostic handler, tenants, branding, adapters).
- **Determinism:** text understanding, planning, priority and verification are deterministic and testable;
  the AI is used for reading images/PDFs and optional enrichment, wrapped by deterministic validation.
- **Feature flags:** see `lib/bear/flags.ts` and the env vars listed in TRANSITION_PLAN.md.
