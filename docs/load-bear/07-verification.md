# Load Bear MVP — verification record (23–24 October 2026)

## What was run

| Check | Command | Result |
|-------|---------|--------|
| Unit + vertical-slice tests | `pnpm test` | 162 passed, 0 failed (10 Load Bear tests across 3 files, plus the existing ENOUGH suite) |
| TypeScript | `pnpm typecheck` | clean |
| Lint | `pnpm lint` (new flat config, `eslint-config-next`) | clean |
| Production build | `pnpm build` | compiled; all `/bear` and `/api/bear` routes emitted |
| Browser walk-through | `BEAR_TEST_MODE=start node scripts/test-bear-browser.mjs` | 26 steps passed (bill slice, school note auto-set-up and edited, Everything view, voice option, shopping list ticked, estimated and split, win edited with a saving and made current again, area page) in headless Chromium (390×844, en-AU, Australia/Sydney) against `next start` with the in-memory local store; screenshots in `.bear-browser-results/` |

## The vertical slice covered by `tests/bear-vertical-slice.test.mjs`

new user → onboarding (areas, people, PINS, Life Rhythm, capacity stored) →
screenshot capture through the model provider (fake) → extraction succeeds →
low-confidence due date triggers a specific question → confirming without
verification is refused → user corrects the field → Area/Project/Task/Bill
created with the original document as the resource and a discount-deadline
dependency → reminder recommended in a non-protected window ahead of the due
date → accepted → two reminders scheduled → nothing fires early → due reminder
delivered with a non-guilt message and assistance actions → Bear offers BPAY
details, payment page and the original → mark paid → task done, reminders
quietly closed → Win generated → Wealth entry only for the stated late fee
(discount correctly not counted when paid after its deadline) → recurring
expectation offered, accepted, window predicted → My Wins and My Bear totals.

Edge cases: missing due date, ambiguous amount, multiple dates, model/rules
disagreement, already paid, overdue, duplicate, user rejects, invalid image,
wrong MIME, AI failure, network failure, schema-invalid model output, no
provider configured, notification permission denied, Chaos mode, repeated
deferral changing the plan rather than nagging.

## What was NOT verified here

* A real Anthropic round trip for photo/PDF reading (no key in this
  environment). The provider is exercised through the fake; the Anthropic
  implementation compiles and follows the current SDK surface
  (`output_config.format` JSON schema, vision/PDF blocks, typed errors).
* The Supabase migration applied to the real project, RLS in a real database,
  signed URLs, and email sign-up. The Supabase store compiles against the
  same `BearStore` contract the tests exercise through the in-memory store.
* Web Push on a real device (no VAPID keys). The subscription, service worker
  and cron route are in place and visibly report "not connected" until keys
  exist.
* iOS Safari / Add to Home Screen behaviour on a device.
