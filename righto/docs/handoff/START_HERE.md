# Start here — build Righto in Expo Go

## 1. One-time setup (10 min)
1. Install **Node.js LTS** → https://nodejs.org
2. Install **Claude Code** → https://docs.claude.com/en/docs/claude-code (follow the install command for your computer)
3. On your phone, install **Expo Go** (App Store / Google Play)
4. Phone and computer on the **same Wi-Fi**

## 2. Start
1. Unzip this folder somewhere easy, e.g. `Documents/righto`
2. Open Terminal in that folder (Mac: right-click folder → New Terminal at Folder; Windows: right-click → Open in Terminal)
3. Type `claude` and press Enter
4. Paste **Prompt 1** below

## 3. Run on your phone
When Claude Code says it's done:
```
npx expo start
```
Scan the QR code (iPhone: Camera app · Android: Expo Go app). Righto opens in Expo Go.
If it won't connect: `npx expo start --tunnel`

---

## Prompt 1 — app shell + client flow (mock data)
```
Read START_HERE.md, README.md, INTENDED_PURPOSE.md, PRIVACY.md, COMPLIANCE_REVIEW.md and theme.ts.
The visual + behaviour reference is reference/Righto App v3.dc.html (open it in a browser to compare). v3 wins over the README where they differ.

Build Righto as an Expo app that runs in Expo Go:
- Create it IN THIS FOLDER with: npx create-expo-app@latest . --template blank-typescript (keep my existing files)
- Use only Expo Go–compatible packages: expo-router, expo-blur, expo-linear-gradient, expo-font, @expo-google-fonts/newsreader, @expo-google-fonts/dm-sans, @expo-google-fonts/ms-madi, phosphor-react-native, react-native-svg, expo-notifications, expo-local-authentication, expo-secure-store, react-native-reanimated, zustand, @react-native-async-storage/async-storage. Install with `npx expo install`.
- Copy theme.ts into src/theme.ts and use it for every colour, font, radius and spacing.
- Build shared components first: Background (photo + tints), GlassCard (BlurView + gradient + border), NavyCard, PrimaryButton, SecondaryButton, TextButton, Chip, Kicker, InfoButtons (? and i), StatusDot, BottomSheet, Toast, TabBar (floating glass pill), SupportLink.
- Screens (client), with local mock data matching the reference: Splash → Consent → Confirm psychologist → App lock → Reminders primer → Home (mindful: "What feels doable right now?") → New task → Set a commitment → Your commitment → Set a goal → Do it now (timer) → Check-in → Keep it going → Journal (progress tile + entries). Support sheet, Why sheet, About sheet.
- Keep state in a zustand store persisted with AsyncStorage (encrypt later in Phase 3).
- Follow INTENDED_PURPOSE.md rules: no scoring, no mood storage, no generated advice.
- Match the reference pixel-for-pixel at 390×844. Make sure it runs in Expo Go with `npx expo start` and has no red errors.
- git init and commit when done. Then tell me exactly how to open it on my phone.
```

## Prompt 2 — psychologist side
```
Add a role switch for testing (Settings → "View as psychologist"). Build Clients list (progress bar per client), Client review (homework dashboard, "access is logged", Ask-what-feels-doable switch, Export to notes, End sharing, task cards), and Assign homework (all fields incl. Why this helps, Takes about, They'll need, Tag it Quick/Quiet, Talked it through in session → suggest commitment/goal). Assigned tasks appear on the client side via the shared store. Match the reference. Commit.
```

## Prompt 3 — reminders, app lock, privacy settings
```
Implement: local notifications with expo-notifications for commitments (routine time) and goals (chosen time/days), using the PRIVATE copy from PRIVACY.md §4 by default and detailed copy only if "Show task details on my lock screen" is on; notification actions Done / Not today / Start. App lock with expo-local-authentication (relock after 5 min in background, blur overlay in app switcher). Move sensitive local data to encrypted storage (key in expo-secure-store). Settings → Privacy & data screen per PRIVACY.md §3.4. "Nothing for now" schedules a nudge in 3 days. Commit.
```
Note: in Expo Go, scheduled local notifications work; remote push needs a development build later.

## Prompt 4 — backend (when ready for real users)
```
Add Supabase (project in the Sydney region). Tables per README data model; Row Level Security so clients see only their rows and psychologists see only linked clients' shared rows; audit log table for psychologist reads; invite links single-use + 48h expiry; psychologist MFA. Replace mock data. Write tests that a psychologist cannot read another psychologist's client. Commit.
```

## Prompt 5 — beta builds
```
Set up EAS (eas.json) for internal testing: iOS TestFlight and Google Play internal track. Add app icon (navy rounded square, cream script "r" + champagne dot) and splash. Fill Apple privacy label and Google data-safety answers from PRIVACY.md §5. Walk me through each step.
```
Needs: Apple Developer account (A$149/yr), Google Play Console (US$25 once).

---

## Tips
- Do one prompt at a time; test on your phone between each.
- If something looks off: screenshot it, drag into Claude Code, say "match the reference".
- If it breaks: "undo to the last commit".
- Before any real client: complete the 🔴 list in COMPLIANCE_REVIEW.md and get the legal/privacy review.
