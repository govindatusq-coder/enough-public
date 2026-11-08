# Data flows (as implemented)

1. **Capture (app):** text / voice transcript (on-device recognition) / photo / screenshot / PDF / share sheet →
   `POST /api/bear/captures` → stored as a capture (+ document in the private bucket) → extraction
   (rules always; Anthropic only for images/PDFs or when configured) → auto-setup (task, project, load graph,
   reminder plan) → responsibility events. Bills always go to the "Have I got this right?" check.
2. **Forward-to-Bear (off by default):** sender → Resend (receiving) → signed `email.received` webhook (metadata)
   → signature verified → account from the address token → message key claimed (hashed) → body and allowed
   attachments fetched from Resend's API → same capture pipeline → confirmation emails recorded as evidence.
3. **Reminders:** planned in the app; delivered in-app, as local notifications, and by Web Push via cron.
4. **Enterprise API (off by default):** tenant platform → `/api/v1/*` with an API key → tenant member lookup →
   the member's own store. Employer reporting returns coarse aggregates, suppressed below 10 members.
5. **Research export (opt-in):** pseudonymous counts only, via `lib/bear/engine/research-export.ts`.

## What leaves Load Bear
| Data | Recipient | When |
|---|---|---|
| Captured images/PDFs and text being read | Anthropic | Only if `ANTHROPIC_API_KEY` is configured |
| Forwarded emails | Resend (as the receiving service) | Only if forwarding is enabled |
| Push payloads (short reminder text) | The browser/OS push service | If push is configured |
| Everything stored | Supabase (database, storage), Vercel (hosting, logs) | Always |

No data is sold or shared with employers. Employer-facing reporting contains no individual data.
Data locations (regions) depend on project configuration and must be confirmed for disclosure (APP 8).
