# Engineering hygiene - roadmap PR 1

## Goal and changes

Add repeatable checks and browser security headers to the existing ENOUGH app. No dependency, service, account schema, database migration, AI prompt, stored outcome or visible screen copy is changed.

- Ignore web dependencies, build output, local environment files, Supabase temporary files and native generated output. Keep `.env.example` trackable. `tsconfig.tsbuildinfo` was already untracked at the baseline commit; it is now ignored.
- Use the installed Next.js core-web-vitals and TypeScript ESLint flat configurations. Record existing findings in `eslint-baseline.json`; `pnpm lint` rejects new or changed warnings and errors, duplicate findings and parser failures. `pnpm lint:report` shows the full outstanding debt and currently exits non-zero. Rules remain enabled.
- Run frozen-lockfile installation, tests, TypeScript, the lint gate, production build and production-response security checks on pull requests and main pushes. The workflow uses Node 22, pnpm 11.25.0 and verified action commit SHAs, read-only repository permission and non-secret test configuration. It has no production deploy step and receives no provider or Supabase credentials.
- Set CSP, Referrer-Policy, Permissions-Policy, nosniff and frame denial globally through `next.config.ts`. Generate a cryptographically random 128-bit script nonce for each proxied response, replace incoming nonce/policy headers, forward the trusted policy to Next rendering and preserve the existing Supabase session-refresh/cookie flow. Apply security headers after session refresh can recreate the response.
- Render HTML dynamically with no shared caching so every document receives fresh matching script nonces. Public HTML rendering does not add a Supabase authentication call; the original API/auth/sign-in refresh routes retain it.

## Policy compatibility

Production scripts allow first-party scripts and nonce-authorised Next runtime scripts with strict-dynamic. Inline script execution and eval are prohibited. Development alone permits eval and its WebSocket connection.

Browser connections allow only the app origin and the configured exact Supabase origin. OpenAI and Openverse API calls are server-side and are not added to browser connect-src. AI pictures and private uploads are served through first-party authenticated API routes. Images permit the existing four library photo hosts, data URLs for name QR codes and blob URLs for private upload previews. Existing Google Fonts remain allowed until roadmap PR 9. Inline styles remain allowed for the existing artwork, charts and Base UI attributes.

Camera and accelerometer/gyroscope/magnetometer access is limited to the app origin. Other listed browser capabilities are denied, including microphone, location, payments, clipboard access, autoplay and screen capture. The QR preview is muted and starts from the user's Scan button; actual device permission and playback behaviour still needs the manual check below.

Dynamic HTML replaces static CDN rendering. This adds per-request server rendering and can increase latency and function usage. No new service or package is introduced.

## Automated verification

- Frozen-lockfile installation completed offline with the existing dependencies; no lockfile change.
- All 114 unit tests passed locally on Node 24.19.0, including the six new security/lint tests and all prior account, suggestion, image, recommendation, onboarding, QR and movement tests. The workflow runs the same suite on Node 22; its remote result must be checked separately.
- TypeScript and the production build passed.
- Lint gate passed with the 72 reviewed pre-existing findings listed below and no new findings. Tests verify that changing the file, source, rule or severity, adding a duplicate, or introducing a parser failure cannot reuse a baseline exemption.
- `pnpm check:security` passed against the actual production build: unique nonces on the landing/sign-in/recovery/password pages; matching nonces on every rendered script; replacement of untrusted caller headers; no-store HTML; one enforced policy; auth callback redirects remaining first-party; anonymous account responses containing no profile; photo/idea routes refusing anonymous access; and security headers on static images.
- `git diff --check` passed. Ignore rules were checked for environment files, web/native output and Supabase temporary files.

The production-response check uses non-secret Supabase placeholders and removes the OpenAI key from its child server environment. It does not log in, create a real account, request a model, upload a photo, read health data or invent an outcome.

## Live checks still required before release

The preceding movement fix is merged at `b6efb9d`, but its production Vercel check reports failure. The Vercel connector returns a team-scope 403 for `govindatusq-5192`; the authorised dashboard navigation timed out. Neither provides build logs in this session. Do not describe that fix as live or guess the failure cause.

On the PR preview, verify:

1. Email sign-in, Google redirect sign-in/callback and session refresh; private account requests must remain authenticated and uncached.
2. Discovery and the one-at-a-time suggestions page, keyboard focus and controls, and loaded library/AI pictures. Check the console for CSP violations.
3. An explicit suggestion request and its images with the user's existing provider connection and consent; browsing alone must generate neither.
4. A private photo preview/upload/view using an authorised test entry; blob previews and first-party downloads must work.
5. Scan a voluntary test-name QR on a device after granting camera access, and test QR-file decoding and the manual-name fallback. Test live motion on a supported phone. Health platform testing remains a native-device task.

These authenticated, model, upload and hardware checks are not claimed as completed by the placeholder-based response test. No visible UI was redesigned, but the script/camera policy requires these functional checks before a WCAG or full browser compatibility claim.

