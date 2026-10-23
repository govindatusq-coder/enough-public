# ENOUGH for iPhone

A native SwiftUI app built from the ENOUGH website in this repository. It keeps the same journey (Welcome → PINS and routines → My Moves → support plan → confirm → My Wins), the same copy, the same idea library and matching rules, and the same account format, so a profile saved from the website opens in the app and vice versa.

The earlier `native/` folder is a Capacitor shell that loads the website remotely; Capacitor documents that architecture as a live-reload feature, not a production one. This app replaces it with bundled native screens. The shell is kept for reference and is not needed to build this app.

## What is in the app

- **Welcome**: the landing page, with the four example ideas and the "how it thinks" steps.
- **My Enough**: greeting, featured free idea, today's opportunities, PINS readiness ring, today's progress, your life lately (private photos when signed in), what Enough has given back, your week with the optional weekly review, saved ideas, learning, "anything different today?", surprise me, ideas near you, and **Your movement today** backed by Apple Health (read-only steps and exercise time, your own chosen "enough").
- **My Moves**: Explore (search, filters, collections, favourites, nearby, surprise me, **More suggestions** from OpenAI through the website's API), Saved and Planned. Planned moves offer **How did it go?**, the six-page support plan, Not today, the optional Health movement check and QR or typed companion check-ins.
- **My Wins**: real returns by period and currency, moments and private photos (upload, swipe, delete), month calendar, milestones, made room for more, top moments, what Enough has learned, activity history with corrections, and the detailed receipt.
- **My Pins**: the profile, the eight-step setup, AI and privacy choice, country and currency, reset or delete, account and backup, and the privacy notice.

Idea matching (`Logic/Recommendations.swift`), discovery filters, wins and dashboard maths are line-by-line ports of `lib/recommendations.ts`, `lib/discovery.ts`, `lib/moves.ts`, `lib/wins.ts` and `lib/dashboard.ts`. The 61-idea library is ported from `lib/ideas.ts` and `lib/sitting-break-ideas.ts` with the same IDs.

## Accounts, sync and AI

- Sign-in is email and password against the same Supabase project as the website (`Services/AuthService.swift`). Google and Apple sign-in are not offered in the app yet.
- Profile and progress are stored on the device until the user chooses to keep them in their account (the same collection notice and import choice as the website).
- Once attached, every change is saved through the website's own `/api/account` route with a bearer token, so the server keeps validating the state, checking revisions and archiving generated ideas exactly as it does for the browser. Photos use `/api/photos`; fresh ideas use `/api/ideas`, `/api/ideas/history` and `/api/idea-image`.
- Bearer-token support for those routes lives in `lib/public-auth.ts` and `lib/supabase/server.ts` in this branch. **The website must be deployed with that change before the app's account features work.** Until then, sign-in succeeds but saving returns "Request origin is not allowed."
- The OpenAI key stays on the server. The app only asks the website for a batch after the user has chosen an AI and privacy option.

## Building

Requirements: Xcode 16 or later, iOS 17 or later on the device, an Apple developer team for HealthKit.

1. Open `ios/Enough/Enough.xcodeproj`.
2. In `Enough/Resources/EnoughConfig.plist`, set `SupabasePublishableKey` to the website's public key (the value of `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Leave `WebOrigin` on the production origin, or point a preview build at a Vercel preview origin that carries this branch. Only bare HTTPS origins are accepted.
3. Select your team under Signing & Capabilities. The HealthKit capability is already declared in `Enough.entitlements`.
4. Run on a device or the simulator. Run the `EnoughTests` target for the parity tests (library IDs, account JSON round trip, matching rules, receipts, money parsing, Health thresholds).

The project uses Xcode's synchronised folders, so new files under `Enough/` and `EnoughTests/` join their targets automatically.

## Known limits and release notes

- This app was written and reviewed without an Xcode build in the authoring environment. Expect to fix small compile or layout issues on the first build; the logic has unit tests and the website's own tests cover the fixture format.
- Not yet in the app: Google or Apple sign-in, password update (use the website link from the recovery email), the live motion sensor demo from the web, and Android. Health Connect is not applicable.
- Follow `docs/native-app-store-readiness.md` before any store submission: device permission cases, privacy declarations for Health and OpenAI processing, reviewer accounts, and the legal review of the privacy notice.
