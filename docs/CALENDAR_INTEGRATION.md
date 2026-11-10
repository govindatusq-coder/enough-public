# Outlook calendar

## Status (exact)
| Part | Status |
|---|---|
| Add to calendar (a `.ics` file the person opens) | Implemented and connected |
| Connect Outlook, approve, create an all-day event, verify it | **Implemented, awaiting configuration. Not yet verified against the real Microsoft service.** It is tested end to end over HTTP against a local stand-in for Microsoft (`tests/support/fake-microsoft.mjs`), which enforces PKCE, the client secret, expiring tokens and `transactionId` de-duplication. The first real sign-in is the first real test |
| Events with a time | Not created (a wrong time zone could silently move an appointment); they stay a file the person opens |

Off unless `BEAR_CALENDAR_ENABLED=on` and every setting below is present. With it off, the app looks exactly as before.

## What it does
1. Settings shows **Outlook calendar → Connect**. The person signs in to Microsoft and allows it (`Calendars.ReadWrite`, `offline_access`).
2. On a task with an event date, **Add to my Outlook calendar** shows exactly what will be added (title, date, "all day", where) and asks.
3. Only after **Add it** does Bear create the event, with a `transactionId` so a retry can never create a second one, then reads it back. "Added, I checked it's there" appears only when Microsoft confirmed it exists.
4. **Disconnect** deletes Bear's stored tokens. The person can also remove access in their Microsoft account.

Bear never reads or changes other events. The permission Microsoft calls "read and write" is the least that can create events; Bear's code only creates one event and reads that same event back.

## Safety
Approval is bound to the exact event (a changed date needs a fresh approval). The event is rebuilt from the saved task on the server, never from the browser. Tokens are stored encrypted (AES-256-GCM, key in `BEAR_TOKEN_KEY`, bound to the person's id) so a database leak alone gives nothing usable. The sign-in return is checked against a one-time state in an httpOnly cookie, and the client secret never reaches the browser. A lost reply is safe to retry (Graph returns the same event for the same `transactionId`). See `docs/EXECUTION_AND_APPROVAL_SECURITY.md`.

## Owner setup (about 10 minutes)
1. **Supabase:** run `supabase/migrations/20261111120000_bear_connected_accounts.sql` in the SQL editor.
2. **Register the app** at entra.microsoft.com → Identity → Applications → App registrations → New registration.
   - Name: Load Bear.
   - Supported account types: "Accounts in any organizational directory and personal Microsoft accounts". (Try a personal Outlook account first. A work or school tenant such as a university often needs an administrator to approve the app.)
   - Redirect URI: platform **Web**, exactly `https://enough-public-zuue.vercel.app/api/bear/calendar/callback`.
3. **API permissions** → Add a permission → Microsoft Graph → Delegated: `Calendars.ReadWrite` and `offline_access`.
4. **Certificates & secrets** → New client secret. Copy the *Value* immediately (it is shown once).
5. **Vercel → Settings → Environment Variables** (Production), then redeploy:
   - `BEAR_CALENDAR_ENABLED` = `on`
   - `BEAR_MS_CLIENT_ID` = the Application (client) ID (not a secret)
   - `BEAR_MS_CLIENT_SECRET` = the secret value (secret: never paste it in chat)
   - `BEAR_TOKEN_KEY` = 32 random bytes in base64, made with `openssl rand -base64 32` (secret; if it is ever lost or changed, people simply reconnect)
   - `BEAR_MS_TENANT` = optional (`common` by default; `consumers` for personal accounts only)
6. Open **Settings** in Load Bear in a browser. **Connect Outlook calendar** should appear.

## Known limits
- The Capacitor iPhone app embeds a web view; Microsoft sign-in inside an embedded view is unverified. Connect once in Safari or on a computer. The connection belongs to the account, so it then works everywhere.
- Timed events, other calendars (Google), reading availability and updating or deleting events are not built.
- A university tenant may refuse the app until an administrator approves it.
