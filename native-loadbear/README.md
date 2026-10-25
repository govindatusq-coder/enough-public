# Load Bear for iPhone (TestFlight shell)

A Capacitor shell that opens the deployed Load Bear web app (`/bear`) inside a native iOS
app, so it can be distributed through TestFlight. The web app does all the work; this
project supplies the icon, name, permissions and the App Store container.

Known limit: Apple's App Review can reject apps that are only a website in a wrapper
(guideline 4.2). TestFlight internal testing does not go through that review, so this is
fine for testing with your own group. A fuller native build is a later step.

## Build and upload (on a Mac with Xcode 16+)

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

Use `public/bear/art/icon-master-square.png` (1024×1024, full square, no rounded corners) for the Xcode AppIcon. iOS rounds the corners itself. `public/bear/art/icon-master.png` has rounded corners baked in, so it would show black slivers.
