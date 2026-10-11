# Pictures with requested suggestions — 11 October 2026

## Behaviour

My Moves no longer asks people to prepare individual pictures. The card and detail retry buttons, missing-picture notices and per-picture allowance explanations are removed. A quiet branded scene remains if a picture is unavailable; the suggestion stays usable.

`POST /api/ideas` still reserves one existing daily AI batch before invoking either model. It prepares pictures for new validated ideas first, then fills missing pictures for earlier eligible, non-hidden AI suggestions using spare capacity. This also works when the new text batch produces no qualifying candidates. At most ten missing pictures are attempted, with at most five provider calls at once. Cached pictures and duplicate scenes are skipped. Cache existence is checked using metadata rather than downloading every earlier image.

Only requesting suggestions starts image generation. `/api/idea-image` exposes cache reads only (unsupported POST returns 405). Cards, details, reloads and client refreshes never call the image model. A successful suggestion request refreshes failed cache reads once; new pictures are read after cloud-save acknowledgement. Failed generation can recover through a later suggestion request, within that request's capacity and existing allowance.

The existing server-only OpenAI key, model settings, private owner-folder storage, atomic reservations, account restrictions, ten-picture cap and five daily suggestion batches remain in place. No key, dependency, lockfile, schema, policy, authentication, PINS, outcome calculation, homepage or favicon changes were made.

## Checks actually passed before publication

- `npm test`: **87 passed, zero failed**. Added coverage for empty new batches backfilling older pictures, new-picture priority, cached/duplicate skipping, bounded preparation and recovery on the next suggestion request. Updated cache-read tests verify no image-generation handler and read-only client refreshes.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed, Next.js 16.3.4 production webpack build on Node 24.19.0.
- `git diff --check`: passed.
- `scripts/test-idea-images-browser.mjs`: **24 assertions passed**, with no browser JavaScript errors, on desktop 1440×1000 and mobile 390×844. Four original suggestions plus ten new suggestions displayed fourteen decoded fixture pictures. Verified no separate picture buttons/notices, ten-picture priority, automatic older-picture recovery with an empty new batch, cache recovery after a download failure, cloud-save ordering, search, card/detail reuse, Saved/Planned navigation, grid/row responsiveness, reload reuse and signed-out isolation. The actual local production picture route rejected POST with 405. Desktop and mobile screenshots were visually inspected.

The browser test uses isolated provider/auth/storage fixtures and a non-working public Supabase fixture configuration for its server middleware. No production key is copied into the test environment. Its reused pixels verify loading/display, not activity-specific visual relevance. Build first and use the Node 24.19.0 instructions and optional browser-tool environment variables documented in [the earlier verification record](idea-images-2026-10-10.md). Do not rebuild while the production-browser test is running.

## Publication and live check

Live verification will be recorded after publishing through the existing GitHub-to-Vercel deployment. Earlier real-provider verification is recorded separately in the historical image record; the 24 checks above do not claim a new real-provider batch.
