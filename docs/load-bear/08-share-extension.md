# Share to Load Bear (iPhone Share Extension)

Status: built and tested on a real iPhone (iOS 26) from a hand-made Xcode target on 26 October. The target is
now part of the committed project and is built by the automatic TestFlight workflow.

## What it does

Load Bear appears in the iPhone share sheet (Messages, Messenger, WhatsApp, Mail, Safari, Photos, Files) for
text, links, photos and PDFs. Choosing it saves the shared content, and the app turns it into a task or bill with
no extra taps.

## How it works

1. `ShareExtension/ShareViewController.swift` runs inside the share sheet. It never uses the network. It saves
   text, links, photos (shrunk to 2000 px JPEG, which also converts HEIC) and PDFs into the shared App Group
   `group.au.loadbear.app`, in `inbox/<id>/`, writing `payload.json` last.
2. iOS does not let a share extension open its app (confirmed on a real iPhone running iOS 26: the automatic
   switch does not happen). So the extension posts a local notification, "Given to Bear. Tap to open Load Bear",
   and also tries the `loadbear://share` route as a best effort. The app asks for notification permission the first
   time it opens.
3. `ios/App/App/SceneDelegate.swift` (`ShareInbox`) runs whenever the app becomes active. It reads the inbox, and
   calls `window.__bearShare(payload)` in the web app. The item is deleted only after the web app accepts it,
   with retries for 20 seconds while the page loads.
4. `components/bear/runtime.tsx` keeps the payload, goes to `/bear/capture?native=1`, and the capture screen
   gives it to Bear immediately: text goes through the normal path, a photo or PDF is uploaded like any other.
   `lib/bear/client-share.ts` accepts only JPEG, PNG, WebP, GIF, HEIC and PDF, at most 5 files and 10 MB each.

Because the web app does the upload with the existing signed-in session, no login token is shared with the
extension.

## Known limits

* If you are signed out when the app opens, the capture screen sends you to sign in and the shared item is lost.
  Share again after signing in.
* Only the first file of a multi-photo share is processed; text shared with it travels along as notes.
* Messenger and WhatsApp offer Share for photos and links, but usually not for plain text messages. Copy and
  "Paste from clipboard" in the capture box, or a screenshot, remain the dependable routes there.
* The automatic switch to the app depends on iOS letting an extension open its app. If it does not, the
  confirmation says "Open Load Bear to see it" and the item is picked up when you do.
* A Share Extension counts as app functionality for App Review. Fine for TestFlight; privacy answers must say
  shared content is sent to Load Bear's servers and the AI provider only when you share it.

## Xcode set-up

The `ShareExtension` target is now in the committed Xcode project (`native-loadbear/ios/App/App.xcodeproj`): it
builds `ShareExtension/ShareViewController.swift` with `ShareExtension/Info.plist`, targets iOS 15.0, has the
bundle `au.loadbear.app.ShareExtension`, and is embedded in the app. Both targets carry the App Group
`group.au.loadbear.app`. Nothing needs adding by hand in Xcode any more, and the automatic TestFlight
uploads (`native-loadbear/README.md`) include it.

## Test checklist (on a real iPhone)

1. Messages: select text in a message, Share, Load Bear. Expect "Given to Bear", then a task appears.
2. Safari: share a web page. Expect a task or note built from the link.
3. Photos: share a screenshot of a bill. Expect the check screen for a bill.
4. Files or Mail: share a PDF.
5. Share while Load Bear is closed, then open it: the item should appear.
6. Share something unsupported (a Word file): expect "Bear can't read that".
