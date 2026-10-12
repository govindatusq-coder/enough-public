# Native release checklist

PR9 prepares configuration and status reporting. A store-ready binary still needs the checks below. Neither a device build nor a store submission was made in this workspace.

## Build and origin

`native/capacitor.config.json` defaults to `https://enough-public.vercel.app`. From `native`, run `npm run sync`; it first generates the web origin and updates the exact host guards in both health bridges. For an approved staging build, set `ENOUGH_NATIVE_SERVER_URL` to its HTTPS origin before sync. Credentials, ports, paths, queries and fragments are rejected. Return to the default before a release and inspect the diff. Never add a wildcard navigation/health allowlist. The generated native project configuration must match the reviewed origin.

The shell loads remote Next.js content. Capacitor documents `server.url` as a live-reload feature, not intended for production. The remote-content architecture therefore needs an explicit release decision and store review; this PR does not make that architecture store-approved. Check [Capacitor configuration](https://capacitorjs.com/docs/config) and [Apple review guidelines, including minimum functionality](https://developer.apple.com/app-store/review/guidelines/). Demonstrate the tested native health features, useful manual journeys, failure recovery and ongoing utility to reviewers. Plan a bundled frontend architecture if remote loading cannot meet the release requirements.

## Required release checks

- Produce signed iOS and Android builds using the existing native projects. Run sync first, confirm bundle/application IDs, entitlements and only steps/exercise read permissions. Test an unexpected host cannot invoke either bridge.
- On real devices, test allow, deny, partial permission, later revocation, no records, genuine zero records, unsupported Health Connect, disconnect/reconnect and retry. Check the last-read timestamp, uncertain permission copy, midnight/timezone changes and the 15-minute freshness rule. Daily summaries must clear on hide/leave; health evidence must save only by explicit activity confirmation.
- Test welcome → optional/required setup → save/accept → support plan → confirm → My Wins; export/delete; email and available social sign-in; QR camera and photo picker; external Maps and calendar handoff; screen readers, large text, keyboard focus, safe areas and offline/error states. Library and manual flows must still work without health permission.
- Provide working reviewer accounts and instructions without adding secrets to source. Explain which features are native and which require internet. Verify remote failures show useful recovery, and whether the packaged offline page is actually reached on both platforms. Check all remote updates remain compatible with released plugin versions.
- Finalise the legal-review privacy notice: operator, contact, complaints route, actual retention and overseas processing. Set the public `/privacy` URL in both stores. The Health Connect rationale screen now links to it. Complete Apple privacy declarations and Google Play Data safety / health declarations against the actual flows, including optional OpenAI processing and user-controlled deletion.
- Declare only the Health Connect use cases/permissions actually needed. Follow [Google's Health Connect publication guidance](https://developer.android.com/health-and-fitness/health-connect/publish) and [Android health permission guidance](https://support.google.com/googleplay/android-developer/answer/12991134?hl=en). No advertising, raw-sample upload or automatic outcome completion is implemented.
- Test the CSP in the actual Vercel preview and native webviews: sign-in, private photos, licensed library images, QR/camera, calendar downloads and all font weights. `next/font` serves fonts from ENOUGH; production forbids eval and external font hosts. Inline scripts/styles remain for the static Next App Router and existing component styles. A nonce policy would require a separate rendering change; see [Next CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy).

## Release evidence

Record the native build IDs, device/OS versions, permission cases, reviewed remote deployment commit and store decisions in the release PR. Do not claim these checks are passed from the web build or unit tests alone.
