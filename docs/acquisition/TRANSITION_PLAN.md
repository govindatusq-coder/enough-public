# Transition plan (operating without the founder)

**Deploy:** push to `main` deploys to Vercel production; branch `claude/keen-lamport-xfglo3` builds previews
(`vercel.json` ignoreCommand). Promote/rollback in Vercel → Deployments.

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (optional), `BEAR_MODEL` (optional), `BEAR_CRON_SECRET`,
`BEAR_VAPID_PUBLIC_KEY`/private key (push), and flags: `BEAR_PRIORITY_ENGINE_V1/V2`, `BEAR_STRATEGIC_ATTENTION_V1`,
`BEAR_MENTAL_LOAD_V1`, `BEAR_IDEAS_V2`, `BEAR_RELATIONAL_V1`, `BEAR_PTM_V1`, `BEAR_COVERAGE_PACKS_ENABLED`,
`BEAR_RESPONSIBILITY_ENGINE_ENABLED` (on unless `off`); `BEAR_INBOUND_EMAIL_ENABLED`, `BEAR_ENTERPRISE_API_ENABLED`,
`BEAR_HOUSEHOLD_ENABLED` (off unless `on`); inbound: `BEAR_INBOUND_DOMAIN`, `BEAR_INBOUND_SECRET`, `RESEND_API_KEY`;
`BEAR_API_RATE_LIMIT`.

**Database migrations:** `supabase/migrations/*.sql`, applied in order with the Supabase CLI or SQL editor.
All Load Bear 2.0 migrations are additive with rollback SQL in a comment at the top of each file.

**Testing:** `npm test` (node:test, 500+ tests), `npm run typecheck`, `npm run lint`,
`node scripts/priority-stress.mjs`, `node scripts/load-stress.mjs`, `npx next build` then
`BEAR_TEST_MODE=start node scripts/test-bear-browser.mjs` (Playwright walkthrough), `node evaluation/run.mjs`.

**Model configuration:** `BEAR_MODEL` selects the Anthropic model; without a key the app runs rules-only.

**Monitoring and incidents:** see docs/security/INCIDENT_RESPONSE.md (monitoring is a gap).

**Support:** in-app copy is self-explanatory; no support tooling yet.

**Ownership moves needed (with authorisation):** GitHub repository, Vercel project, Supabase project,
Apple Developer app record, Anthropic and Resend accounts, domain names. Do not rotate production
credentials without the owner's explicit authorisation.
