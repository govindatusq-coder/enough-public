# Load Bear 2.0: Coverage Packs, School Admin, Forward-to-Bear, Responsibility

Bear moves from "remind me" towards carrying more of the cognitive work: it understands a school
notice, separates each obligation with its own deadline, prepares the details, groups repeat notices,
records how it knows something is done, and stays quiet otherwise. It never claims to pay, submit,
send, book or watch anything it can't.

## Feature flags
| Flag | Env var | Default |
|---|---|---|
| Coverage Packs + School Admin | `BEAR_COVERAGE_PACKS_ENABLED` | on (set `off` to roll back) |
| Responsibility engine (coverage, anticipation, school ideas, instrumentation) | `BEAR_RESPONSIBILITY_ENGINE_ENABLED` | on |
| Forward-to-Bear (inbound email) | `BEAR_INBOUND_EMAIL_ENABLED` | **off**; must be `on` AND configured |

## Architecture (`lib/bear/coverage/`, `lib/bear/inbound/`)
- `types.ts`: CoveragePack (10 definitions per pack), EvidenceLevel (`confirmed` / `user_confirmed` /
  `inferred` / `unknown`), per-operation responsibility.
- `capabilities.ts`: the capability truth table every claim is checked against.
- `registry.ts`: School Admin is the only `full` pack; Bills, Car, Home, Family, Health are `definition`s.
- `packs/school.ts`: deterministic notice reader → events and obligations (consent, payment, equipment,
  booking, order, medical, reply, costume, materials, homework), each with its own date, amount, reference,
  link, code, method and confidence. Australian dates. Child only when named (or the only child). Several
  events split per event. Instructions inside a notice are flagged and ignored.
- Integration: `bill-extraction.ts` (a school notice is never a bill) → `task-inference.ts`
  (`schoolEntities`) → `load/engine.ts` (forces `SCHOOL_EVENT`, attaches consent/payment loads with their
  own dates) → `load/patterns.ts` (booking, order, reply, costume, homework steps) → `load/view.ts`
  (`prepared`: Bear's preparation).
- `matching.ts`: a repeat notice joins the existing item and only fills gaps; new obligation types join
  the same project; nothing is duplicated.
- `verification.ts` + `completion.ts`: every completion records evidence. Time alone is never
  confirmation; the person's word is `user_confirmed`; a forwarded confirmation email is `confirmed`.
- `responsibility.ts`, `instrumentation.ts`: Responsibility Transferred (internal research only).
- `expectations.ts`: anticipation from the person's own history only (never generic school calendars).
- `coverage-service.ts`: category coverage (on/off), transparency (handling / needs you / can't see),
  school idea candidates for the existing Bear Ideas orchestrator.
- `inbound/*`: signature (Svix scheme, matching the official `standardwebhooks` library), addresses,
  registry (routing + idempotency), Resend client, processing pipeline.

## Forward-to-Bear data flow
1. The person forwards an email to `bear-<token>@<BEAR_INBOUND_DOMAIN>` (token: 128 random bits).
2. Resend receives it (MX on the inbound domain) and POSTs `email.received` (metadata only) to
   `/api/bear/inbound/resend`.
3. The raw body's Svix signature is verified (5-minute tolerance) before anything else.
4. The account is found ONLY from the token in a recipient address on our domain; unknown or revoked
   tokens are ignored without saying why.
5. The message is claimed once (hashed message id) so retries can't duplicate; a failure releases the
   claim so Resend's retry can succeed.
6. The body is fetched from Resend's API; attachments are listed and only PDFs and pictures within limits
   (10 MB each, 5 max, tiny images skipped) are downloaded, from Resend's own HTTPS hosts only.
7. Text and attachments become captures (method `email`) and go through the same extraction, School pack
   and auto-setup as everything else. A confirmation email marks the matching step done with email evidence.
8. Stored: the capture and documents (as for any capture, owner-only RLS, private bucket), a hashed
   message key and status. Not stored or logged: subject/sender/body outside the person's own capture.

## Privacy (Australian Privacy Principles, a starting point, not legal advice)
- **APP 1/5 (transparency, notice)**: Settings explains forwarding; Bear only sees what is forwarded.
- **APP 3 (collection, sensitive information)**: health details are never inferred or filled in; medical
  forms are only identified as needing the person.
- **APP 6 (use)**: content is used only to organise the person's own obligations.
- **APP 8 (cross-border disclosure)**: subprocessors may process data outside Australia. Vercel
  (hosting), Supabase (database and storage, region as configured), Anthropic (reading documents, only
  when the AI service is configured), Resend (receiving email, only when forwarding is on). Their terms
  and data locations must be reviewed and disclosed before switching forwarding on in production.
- **APP 11 (security, retention)**: RLS on every table; service role used only by the webhook and cron;
  routes and message keys cascade on account deletion; "Turn off" deletes the address and message records.
  Idempotency keys are only needed for about a day (Resend's retry window) and can be pruned.
- **APP 12/13 (access, correction)**: everything Bear holds is visible and editable in the app.
- School-system integrations (Compass, Sentral, Seesaw, Operoo...) are NOT built; their terms and
  authorisation requirements must be evaluated first.

## Deployment (Forward-to-Bear), only after explicit approval
1. Apply `supabase/migrations/20261108120000_bear_inbound_email.sql` (rollback SQL is in the file).
2. In Resend: use the `<id>.resend.app` receiving domain or add a receiving domain with its MX record;
   create a webhook for `email.received` pointing at `https://<app>/api/bear/inbound/resend`; copy its
   signing secret. Check Resend's current pricing and limits for receiving first.
3. In Vercel (Preview first): `BEAR_INBOUND_DOMAIN`, `BEAR_INBOUND_SECRET` (the webhook signing secret),
   `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (already used by cron), then `BEAR_INBOUND_EMAIL_ENABLED=on`.
4. Verify end to end on the preview with a real forwarded notice before enabling in production.
