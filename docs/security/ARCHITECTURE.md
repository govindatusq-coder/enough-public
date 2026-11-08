# Security architecture (as implemented)

Scope: the Load Bear product (`/bear`, `/api/bear/*`, `/api/v1/*`). The repository also contains a separate
product ("Enough", `/`, `/api/*` outside `/api/bear` and `/api/v1`) that is out of scope here.

## Components and trust boundaries
| Component | Runs on | Trust | Notes |
|---|---|---|---|
| Web app (Next.js 16) | Vercel | Untrusted client | All authorisation is server-side; the UI is never a security boundary. |
| Consumer API `/api/bear/*` | Vercel functions | Authenticated user session | `withBear` resolves the Supabase session; writes also require a trusted Origin (`trustedWrite`). |
| Enterprise API `/api/v1/*` | Vercel functions | Tenant API key | Off unless `BEAR_ENTERPRISE_API_ENABLED=on`. Keys are SHA-256 hashed at rest. |
| Inbound email webhook `/api/bear/inbound/resend` | Vercel functions | Svix-signed provider | Off unless `BEAR_INBOUND_EMAIL_ENABLED=on` and configured. |
| Cron `/api/bear/cron/reminders` | Vercel cron / GitHub Actions | `BEAR_CRON_SECRET` bearer | Uses the service role only to deliver due reminders. |
| Database | Supabase Postgres | RLS | 22 owner-only `bear_*` tables (`user_id = auth.uid()`, anonymous users excluded); server-only tables for tenants, inbound routing and idempotency have RLS on with no client policies. |
| Documents | Supabase Storage, private bucket `bear-documents` | Owner-only | Object keys are prefixed with the user id. |
| AI reader | Anthropic API | Subprocessor | Only when `ANTHROPIC_API_KEY` is set; used for images/PDFs, task breakdown, cost estimates. |
| iPhone shell | Capacitor + Share Extension | Device | Loads the live site; the share extension writes to an App Group inbox. |

## Key controls
- **Per-user isolation:** every consumer request uses a request-scoped Supabase client under the user's JWT;
  every row has `user_id` and RLS. The store abstraction never accepts a user id from the client.
- **Service role usage is narrow:** cron delivery, the inbound webhook (after signature verification and
  token routing), and the enterprise API (after key verification and tenant-scoped member lookup).
- **Tenant isolation (enterprise):** a request acts only for a member resolved through
  `(tenant_id, external_id)`; the per-user store is created from that member's user id, so another tenant's
  data is unreachable by construction (tested: `tests/bear-enterprise-api.test.mjs`).
- **Capability honesty:** the action registry (`lib/bear/engine/actions.ts`) and capability table
  (`lib/bear/coverage/capabilities.ts`) gate every claimed action; approval is enforced in the engine.
- **Evidence-gated verification:** a responsibility becomes "verified" only with a verification method;
  reminders, drafts, deadlines and model output are never evidence (`lib/bear/engine/state.ts`).
- **Untrusted content:** documents and emails are data. Injection phrases are detected and ignored by the
  deterministic readers; the AI reader's system prompt states the content is untrusted.
- **Append-only history:** `bear_responsibility_events` grants owners select/insert only.
