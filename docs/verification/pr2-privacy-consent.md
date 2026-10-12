# PR2 — privacy notices and optional OpenAI permission

Fresh ideas and their pictures now require a current, explicit decision saved in the authenticated account. The three options are Use AI ideas, Use AI ideas without my health needs, and Not now. Existing accounts and device previews default to no AI permission; nothing is inferred from using the app or signing in.

## Data and compatibility

Optional `aiConsent` in the existing version-1 account JSON contains `choice`, `version` and ISO `decidedAt`. The existing owner-restricted `enough_save_account` function already writes JSON without a top-level field allowlist; no SQL migration or new service is required. Cloud validation, local restore and exports retain the field. The server reads the authenticated account and ignores any consent object supplied in an idea request. Both the generation helper and HTTP boundary reject missing, declined or stale permission.

Reduced context uses allowlisted non-health choices. Health needs and derived health limits, arbitrary written fields, usual-day activity, outcome records and earlier generated text are excluded. Original needs still apply in server candidate validation and recommendation matching. Images for earlier ideas are not backfilled under reduced permission, because their text may contain health context. Accepted new ideas alone are eligible for those new pictures.

The server rechecks the decision before each new provider call and after the batch. Changing it cannot recall a request already sent, but prevents subsequent calls. Cached images and library browsing remain read-only.

## Notices and settings

`/privacy` is explicitly a draft for legal review. Collection notices appear before email/social sign-in and before first cloud-profile creation. My Pins contains AI and privacy settings. The first explicit request opens a dialog with no preselected option; selecting an enabled option resumes that requested batch only after the account save succeeds. Dismissing or choosing Not now starts no batch. All options use keyboard-operable buttons; the existing Radix dialog supplies focus containment and Escape dismissal. New controls use at least 44-pixel targets, readable text, visible focus, semantic headings and labelled notices.

The draft records current export limitations, distinct sign-in-identity deletion, and unconfirmed public operator/contact and provider-retention arrangements. These require legal/product review before treating the notice as a final public policy.

## Verification

- Frozen dependency install passed, using the unchanged lockfile.
- `pnpm test`: 119 passed, including 11 consent/account/HTTP tests.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed; `/privacy` prerendered successfully.
- `git diff --check`: passed.
- Real-provider requests, signed-in browser journeys and mobile rendering: not run in this environment. Provider/database adapters in the HTTP tests are inert fixtures; no production data or credentials were changed.

Manual follow-up: sign up and inspect the notice; import or create a cloud profile; request suggestions and try each option; inspect reduced-context payloads; change the choice in My Pins; verify reload/export; use Tab/Shift+Tab/Escape and a narrow/zoomed viewport.

## Rollback

Retain optional `aiConsent` parsing in cloud/local validators when reverting UI or generation logic so saved profiles remain readable. Do not strip consent or grant it during rollback. The database schema is unchanged.

## Source checks

- OAIC APP 5 collection-notification guidance: https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-5-app-5-notification-of-the-collection-of-personal-information
- Supabase data/ownership documentation: https://supabase.com/docs/guides/database/tables
- Supabase 25 September 2026 PostgreSQL minor-release note: https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes (extension/index changes do not affect this JSON-only account change).
