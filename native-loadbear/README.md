# Load Bear for iPhone (TestFlight shell)

A Capacitor shell that opens the deployed Load Bear web app (`/bear`) inside a native iOS
app, so it can be distributed through TestFlight. The web app does all the work; this
project supplies the icon, name, permissions and the App Store container.

Known limit: Apple's App Review can reject apps that are only a website in a wrapper
(guideline 4.2). TestFlight internal testing does not go through that review, so this is
fine for testing with your own group. A fuller native build is a later step.

## Automatic TestFlight uploads

`.github/workflows/loadbear-ios.yml` builds the app on GitHub's Mac build machines (Xcode 26) and uploads
it to TestFlight whenever the app itself changes on `main` (anything under `native-loadbear/`). It can also
be started by hand: GitHub, **Actions → Load Bear iPhone app → Run workflow** on `main`. The new build shows
in the TestFlight app once Apple has processed it (usually 10–30 minutes). Website changes never need a new
build, because the app opens the live site. On other branches the workflow only checks that the app builds.

One-off set-up, needed before the first upload:

1. App Store Connect → **Users and Access → Integrations → App Store Connect API → Team Keys → +**.
   Name it "GitHub uploads" and give it **Admin** access (Xcode needs Admin to create the signing
   certificate and profiles itself). If App Store Connect asks for API access to be requested first, the
   Account Holder does that once on the same page.
2. Download the key (a `.p8` file; Apple lets you download it only once). Note the **Key ID** in the list
   and the **Issuer ID** above it.
3. Your **Team ID** is under developer.apple.com → Account → Membership details.
4. GitHub → this repository → **Settings → Secrets and variables → Actions → New repository secret**, four
   times: `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, `APPLE_TEAM_ID`, and
   `APP_STORE_CONNECT_PRIVATE_KEY` (open the `.p8` file in a text editor and paste all of it, including the
   BEGIN and END lines).

Signing is automatic: Xcode registers the app and the share add-on with Apple, creates the profiles and
signs with an Apple-managed distribution certificate. Each build gets a number from the date and time
(for example `2026.1118.2306`), so it is always higher than the build before.

## Build and upload by hand (on a Mac with Xcode 26)

1. Install Node 22+, then in this folder:
   ```
   npm install
   LOADBEAR_SERVER_URL=https://YOUR-APP.vercel.app npm run sync
   npm run ios
   ```
   `npm run sync` writes `capacitor.config.json` pointing at `https://YOUR-APP.vercel.app/bear`
   and opens Xcode with `npm run ios`.
2. In Xcode, select the **App** target, **Signing & Capabilities**: tick *Automatically manage
   signing* and choose your Apple Developer team. Bundle identifier is `au.loadbear.app`;
   change it if that identifier is taken.
3. Pick **Any iOS Device (arm64)** as the run destination, then **Product → Archive**.
4. When the Organizer opens: **Distribute App → TestFlight & App Store → Upload**. Accept
   the defaults.
5. In App Store Connect (appstoreconnect.apple.com) the build appears under your app's
   **TestFlight** tab after processing (10–30 minutes). Add yourself under *Internal Testing*,
   install the TestFlight app on your iPhone, and the build appears there.

First time only: create the app record in App Store Connect (**My Apps → +**) with the same
bundle identifier before uploading, or Xcode will offer to create it.

## What the shell needs from the web deployment

* The site must be live at the origin you pass in `LOADBEAR_SERVER_URL`.
* Supabase Auth redirect URLs must include `https://YOUR-APP.vercel.app/auth/callback?next=/bear`.

## App icon

The Xcode AppIcon (`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`) is a copy of `public/bear/art/icon-master-square.png` (1024×1024, full square, no rounded corners). When the artwork changes, copy it there too, then archive and upload a new build: TestFlight only shows a new icon in a new build. iOS rounds the corners itself. `public/bear/art/icon-master.png` has rounded corners baked in, so it would show black slivers.

## Share to Load Bear

The iPhone Share Extension lives in `ShareExtension/` and is part of the Xcode project as the `ShareExtension` target (bundle `au.loadbear.app.ShareExtension`), embedded in the app. The app and the extension share the App Group `group.au.loadbear.app` (`ios/App/App/App.entitlements`, `ShareExtension/ShareExtension.entitlements`). See `docs/load-bear/08-share-extension.md` for how it works and the test checklist.
