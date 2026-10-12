# PR9 — native configuration, health status and fonts

The native shell and both exact health host guards now target the production Vercel origin. `native/configure.mjs` supports an explicit HTTPS staging origin and updates all three together before sync. It validates the origin before writing and has no new dependency. Android's rationale text now refers to ENOUGH sign-in and links to the public privacy draft.

The health panel shows its last successful read and an honest permission state. An empty result cannot prove denial, grant or zero activity. Retry uses a safe error category without displaying raw diagnostics. Disconnect failures are handled; successful disconnect still tells the user how to revoke OS permission. Existing manual check-ins remain available.

DM Sans and Newsreader now use `next/font` with CSS variables and preserve the existing variable weights/italic. Browser fonts come from ENOUGH. A production CSP restricts fonts, connections, images, workers, frames, forms and objects; eval is development-only. Static Next hydration and existing inline component styles retain inline allowances, documented rather than represented as a nonce policy.

A final content check clarified the original catch-up walk and audiobook tidy instructions so their sitting-break tags refer to explicit steps. IDs and timing are unchanged; the existing landing-example test now checks actual movement in the copy.

## Evidence

- 144 tests pass; TypeScript, production build and diff checks pass. Four new tests cover origin agreement, staging/rejected inputs, CSP and safe health recovery.
- The compiled production server returned HTTP 200 for `/` and `/privacy`. Three preloaded local WOFF2 files returned 200; rendered HTML contained no Google font URL. The response contained the expected production CSP. `/api/ideas` returned `{available:false}` with no provider key, as expected.
- Test server used inert local-only public auth configuration; no production secret, provider request or account mutation. A localhost bind avoids this workspace's network-interface enumeration restriction. The server and HTTP probes had to run in the same tool process.
- Interactive browser checks remain pending: the workspace has no browser binary, and the browser download returned invalid/truncated archives. Native builds, permission sheets and physical devices were not available. Follow docs/native-app-store-readiness.md before release. This is preparation, not a store-ready claim.
- No database migration or application dependency added. No deployment, store submission or production environment changes.

## Rollback

Revert CSP/font changes together if a webview incompatibility is found, then recheck resources and privacy copy. Keep a coherent native server/bridge origin and run configure + sync; reverting only the URL would break health access. No account format change in this PR.
