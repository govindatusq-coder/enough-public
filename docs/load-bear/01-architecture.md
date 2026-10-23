# Load Bear — technical architecture

## Stack decision

The brief prefers React Native / Expo. This repository is an existing
Next.js 16 + Supabase application with working email/password and OAuth
authentication, row-level security, a Sydney Supabase project, a Capacitor
shell (`native/`) and a SwiftUI shell (`ios/`). The build environment for
this work has no iOS simulator, so an Expo app could not be compiled, run,
or tested here; a Next.js app can be built, type-checked, unit-tested and
driven in Chromium.

Decision: **Load Bear is built as an iOS-first, installable mobile web app
(PWA) inside this repository, mounted at `/bear`**, sharing the existing
Supabase project, auth and security headers. The Capacitor shell in
`native/` is the route to App Store packaging later; everything under
`/bear` is written to run inside a WebView with safe-area insets and no
hover-only interactions. Android support comes for free.

The brief's requirements are otherwise met as written: TypeScript end to
end, Supabase/Postgres with RLS, server-side AI behind interfaces, structured
outputs, secure private storage, push + in-app notification architecture,
background-safe reminder scheduling, image ingestion.

## Layers

```
app/bear/**            Screens (App Router, client components for the
                       interactive surfaces, server redirects for routing)
components/bear/**     Brand + UI components (Mama Bear SVG, glass, nav,
                       capture sheet, Bear-thinking, cards)
app/api/bear/**        HTTP edge of the product. Thin: auth → validate
                       (zod) → call a service → JSON
lib/bear/services/**   The eleven services named in the brief. Pure TS,
                       no Next imports, testable under node --test
lib/bear/ai/**         Model-provider interface + Anthropic implementation
                       + rule-based extractor + fake provider for tests
lib/bear/store/**      Persistence interface (BearStore) + Supabase and
                       in-memory implementations
lib/bear/domain/**     Entity types, copy, dates, money
supabase/migrations/   `20261023120000_load_bear.sql`
public/bear/           Service worker, manifest icons
tests/bear-*.test.mjs  Vertical-slice and edge-case tests
```

### Services (brief §36)

| Service                      | Responsibility                                                    |
|------------------------------|-------------------------------------------------------------------|
| CaptureService               | Accepts text / image / document; stores SourceDocument; routes    |
| DocumentExtractionService    | Turns a source into text + candidate fields (rule-based + model)  |
| BillExtractionService        | Produces the structured bill output with per-field confidence     |
| TaskInferenceService         | Bill → Area / Project / Task / Resource                           |
| DependencyPlanningService    | Adds only the dependencies the bill warrants                      |
| CapacityModelService         | Life Rhythm + capacity answers + behaviour → capacity windows     |
| ReminderPlanningService      | Recommends a reminder plan protecting the deadline                |
| NotificationDecisionService  | The eight questions before any optional notification             |
| SuggestionService            | Bear Ideas for bills; "Not relevant" trains it                    |
| BehaviourLearningService     | Records BehaviourEvents, derives preferred windows & corrections  |
| ValueLedgerService           | Defensible Wealth entries only; Health/Happiness hooks            |
| CompletionService            | Mark paid → Completion, Win, ledger, recurrence expectation       |
| CoordinationEngine           | Scores candidate plans (Nash-inspired burden/complete trade-off)  |

Each service is a plain module exporting functions that take a `BearStore`
and typed inputs. No service imports another service's internals; they share
only `domain/` types.

### Persistence

`BearStore` is a narrow interface (`get`, `list`, `insert`, `update`,
`remove`, `putFile`, `getFileUrl`) over named tables. Each `bear_*` table has
real indexed columns for everything the app filters or sorts on, plus a
`body jsonb` holding the full typed entity (including AI provenance:
`value / source / confidence / userVerified / lastUpdated` per field).
Two implementations:

* `SupabaseStore` — request-scoped Supabase client; RLS makes every query
  owner-only. Files go to the private `bear-documents` bucket under
  `<user_id>/<document_id>`.
* `MemoryStore` — in-process maps, used by tests and by the services'
  unit tests. It is never used to serve the app.

### AI

`StructuredModelProvider` interface: `extract({schema, system, text,
images}) → {output, raw, model, provider}`. Implementations:

* `AnthropicProvider` — `@anthropic-ai/sdk`, `messages.parse` with
  `output_config.format` (JSON schema), vision input for images and PDFs,
  `claude-opus-5-5` by default (`BEAR_MODEL` overrides).
* `RuleBasedExtractor` — deterministic regex extraction for AUD amounts,
  Australian dates, BPAY codes, known billers, service periods. Always runs
  on text; used as the sole extractor when no model key is configured and
  as a cross-check otherwise (disagreement lowers confidence).
* `FakeProvider` — fixtures for tests.

The server never sends the client the API key. When no key is configured,
image/PDF capture is **visibly marked unavailable** in the capture sheet;
text and manual entry keep working through the rule-based extractor.

### Notifications

* Reminders are rows with `scheduled_for`, `status` and a `plan`.
* In-app: `GET /api/bear/home` runs NotificationDecisionService and returns
  reminders that are due as "Needs you" items; the client shows a local
  notification through the service worker when permission is granted.
* Push: Web Push (VAPID) subscriptions stored in `bear_push_subscriptions`;
  `GET /api/bear/cron/reminders` (secured by `BEAR_CRON_SECRET`) delivers due
  reminders. Scheduled by Vercel cron hourly; a GitHub Actions workflow can
  run it every 15 minutes if the Vercel plan limits cron frequency.
* Chaos mode suppresses non-essential reminders inside the decision service,
  not by deleting them.

### Security

* All `bear_*` tables: RLS owner-only, anon revoked.
* Storage bucket private, per-user folder policy, 10 MB, images + PDF only.
* API routes require a signed-in non-anonymous user; writes require same
  origin or a bearer token (existing `trustedWrite`).
* Zod validation on every request body; size caps.
* No bank credentials, card numbers or CVVs are ever modelled or stored.
  BPAY biller code / reference and a payment URL are the only payment data,
  and the URL is only kept when it is `https:` and on the biller's domain or
  a known Australian payment host.
* AI output is validated against the schema; invalid output is treated as
  AI failure, never silently coerced.
