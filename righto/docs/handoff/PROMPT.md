# Paste this into Claude Code

Open Terminal in the unzipped `design_handoff_righto_app` folder, run `claude`, then paste:

```
You are building Righto, a React Native + Expo app that must run in Expo Go.

READ FIRST: START_HERE.md, README.md, INTENDED_PURPOSE.md, PRIVACY.md, COMPLIANCE_REVIEW.md, theme.ts.
VISUAL REFERENCE: reference/Righto App v3.dc.html (open it in a browser). Where it differs from README, v3 wins.
STARTER CODE: starter/ contains working files to begin from: src/theme.ts, src/ui.tsx (Background, Glass, NavyCard, buttons, Chip, Kicker, Logo, SupportLink), src/store.ts (zustand + mock data), app/_layout.tsx, app/index.tsx (splash), app/consent.tsx, app/home.tsx, app/support.tsx, assets/background-coast.webp.

STEP 1 — project
- In a new sibling folder ../righto-app run: npx create-expo-app@latest righto-app --template blank-typescript
- Install (always with npx expo install so versions match Expo Go):
  expo-router expo-blur expo-linear-gradient expo-font expo-status-bar expo-constants expo-linking react-native-safe-area-context react-native-screens react-native-svg react-native-reanimated @react-native-async-storage/async-storage expo-notifications expo-local-authentication expo-secure-store @expo-google-fonts/newsreader @expo-google-fonts/dm-sans @expo-google-fonts/ms-madi
  then: npm i zustand phosphor-react-native
- Set "main": "expo-router/entry" in package.json; add "scheme": "righto" to app.json.
- Copy starter/app, starter/src, starter/assets into the project. Delete App.tsx.
- Run npx expo start and fix any errors until Splash → Consent → Home works.

STEP 2 — remaining client screens (match reference exactly; reuse src/ui.tsx; no new colours/fonts)
app/link.tsx (Confirm psychologist), app/applock.tsx (Face ID via expo-local-authentication / passcode / skip), app/notifs.tsx (reminder primer with private preview + "Show task details on my lock screen" toggle; on finish set onboarded=true and router.replace('/home')),
app/task/[id].tsx (New task: ? Why sheet, i About sheet, What to do, Dr Chen suggests card, Do it now / Set a commitment / Set a goal rows, Nothing for now → status later + laterUntil +3 days, SupportLink),
app/commit/[id].tsx (When/Where/How/Make it easy with live navy preview), app/pledge/[id].tsx (Your commitment, "I commit," script, share toggle),
app/goal/[id].tsx (5 questions + Remind me time chips + day circles; "not monitored" note),
app/now/[id].tsx (timer ring with react-native-svg + reanimated; I've done it → check-in),
app/checkin/[id].tsx (Done / Some of it / Not today tiles, What helped / What would you change, share toggle defaulting to shareDefault, "not monitored" note, SupportLink),
app/again/[id].tsx (Keep it going: daily / once more / not for now),
app/journal.tsx (progress tile with segmented bar + legend, entries list).
Floating glass TabBar (Home, Journal) on home + journal. Toast component for confirmations.

STEP 3 — psychologist side
app/settings.tsx with "View as psychologist" toggle for testing. app/psych/index.tsx (Clients list with progress bar), app/psych/[client].tsx (dashboard, "Your access to this record is logged", Export to notes, End sharing, task cards), app/psych/assign.tsx (Task, Instructions, Why this helps (required), Takes about, They'll need, Tag it Quick/Quiet, Talked it through in session → suggest commitment/goal; Send disabled until Task + Why). Assigned tasks appear for the client via the store.

STEP 4 — reminders + privacy
expo-notifications local schedules for commitments (routine time/days) and goals (chosen time/days) using PRIVATE copy from PRIVACY.md §4 unless notifDetail is on; categories with Done / Not today / Start actions. App lock on resume after 5 min background (AppState) + privacy overlay when inactive. Settings → Privacy & data per PRIVACY.md §3.4 (download my data as JSON via share sheet, delete account, unlink psychologist).

RULES
- Follow INTENDED_PURPOSE.md: no scores, no clinical language, no mood storage, no generated advice. "Need support now?" on Home, New task, Do it now, Check-in, Journal.
- Every touch target ≥ 44pt. accessibilityLabel on icon buttons. Support Dynamic Type without truncation.
- Only Expo Go–compatible packages. No native modules that need a dev build.
- Match the reference at 390×844; compare screen by screen before moving on.
- git init; commit after each step; tell me how to open it on my phone (npx expo start, scan QR; --tunnel if Wi-Fi blocks it).
```

## After it's running
- Something looks off → screenshot it, drag into Claude Code: "match reference/Righto App v3.dc.html for this screen".
- Backend + app store builds → Prompts 4 and 5 in START_HERE.md.
