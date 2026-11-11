# Load Bear capability matrix

**Verified levels:** `local` = run by me against the in-memory dev store or unit tests; `mocked` = tested with a fake provider/service; `prod` = exercised against the live Vercel + Supabase deployment (earlier in this project, not re-run for the latest changes); `untested` = built but never run for real.

| Promise | How it works | Needs (config) | Evidence | If unavailable |
|---|---|---|---|---|
| Give Bear a school notice (text, screenshot, photo, PDF) | Capture → deterministic school reader (dates, amounts, child, event, what's required) → task with steps and a due date | None for text. Photos/PDF reading need `ANTHROPIC_API_KEY` | `local`: 12 parent-journey tests + browser walkthrough. Photo/PDF reading `mocked` only | Text still works; pictures say they can't be read and ask for text |
| Several things in one notice, several children | Notice is split per child/event | None | `local`: tests | Falls back to one item the parent can edit |
| Updated notice changes the date / duplicate notice | Matches the same event; date changes are applied and noted, conflicts are shown not silently applied | None | `local`: tests | Parent can edit manually |
| "Paid"/"signed" receipts close the right item | Receipt is matched to the open item | None | `local`: tests | Parent taps Done |
| Fill a PDF permission form | AcroForm fields filled from facts the parent confirmed; consent, signature and medical fields are never filled | None | `local`: tests with a real fillable PDF | "Print it and fill it in by hand" |
| Calendar file for an event | Downloads an .ics the parent opens | None | `local` tests; real Apple/Google/Outlook import **untested** | Parent adds it manually |
| Outlook calendar event creation | Built behind `BEAR_CALENDAR_ENABLED` | Microsoft app registration (owner declined for now) | `mocked` only | Feature hidden; .ics download used |
| Draft a reply | Draft opens for the parent to edit and send | None | `local` tests | — |
| Bear never sends, submits, books or pays | No adapter exists that does | — | `local`: execution-layer tests | n/a |
| Bills: read, verify, remind | Bill extraction, parent verifies, due-date reminders | AI key for photo bills | `prod` earlier; `local` now | Manual entry |
| "What needs me now?" home | Home lists what needs the parent, with the calm greeting suppressed while something is waiting | None | `local`: browser audit at 390 and 1280 px | — |
| Reminders in the app | List on the home screen | None | `local`: tests | — |
| Reminders as push notifications | Web push, 15-min GitHub Actions job | `BEAR_CRON_SECRET`, VAPID keys, `SUPABASE_SERVICE_ROLE_KEY`, `bear_job_runs` migration, GitHub secrets/variable | Delivery logic `local` (7 tests: no double send, retries failed sends, finished tasks never remind, link opens the right task). **Real device push untested** | In-app list still shows everything |
| Delete all my data | Settings → Delete everything | `delete_my_data` migration (Supabase) | `local`: 3 tests; real Supabase **untested** until migration applied | Button errors honestly |
| Privacy notice | `/bear/privacy` | Support email env `NEXT_PUBLIC_BEAR_SUPPORT_EMAIL` | Page renders `local`; **text not legally reviewed** | Tells parents to contact whoever invited them |
| Outlook add-in (Give to Bear) | Task pane reads the open email, sends it to capture | Add-in installed by the user | `prod` earlier (user installed it); not re-tested since | Paste the email into Bear |
| Forward emails to Bear | Inbound webhook | `BEAR_INBOUND_EMAIL_ENABLED`, Resend, domain | `local` core tests; **off, untested live** | Hidden |
| Enterprise API, household, study | Built | Flags (all off) | `local` tests | Not shown to parents |
| Health check | `/api/bear/health` (secret-protected, counts only) | `BEAR_CRON_SECRET` | Built; `local` only | — |
| Cost cap | 60 captures per person per day | None | Code only; not unit-tested (route-level) | — |
