# Owner actions (one list)

Only you can do these: they need your accounts or decisions. "App works without it?" says what a parent experiences if you skip it.

| # | Action | Why only you | Enables | Works without it? |
|---|---|---|---|---|
| 1 | In Supabase SQL editor, run migrations from `supabase/migrations` not yet applied: `20261108…inbound_email`, `20261109…responsibility_events`, `20261109…enterprise`, `20261110…study_responses`, `20261111…connected_accounts`, `20261112120000_bear_delete_my_data`, `20261112121000_bear_job_runs` | Your database | Delete-my-data, reminder run records, health check | Core app works; delete button and health check will report missing tables |
| 2 | Vercel env: add `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Settings → API) | Secret | Cron reminders, delete-my-data sign-in removal | In-app reminders only |
| 3 | Vercel env: `BEAR_CRON_SECRET` (any long random string), and the same value as GitHub secret `BEAR_CRON_SECRET`; GitHub secret `BEAR_APP_URL`; GitHub variable `BEAR_REMINDERS_ENABLED=true` | Secrets/accounts | Push reminders every 15 min, health check | In-app reminders only |
| 4 | Vercel env: VAPID keys `BEAR_VAPID_PUBLIC_KEY`, `BEAR_VAPID_PRIVATE_KEY`, `BEAR_VAPID_SUBJECT` | Secret | Push notifications | In-app reminders only |
| 5 | Vercel env: rename `Bear_Model` to `BEAR_MODEL` (names are case-sensitive) | Your Vercel | Chosen AI model is used | Uses the default model |
| 6 | Confirm Supabase plan has backups (Pro) | Billing | Recovery from data loss | Works, but no safety net |
| 7 | Set `NEXT_PUBLIC_BEAR_SUPPORT_EMAIL` | Your address | Privacy page shows a support contact | Page says "contact the person who invited you" |
| 8 | Have the privacy page (`/bear/privacy`) reviewed by someone qualified before any public launch | Legal responsibility | Safe to widen beyond invited parents | Fine for a small invited group who know it's early |
| 9 | Test push on a real phone (install to home screen, allow notifications) | Needs your device | Confirms reminders buzz | Unverified until done |
| 10 | Test the Outlook add-in on your own account after any deploy | Your account | Confirms Give to Bear still works | Paste the email instead |
| 11 | Say "merge it" to release to production | Your decision | Parents get this version | n/a |
| Optional | Microsoft app registration for calendar creation | Your Microsoft tenant | Auto-create Outlook events | Parents download an .ics file instead |
