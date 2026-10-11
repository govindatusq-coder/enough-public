# One-at-a-time suggestions — 11 October 2026

“Show more ideas” opens `#moves/reels` at the first idea beyond the visible cards. The feed retains the discovery selection and its order, with current PINS eligibility applied on every render. It presents one photograph and suggestion per screen. Vertical swipes, mouse-wheel gestures, arrow keys, and Previous/Next buttons navigate without wrapping at the end. Users can explicitly request more suggestions inside the feed.

Save, accept, explanation, and full-detail actions use the existing account handlers. Returning to the list restores its filters, scroll position, and button focus. Browser Back also returns to the list. Long descriptions and larger reading text scroll within the suggestion; reduced-motion and solid-background settings are respected.

## Completed checks

- 102 Node tests pass, including stable selection order after scoring changes, current eligibility, selection boundaries, and deliberate vertical gestures.
- TypeScript and the production Next.js build pass.
- React review: navigation is initiated by user gestures/buttons, refs prevent repeated trackpad gestures, ResizeObserver and body scroll state are cleaned up, only the active reel mounts its photo, and controls expose disabled/error states.

## Browser verification

The Vercel preview opens at suggestion 9 of 44 after Show more ideas. Next and ArrowUp navigate correctly. Exactly one reel and picture mount, while the discovery cards are hidden. The initial supplied photo loads at full opacity. All ideas restores eight cards and button focus. The Free filter opens suggestion 9 of 25 and remains selected on return.

The preview’s account/API routes lack a working account connection, so authenticated generation and saving are verified through existing tests and reserved for production. No new batch or outcome is recorded for this UI check.
