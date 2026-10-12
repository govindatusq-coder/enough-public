# PR8 — an explicit enough preference

The health panel offers an explicit usual-amount choice or No limit. A median from seven prior readable days is a suggestion only; reading health data never chooses it. An optional entered amount also requires a button press. Measure changes clear the amount choice. Existing manual thresholds stay readable and effective because earlier versions already required the user to save them.

Keep short sitting-break ideas after my enough is on by default and independent of the amount choice. Reaching the chosen amount narrows home new-suggestion surfaces to eligible standing/stepping ideas lasting one to three minutes, or quiets them entirely when switched off. New AI batches are quiet; the My Moves button offers existing short breaks instead. People can browse all existing ideas and their saved/planned history at any time.

Daily readings are held only in app memory, survive internal tab navigation to support this behaviour, and clear when the app is hidden or left. Readings older than 15 minutes, from another local day or implausibly in the future cannot quiet suggestions. No health totals are added to the cloud snapshot. The privacy notice reflects this memory lifecycle.

## Validation

- 140 tests, TypeScript and production build pass; diff checks clean.
- Movement tests cover no automatic threshold, No limit, legacy choices, invalid units and bounds, the default-on exception, opt-out, exact short-break filtering and unchanged input/history. Existing tests cover freshness and local-date boundaries.
- No migration/dependency. Native/browser checks pending: amount choice, metric switch, No limit, checkbox, navigating between My Enough/My Moves, hiding the app, stale readings and all zero/missing-data states.

## Rollback

Retain `quietChoice` and `keepSittingBreaksAfterEnough` in strict validation. No limit must continue to mean a null threshold. Remove only the new surface behaviour if reverting; never infer an amount from the baseline.
