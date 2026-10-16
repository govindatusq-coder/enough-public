# Righto — homework companion (Expo Go prototype)

React Native + Expo app for psychologists to send homework and for clients to actually do it. Built from the
design handoff in `docs/handoff/` (spec, intended-purpose statement, privacy build requirements, compliance review)
and the v3 HTML reference. Runs in **Expo Go** on iOS and Android with local mock data; no backend yet.

## Run it on your phone

```bash
cd righto
npm install
npx expo start          # add --tunnel if your Wi-Fi blocks the connection
```

Scan the QR code (iPhone: Camera app · Android: Expo Go app). Splash → Consent → Confirm psychologist → App lock →
Reminders → Home.

Other commands: `npm run typecheck` (TypeScript), `npm test` (pure-logic unit tests with Node's test runner).

## What is built

**Client:** Splash · Consent (express consent, collection notice, share default) · Confirm psychologist (mock invite) ·
App lock (Face ID / fingerprint / device passcode via `expo-local-authentication`) · Reminder primer with private
lock-screen preview · Home ("What feels doable right now?" picker, next-step card, new-homework line) · New task
(Why "?" and About "i" sheets, suggested commitment/goal, Do it now / Do it later with a routine or at a chosen time / Something else)
· Set a commitment (When · Where · How · Make it easy · Reminder with the routine or at a time you choose, live navy
preview) · Your commitment · Set a goal (5 questions, reminder chips or your own time, days) · Do it now (SVG + Reanimated timer ring) · Check-in (Done / Some of it / Not today, what you
learned, per-check-in share toggle) · Keep it going · Journal (progress tile, segmented bar, legend, Finished homework with Try again, entries) · Settings
· Privacy & data (notification detail, share default, app lock + lock-after, unlink, download my data, delete account,
policy/notice/privacy officer). "Need support now?" (000, Lifeline, Beyond Blue, About Righto) is reachable from Home,
New task, Do it now, Check-in and Journal.

**Psychologist** (Settings → "View as psychologist"): Clients list with progress bar · Client review (dashboard of
counts and dots, "Recorded by Sam", access-is-logged line, "Ask ‘What feels doable?’ on Home" switch, Export to notes
via the share sheet, End sharing, task cards showing only what the client shared) · Assign homework (Task, Instructions,
Why this helps, Takes about, They'll need, Tag it Quick/Quiet, Talked it through in session → suggest a commitment or a
goal). Assigned tasks appear on the client side through the shared store and fire a local "new homework" alert.

**Reminders & privacy:** local notifications only (`expo-notifications`): commitments at the routine time (daily or
next occurrence), goals weekly on the chosen days, "Nothing for now" nudges in 3 days. Lock-screen copy is the private
copy from PRIVACY.md §4 unless "Show task details on my lock screen" is on. Notification actions: Done / Not today /
Start (routine), Do it now / Do it later (new homework). Android channel uses `VISIBILITY_PRIVATE`. The app relocks
after the chosen time in the background and shows an opaque privacy overlay in the app switcher. Local state is
encrypted (XChaCha20-Poly1305 via `@noble/ciphers`) with a key in `expo-secure-store`; the "What feels doable" answer is
never persisted.

## Structure

```
app/            expo-router screens (file = route)
src/theme.ts    design tokens from the handoff
src/ui.tsx      Background, Glass, NavyCard, buttons, Chip, Kicker, InfoButtons, StatusDot, SegBar, TabBar, sheets…
src/logic.ts    pure data model, copy and rules (unit-tested, no RN imports)
src/store.ts    zustand store persisted through src/storage.ts (encrypted)
src/notifications.ts  local reminder scheduling + categories
src/time-picker.tsx   "pick your own time" pill (compact picker on iOS, clock dialog on Android)
src/utils/time.ts     to12 / to24 / Date converters
tests/          node --test
docs/handoff/   DESIGN_SPEC.md, INTENDED_PURPOSE.md, PRIVACY.md, COMPLIANCE_REVIEW.md, PROMPT_update_1.md, PROMPT_update_2.md, PROMPT_SYNC_ALL.md, START_HERE.md, reference/
```

## Guardrails followed (INTENDED_PURPOSE.md)

No scoring, no mood storage, no generated advice. The Home picker is a sort over clinician-written tasks (quickest,
clinician-tagged quiet, longest, next) and is never stored, shown to the clinician or charted. Progress is counts of
records only. Crisis information is static. Free-text fields carry the "not monitored in real time" note.

## Not in this phase

Backend (Supabase, Sydney; RLS; audit log; single-use invites; psychologist MFA), remote push, real accounts,
EAS builds and store listings — see Prompts 4 and 5 in the handoff's START_HERE. Sample data, dates and the
psychologist/client names are mocks. The privacy policy and collection notice texts are drafts for legal review.
