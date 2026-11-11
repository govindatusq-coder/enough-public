# Load Bear runbook

**Where things live:** app on Vercel (project enough-public-zuue, production = `main`); data in Supabase (ref `optzrikdlhhygfxbzlnn`); reminders job in GitHub Actions (`.github/workflows/bear-reminders.yml`).

## Is it healthy?
`curl -H "Authorization: Bearer $BEAR_CRON_SECRET" https://<host>/api/bear/health`
It lists missing config, missing database tables, the last reminder run, reminders overdue and unsent, AI calls/failures and (if you set `BEAR_PRICE_*`) an estimated cost. `problems` should be empty. It returns counts only, never anyone's content.

## Common problems
- **Reminders not arriving:** health shows `problems`? Check GitHub → Actions → "Bear reminders" ran in the last 15 min; check repo variable `BEAR_REMINDERS_ENABLED=true` and secrets `BEAR_APP_URL`, `BEAR_CRON_SECRET`; check Vercel has `SUPABASE_SERVICE_ROLE_KEY` and the VAPID keys. Parents still see reminders on the home screen.
- **Photo/PDF notices unreadable:** check `ANTHROPIC_API_KEY` is set and the account has credit (health shows AI failures). Text keeps working.
- **"Bear hit a snag":** Vercel → Logs, filter `[bear]`. Logs hold errors only, not documents.
- **Parent asks to delete their data:** they can do it in Settings. To remove their sign-in too, delete the user in Supabase → Authentication.

## Deploy / roll back
Preview deploys build from the branch. Production only moves when `main` changes. To roll back: Vercel → Deployments → previous good deployment → Promote. Database migrations are additive; do not drop tables to roll back.

## Backups
Supabase Pro has daily backups; the Free plan has none. **Owner to confirm the plan** (see OWNER_ACTIONS.md).

## Before each release
`npm run verify` (types, lint, 624 tests, two stress suites), `npm run build`, then `npm run verify:browser`.
