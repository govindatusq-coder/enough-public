# My Moves AI idea pictures — 10 October 2026

## Finding and change

Previously, `/api/idea-image` searched Openverse for stock photos, including for AI ideas, and My Moves cards displayed generic onboarding artwork. It did not generate a new picture for each new AI idea.

Fresh `/api/ideas` batches now prepare a warm lifestyle illustration for each validated idea (at most ten per batch). The prompt describes the actual movement, indoor/outdoor setting, pace and safety rather than the sedentary alternative. It explicitly distinguishes seated movement, stairs and running. It sends the displayed scene fields only, not the full profile, identity records, location records, raw health readings or uploaded photos.

Both the My Moves cards and detailed idea browser use that same picture and label it “AI-generated illustration”. Failed generation or downloads leave the usable text idea in place with an explicit retry. Existing AI ideas without a cached picture offer a manual retry; merely opening an older idea does not incur a generation charge.

## Access, persistence and cost controls

- The existing server-only `OPENAI_API_KEY` is used. No new key was created, copied into source, extracted into the test environment or exposed to the client.
- Images and atomic pending reservations use flat keys in the authenticated owner's folder in the existing private `enough-photos` bucket. INSERT, SELECT and DELETE suffice; no upsert, UPDATE policy, schema migration or service-role key is required.
- Scene-version hashes invalidate changed activities. Concurrent requests normally share a reservation; stale reservations recover after four minutes. Reopening a card or reloading the app uses the persistent private cache.
- Automatic generation belongs to the existing quota-checked idea batch. Image GETs never call the image model. Explicit retries for missing pictures also use `enough_take_ai_slot`; cached retries do not consume another slot. The existing five-batches-per-UTC-day rule is unchanged. Up to five provider requests run concurrently within a batch.
- Illustrations do not create `enough_photos` gallery rows or fictional wins. Existing account deletion already removes all objects in the owner folder, including these pictures.
- The client waits for cloud-save acknowledgement before requesting a private picture. Signed-out/local profiles do not request private AI images.

## Configuration

`OPENAI_IMAGE_MODEL` optionally selects a supported GPT Image model; the default is `gpt-image-2.5-sunburst`. The Images API request asks for one 1536×1024 low-quality JPEG with compression 80. Results must be JPEGs within the existing 2 MiB bucket limit. Provider calls time out after 90 seconds; idea-text calls retain their existing 60-second timeout. The idea-batch function duration is 300 seconds and the explicit-image-retry function duration is 180 seconds.

No dependencies or lockfiles were changed. No Supabase access restrictions, authentication, currency logic, outcomes, onboarding, homepage wording or approved favicon assets were changed.

## Checks actually passed

- `npm test`: **84 passed, 0 failed**, including 20 image-specific tests for exact scene prompts, cache identity, concurrency, stale reservations, provider errors, account isolation, same-origin writes, JPEG/size validation, protected retries, read-only polling and storage behavior.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed (Next.js 16.3.4 production webpack build).
- `git diff --check`: passed.
- Local production-browser integration: **17 assertions passed**, desktop 1440×1000 and mobile 390×844. Four initial AI ideas and a fresh ten-idea batch displayed decoded fixture pictures; cards outside the visible eight were prepared. Checked search, grid/row layouts, card-to-detail image reuse, Saved navigation, Planned navigation, explicit provider/download recovery, cloud-save ordering, reload cache reuse and signed-out behavior. No browser JavaScript errors were reported. Desktop and mobile screenshots were visually inspected.
- Read-only live Supabase metadata confirmed that `enough-photos` is private, permits JPEGs up to 2 MiB, and has existing authenticated owner-folder SELECT/INSERT/DELETE policies. No live data or policies were modified for these checks.
- Before deployment, the public `/api/ideas` returned `available: true`: the existing server key is configured. This confirms key presence only, not image-model permission or a successful generation.

### Browser test reproducibility

Build first, then run `node scripts/test-idea-images-browser.mjs` with the verified Node 24.19.0 test environment and a development-only Playwright/Chromium installation. Do not rebuild `.next` while that production-browser test is running. These are test tools, not application dependencies.

The driver accepts `ENOUGH_TEST_PLAYWRIGHT_MODULE`, `ENOUGH_TEST_CHROMIUM_PATH`, `ENOUGH_TEST_CHROMIUM_FLAGS_MODULE` (optional serverless-Chromium flags), `ENOUGH_TEST_PORT`, and `ENOUGH_TEST_RESULTS`. It starts the existing production server, supplies isolated auth/provider/storage fixtures, and prints the assertion result. Its reused fixture pixels test loading, caching and display; they do **not** prove the visual relevance of real model output.

## Authenticated live verification after publication

The implementation was published as commit `d3ff7a61075da7549b2174b73ca5d41b705ab339` through a non-force update from the inspected main head. Its reviewed remote tree matched the local index. GitHub's Vercel deployment status reported success. The existing public host returned HTTP 200 and served the new generated-image styles; the approved tagline and favicon remained intact. Anonymous private-image GET/POST requests returned 401, and a wrong-origin image POST returned 403.

The initial browser was signed out. The user completed sign-in through the authorised ENOUGH/Google flow, after which the live app displayed “My account” and “Saved to your account”. No credentials were extracted, written into source, or copied into the test environment; no access restrictions were bypassed.

**PASSED: real OpenAI → private Supabase storage → decoded My Moves picture.** A missing picture was explicitly prepared for an existing eligible seated mail/photo-sorting idea. It appeared as a relevant warm lifestyle scene of a seated person sorting papers/photos, labelled as an AI-generated illustration. The browser decoded the actual generated image at 1536×1024. Card and detail used the same private image URL, and the detail background matched it. A full page reload restored that same decoded cached image from the signed-in account. The live image was visually inspected and a user-private proof screenshot was retained; no private account content or picture was published into this repository.

These live checks used two existing daily AI slots: one fresh-idea batch and one successful explicit picture retry. The fresh batch returned no new candidates within the account's current needs/constraints, so it correctly generated no pictures. PINS, plans, saved ideas, outcomes and gallery rows were not changed or invented for the test.

**Remaining test limit:** a real multi-picture *fresh* batch was not observed, because that live batch had no qualifying new candidates. Automatic ten-picture batch preparation is covered by the automated tests and fixture-backed production-browser integration. The real-provider connection, storage, display and reload were exercised through the explicit existing-picture path, which uses the same generation/cache service. Live rate-limit failure and cross-account isolation were not deliberately induced; their deterministic checks remain fixture-backed. Reload cache reuse was verified from the restored identical image; direct upstream model-call telemetry was not available.

If a later key loses image-model access, the UI preserves the text ideas and reports that the existing connection's image-model access needs checking. A 429 preserves the idea and offers a later explicit retry; exhausted daily allowance continues to allow cached picture reads.

Official implementation references checked on 10 October 2026:

- https://developers.openai.com/api/docs/guides/image-generation
- https://supabase.com/docs/guides/storage/debugging/error-codes
- https://vercel.com/docs/functions/configuring-functions/duration
