# One-at-a-time suggestions — 11 October 2026

“Show more ideas” opens `#moves/reels` at the first idea beyond the visible cards. The feed retains the discovery selection and its order, with current PINS eligibility applied on every render. It presents one photograph and suggestion per screen. Vertical swipes, mouse-wheel gestures, arrow keys, and Previous/Next buttons navigate without wrapping at the end. Users can explicitly request more suggestions inside the feed.

Save, accept, explanation, and full-detail actions use the existing account handlers. Returning to the list restores its filters, scroll position, and button focus. Browser Back also returns to the list. Long descriptions and larger reading text scroll within the suggestion; reduced-motion and solid-background settings are respected.

## Completed checks

- 102 Node tests pass, including stable selection order after scoring changes, current eligibility, selection boundaries, and deliberate vertical gestures.
- TypeScript and the production Next.js build pass.
- React review: navigation is initiated by user gestures/buttons, refs prevent repeated trackpad gestures, ResizeObserver and body scroll state are cleaned up, only the active reel mounts its photo, and controls expose disabled/error states.

## Release verification

Check the Show more ideas transition, next/previous and keyboard navigation, single active image, return-to-list filters, direct route/reload, and full details. No new generated batch or test outcome is required to verify this navigation change.
