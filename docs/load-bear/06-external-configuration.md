# External credentials and platform configuration

Nothing below is available inside the build environment, so these items are
configuration gates, not code gaps. Each is surfaced honestly in the app
(feature visibly unavailable) until configured.

| Item | Where | Effect when missing |
|------|-------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel env (already used by ENOUGH) | App cannot sign in or persist |
| Apply `supabase/migrations/20261023120000_load_bear.sql` | Supabase project `optzrikdlhhygfxbzlnn` | All `/api/bear/*` routes return 503 "Bear's memory isn't connected yet" |
| `ANTHROPIC_API_KEY` (server-only), optional `BEAR_MODEL` | Vercel env | Photo / screenshot / PDF capture is marked unavailable; text and manual entry still work via the rule-based extractor |
| `BEAR_VAPID_PUBLIC_KEY`, `BEAR_VAPID_PRIVATE_KEY`, `BEAR_VAPID_SUBJECT` (`mailto:`) | Vercel env; generate with `npx web-push generate-vapid-keys` | Push toggle in Me shows "not connected"; in-app and local notifications still work |
| `BEAR_CRON_SECRET` | Vercel env + Vercel cron / GitHub Actions secret | Cron route refuses; reminders still surface in-app when the app opens |
| Supabase Auth redirect `https://<host>/auth/callback` with `next=/bear` | Supabase Auth settings | Email confirmation links land on ENOUGH's default page |
| App icons / splash for store packaging | `native/` Capacitor shell | Web install still works via manifest |
