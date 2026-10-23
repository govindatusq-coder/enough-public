# ENOUGH public-hosting migration

## Privacy and AI permission

Fresh OpenAI ideas and pictures require an explicit, versioned account choice. My Pins → AI and privacy offers full context, approved non-health context, or Not now. Legacy accounts and previews have no automatic permission. Reduced context still uses all needs for ENOUGH’s own fit checks. Collection notices appear at sign-in and before the first cloud save; `/privacy` is a draft for legal review. See [PR2 verification](docs/verification/pr2-privacy-consent.md).

## Continuous suggestions

My Moves keeps offering **More suggestions** whenever the user asks. There is no daily batch cap. A private, expiring per-account reservation prevents simultaneous AI requests, and is released on success or failure. Every batch is archived before the response; earlier ideas are browsable in cursor-based pages rather than disappearing after 100 suggestions. Cloud snapshots retain the latest 100 ideas plus every bookmarked, planned, completed or cost-referenced idea. Newly requested suggestions appear first. Existing PINS eligibility checks still apply; an entirely duplicate or ineligible batch gets at most one retry without loosening those boundaries.

The follow-up migration is `supabase/migrations/20261011045017_continuous_suggestions.sql`. Applied to the existing project as migration `20261011045017`; do not apply it again. It preserves existing suggestions, retains account revision checks and owner isolation, and updates the legacy daily-slot function for deployment compatibility. `schema.sql` records the original migrations only.

## Current AI idea pictures

Requesting My Moves suggestions generates activity-specific lifestyle pictures using the existing server-only OpenAI key. New ideas take priority; spare batch capacity fills missing pictures for earlier eligible suggestions, including when there are no new candidates. Pictures are privately cached in the existing owner-restricted storage bucket and shared by cards and details. There are no separate picture buttons or per-picture batch notices. Opening cards only reads the cache; generation happens only within the user-requested suggestion batch. Approved library artwork and the private real-moment photo gallery remain separate.

See [the 11 October 2026 suggestion-picture verification record](docs/verification/suggestion-pictures-2026-10-11.md) for the current flow and checks. The [10 October image verification record](docs/verification/idea-images-2026-10-10.md) records the original image implementation and real-provider verification. The migration notes below describe the original migration, not the latest deployment status.

This is a separate Next.js application prepared for Vercel and Supabase. The original Sites checkout and private deployment were not edited or deployed.

## iPhone app

`ios/Enough` is a native SwiftUI app built from this website: the same four tabs, setup, idea library, matching rules, support plans, wins and privacy copy, plus Apple Health, local reminders, private photos and QR check-ins. It signs in with the same Supabase project and saves through the website's `/api/account`, `/api/photos`, `/api/ideas` and `/api/idea-image` routes using a bearer token. Those routes now accept `Authorization: Bearer <access token>` in place of the browser cookie (`lib/public-auth.ts`, `lib/supabase/server.ts`); bearer requests skip the same-origin check because browsers never attach that header automatically. Deploy this branch before expecting the app's account features to work. See [ios/README.md](ios/README.md) for configuration and limits.

## Implemented
- Existing four-tab experience and photo/glass styling retained.
- Email/password registration, confirmation callback, sign-in, recovery and sign-out.
- Google/Apple buttons use actual Supabase provider availability; unavailable providers are disabled.
- Request-scoped Supabase clients and verified server identity. No service-role key.
- Supabase accounts with optimistic revision protection; private photo metadata and storage.
- Row-level access rules restrict accounts/photos to their authenticated owner.
- User-requested AI batches with a private single-request guard, no daily cap, and persistent paged suggestion history.
- Existing manual outcomes, PINS, routines, QR check-ins, plans, receipts and region/currency logic retained.

## Provisioned Supabase project
Project: optzrikdlhhygfxbzlnn (Sydney).
Remote migrations applied: 20261005060321 enough_public_accounts; 20261005060506 enough_quota_defense_policy.
schema.sql records their combined definition. Do not apply it again to this project.
No private-preview user records or photos have been copied into Supabase. Identities are not linked by email. Existing users should retain the private preview; a controlled export/import and photo migration remains to be implemented.

## Verification
- Frozen dependency install passes.
- Production Next.js build and TypeScript passed.
- 35 automated journey/auth-helper tests passed.
- Transactional database assertions passed for two-user isolation, cross-owner read/write denial, stale create rejection, revision updates and sixth AI batch denial. Temporary fixtures were rolled back.
- Supabase security advisor returned no findings after the quota defense policy.
- Browser process could not start in this execution environment. Visual, browser end-to-end, real-device and unaided-user tests are NOT_RUN.
- Email delivery, confirmation, recovery and social-login end-to-end tests are NOT_RUN.

## Launch gates still open
1. Authorise Vercel CLI, link the correct account/team/project, set production and preview environment variables, deploy and inspect the READY result.
2. Set the final public URL and exact /auth/callback redirect in Supabase Auth. Recovery uses /auth/callback?next=%2Fupdate-password. Add exact development/preview redirects only as needed.
3. Configure production SMTP; email is enabled and confirmation required, but production delivery has not been configured or verified.
4. Configure Google OAuth client/secret and Apple Services ID/key/client secret in Supabase. Observed settings currently show both disabled.
5. Add OPENAI_API_KEY securely to server-only Vercel environment variables. Never paste keys in chat or expose them through NEXT_PUBLIC.
6. Run the full browser, device and unaided-user test pack before public launch. Check sign-in refresh, per-user isolation, uploads, deletion, gallery swipes, onboarding, saved/accepted moves and AI fallbacks.
7. A native SwiftUI iPhone app now lives in `ios/` (see [ios/README.md](ios/README.md)). It bundles the website's screens, library and matching rules and saves through the same account API with a bearer token. It has not yet been built in Xcode or tested on a device; signing, the HealthKit permission cases, reviewer accounts and store declarations remain to be done. The older Capacitor shell in `native/` is kept for reference only.
8. Public imagery now returns licensed Openverse image URLs with attribution instead of using Sites-owned image caching. External image loading requires browser QA.

## Local use
Use Node 22.13+ and pnpm 11.25.0.
Copy .env.example to .env.local, set the supplied public Supabase URL/key, then:
    pnpm install --frozen-lockfile
    pnpm test
    pnpm build
    pnpm start --hostname 127.0.0.1
Vercel can run the normal pnpm build command. vercel.json selects Next.js and Sydney functions. AI generation remains unavailable until its server-only key is set.

## Privacy
Keep profile exports, authentication cookies, native signing files, .env.local, .vercel and credentials out of uploaded source. The saved package excludes them. No public deployment has been created yet.
