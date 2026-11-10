# Calendar: what works today and what creating events for real needs

## Works today (no credentials, no integration)
**Add to calendar** on a responsibility that has a date the thing *happens* (school event, appointment, invitation). It downloads a standard `.ics` file. The person opens it and their calendar (iPhone, Mac, Outlook, Google) offers to add it. Bear prepares the file; **Bear does not add anything to a calendar**. The history records `action_prepared` with `sent:false`.
- Only from what the source stated. A deadline (bill, form, consent) is not an event and gets no file.
- No time given means an all-day event. A time given means that clock time (no time zone, so it shows at that time wherever the person is), one hour long, and the description says the length wasn't given.
- Code: `engine/prepare.ts`, `engine/calendar-event.ts`, `services/calendar-file.ts`, `GET /api/bear/tasks/[id]/calendar`. Tests: `tests/bear-calendar-file.test.mjs`.

## Real creation: not built, and why
Creating the event itself means Bear acts in someone's calendar. That needs a connected account and the person's consent, so it is **Implemented: no. Unsupported until configured.** Nothing simulates it.

### Outlook / Microsoft 365 (Microsoft Graph)
- Register an app in Microsoft Entra ID. Delegated permission `Calendars.ReadWrite` (least privileged that can create events).
- Sign-in with the authorisation-code flow and PKCE; store refresh tokens encrypted, per user, revocable and deletable from Settings.
- Create with `POST /me/events` and set **`transactionId`** to Bear's idempotency key. Microsoft documents `transactionId` as the way to avoid duplicates when a client retries after a timeout, which is exactly what the execution layer needs. Verify by reading the event back; check an unknown earlier attempt by looking the event up by the same `transactionId`.
- **Blocker to expect:** a work or school tenant (such as a university) commonly requires administrator consent for apps and may refuse it. A personal Microsoft account does not have that restriction.

### Google Calendar
- OAuth with scope `calendar.events`. This is a sensitive scope, so a public app needs Google's verification before ordinary users can consent. Idempotency: supply a client-generated event `id` so a retry cannot create a second event.

### What the execution layer already provides
Approval bound to the exact details (title, date, time, calendar), idempotency key, an attempt log that must be writable, recovery after a timeout, and "accepted is not confirmed" (an event is confirmed when it can be read back). The remaining work is the adapter, the account connection and consent screen, and token storage.

## What the owner needs to decide
1. Which calendar first: Microsoft (your Outlook) or Google.
2. Register the app (Entra or Google Cloud). The client secret must be added as a secret environment variable by the owner, never pasted into chat or committed.
3. Whether to try a personal account first (no administrator consent) before a work tenant.