## Secret scanning and repository visibility

GitHub's current documentation says public repositories receive automatic secret scanning. Review repository Security alerts. The current controls are Settings > Advanced Security > Secret Protection > Enable; enable push protection where available. Verify the actual repository settings with an administrator rather than assuming the controls have been changed by this PR.

Keep the source private during development unless you intend to publish it. Source visibility does not replace owner RLS, private storage or server-only credentials. Making a repository private does not revoke an exposed key; any confirmed exposed key must be rotated and its history reviewed. No credential exposure was found or assumed by this change, and repository visibility/security settings are not modified here.

Reference: https://docs.github.com/en/code-security/how-tos/secure-your-secrets/detect-secret-leaks/enable-secret-scanning

## Rollback

Revert this PR as a unit and redeploy the chosen known-good commit. The nonce proxy, dynamic layout and configuration headers must be reverted together to avoid a nonce/header mismatch. There is no data migration to reverse. Existing local previews, saved accounts, generated ideas, photos and confirmed outcomes remain in their existing formats.

If a compatibility issue is found before merge, keep the PR unmerged and adjust the exact required source or capability with a regression check. Review changes to the lint baseline explicitly; do not automatically re-baseline a newly introduced finding.

## Existing lint findings

The baseline contains 34 errors and 38 warnings, each identified by file, rule, severity, reported line and a hash of the affected source. It is a record of existing debt, not a clean full-repository lint result.

| File | Rule | Errors | Warnings |
|---|---|---:|---:|
| `app/page.tsx` | `@next/next/no-html-link-for-pages` | 2 | 0 |
| `app/page.tsx` | `@next/next/no-img-element` | 0 | 2 |
| `app/page.tsx` | `@typescript-eslint/no-explicit-any` | 2 | 0 |
| `app/page.tsx` | `@typescript-eslint/no-unused-vars` | 0 | 4 |
| `app/page.tsx` | `react-hooks/exhaustive-deps` | 0 | 3 |
| `app/page.tsx` | `react-hooks/immutability` | 1 | 0 |
| `app/page.tsx` | `react-hooks/purity` | 1 | 0 |
| `app/page.tsx` | `react-hooks/set-state-in-effect` | 6 | 0 |
| `app/signin/page.tsx` | `@next/next/no-html-link-for-pages` | 2 | 0 |
| `app/signin/page.tsx` | `@next/next/no-location-assign-relative-destination` | 0 | 2 |
| `app/signin/page.tsx` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `app/signout/page.tsx` | `@next/next/no-html-link-for-pages` | 1 | 0 |
| `app/signout/page.tsx` | `@next/next/no-location-assign-relative-destination` | 0 | 1 |
| `app/update-password/page.tsx` | `@next/next/no-location-assign-relative-destination` | 0 | 1 |
| `components/activity-movement.tsx` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `components/activity-movement.tsx` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `components/discovery.tsx` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `components/enough-widgets.tsx` | `@next/next/no-img-element` | 0 | 1 |
| `components/health-panel.tsx` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `components/health-panel.tsx` | `react-hooks/set-state-in-effect` | 2 | 0 |
| `components/idea-photo.tsx` | `@next/next/no-img-element` | 0 | 2 |
| `components/idea-photo.tsx` | `react-hooks/exhaustive-deps` | 0 | 2 |
| `components/meeting-checkin.tsx` | `@next/next/no-img-element` | 0 | 1 |
| `components/meeting-checkin.tsx` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `components/movement-panel.tsx` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `components/moves-discovery.tsx` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `components/reading-settings.tsx` | `react-hooks/set-state-in-effect` | 2 | 0 |
| `components/ui/carousel.tsx` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `components/ui/combobox.tsx` | `@typescript-eslint/no-unused-vars` | 0 | 1 |
| `components/welcome.tsx` | `@next/next/no-html-link-for-pages` | 2 | 0 |
| `components/welcome.tsx` | `@next/next/no-img-element` | 0 | 4 |
| `components/wins-gallery.tsx` | `@next/next/no-img-element` | 0 | 4 |
| `components/wins-gallery.tsx` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `components/wins-gallery.tsx` | `react-hooks/set-state-in-effect` | 2 | 0 |
| `hooks/use-cloud-account.ts` | `react-hooks/exhaustive-deps` | 0 | 2 |
| `hooks/use-cloud-account.ts` | `react-hooks/refs` | 2 | 0 |
| `hooks/use-cloud-account.ts` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `hooks/use-mobile.ts` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `hooks/use-suggestion-history.ts` | `react-hooks/exhaustive-deps` | 0 | 1 |
| `hooks/use-suggestion-history.ts` | `react-hooks/refs` | 1 | 0 |
| `hooks/use-suggestion-history.ts` | `react-hooks/set-state-in-effect` | 1 | 0 |
| `lib/journey.ts` | `@typescript-eslint/no-unused-vars` | 0 | 1 |
| `tests/recommendations.test.mjs` | `@typescript-eslint/no-unused-vars` | 0 | 1 |
