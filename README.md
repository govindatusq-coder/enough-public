# ENOUGH public-hosting migration

## Current AI idea pictures

Fresh My Moves AI batches now generate activity-specific lifestyle pictures using the existing server-only OpenAI key. Pictures are privately cached in the existing owner-restricted storage bucket and shared by the card grid and detailed idea browser. Opening cards only reads the cache; explicit retries for missing pictures use the existing daily AI allowance. Approved library artwork and the private real-moment photo gallery remain separate.

See [the 10 October 2026 image verification record](docs/verification/idea-images-2026-10-10.md) for checks, configuration and the outstanding authenticated live-provider test. The migration notes below describe the original migration, not the latest deployment status.

This is a separate Next.js application prepared for Vercel and Supabase. The original Sites checkout and private deployment were not edited or deployed.

## Implemented
- Existing four-tab experience and photo/glass styling retained.
- Email/password registration, confirmation callback, sign-in, recovery and sign-out.
- Google/Apple buttons use actual Supabase provider availability; unavailable providers are disabled.
- Request-scoped Supabase clients and verified server identity. No service-role key.
- Supabase accounts with optimistic revision protection; private photo metadata and storage.
- Row-level access rules restrict accounts/photos to their authenticated owner.
- Five fresh AI batches per UTC day, enforced by a restricted internal database function.
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
7. Native source is preserved for reference and still points to the private preview. Public native app OAuth/deep links, branding, signing, health-data permissions and hardware testing remain unfinished. Do not publish those native builds from this package.
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
