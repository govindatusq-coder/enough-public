# Handoff: Righto — homework companion app (client + psychologist)

## Overview
Righto helps psychologists send homework to clients and helps clients actually do it. A client gets an alert, chooses how to start (**Do it now**, **Set a commitment**, **Set a goal**, or **Nothing for now**), gets reminders tied to their routines or chosen times, checks in, records what they learned, and decides whether to repeat it or make it daily. The psychologist assigns tasks with a rationale, can suggest a commitment or goal from session, and sees a small dashboard of follow-through.

Target: **React Native + Expo (iOS and Android), one codebase.** Privacy requirements are in **`PRIVACY.md`** and medical-device guardrails in **`INTENDED_PURPOSE.md` — both are part of the spec.** Build from **`reference/Righto App v3.dc.html`** (v2 kept for history); where v3 differs from this README (Home prompt, support sheet, psych switch), v3 and INTENDED_PURPOSE.md win.

## About the design files
`reference/Righto App v2.dc.html` is a **design reference built in HTML** — a working prototype showing the intended look and behaviour. It is not production code. Recreate it in React Native/Expo. To view it, open the file in a browser (keep `support.js` and `assets/` beside it). The bar above the phone has "Client view / Psychologist view", "New homework alert", "Routine reminder" and "Reset" to explore states.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, glass effects and copy are final. Match pixel-for-pixel at a 390 × 844 pt reference (iPhone 14/15). Tokens are in `theme.ts`.

## Recommended stack
- Expo SDK (latest), TypeScript, **expo-router** (stack + tabs)
- **expo-blur** (`BlurView`) for glass; **expo-linear-gradient** for overlays
- **expo-font** / `@expo-google-fonts/newsreader`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/ms-madi`
- **phosphor-react-native** icons, weight `light` (selected tab icons `fill`)
- **expo-notifications** (local scheduling for routines/goals), **expo-local-authentication**, **expo-secure-store**
- **react-native-reanimated** for the timer ring, toast and sheet
- Backend: Supabase (Sydney region) with Row Level Security, or equivalent AU-hosted (see PRIVACY.md)
- State: Zustand or React Query + server

---

## Global visual system
- **Background (every client screen):** `assets/background-coast.webp`, cover, blurred 3px, extended 12pt past edges. Over it: photo tint gradient then cream wash (`theme.background`). Result: soft cream top, coast visible lower down.
- **Glass card:** BlurView (light, ~24 blur, 1.5 saturation) + 115° gradient `#fbf8f142 → #f6e7d61f (60%) → #fbf8f133`, 1px `#ffffffa8` border, radius 22 (26 on calm Home), shadow navy 8% / 35 blur / y 8, 1px inner white highlight on top edge.
- **Navy feature card:** 120° gradient `#0f2746e8 → #0f2746c4` over the same photo (centre 45%), radius 22, cream text, kickers in `#F6E7D6`.
- **Primary button:** height 54, radius 40, fill `#0F2746`, text cream, Newsreader 500 17, icon 20 left of label, shadow navy 12% / 18 / y 6.
- **Secondary button:** height 48–54, radius 40, fill `#fbf8f170`, 1px `#0F274640`, text navy.
- **Text button:** no fill, Newsreader 400 16, `#0F2746` or `#4B5B70`; pressed bg `#fbf8f160`.
- **Chips (single-select):** min height 44, radius 24, padding 8/16, Newsreader 16; selected = navy fill + cream text; unselected = `#fbf8f170` + 1px `#0F274633`.
- **Kicker:** DM Sans 500 11, letter-spacing 2.2, uppercase, `#4B5B70`.
- **“?” and “i” buttons:** 22pt circle, `#fbf8f1a0` fill, 1px `#0F274633`, Newsreader 14 (“i” italic 500), 44pt hit area. On navy cards: transparent, 1px `#FBF8F166`, cream text. “?” opens **Why** sheet, “i” opens **About** sheet.
- **Status dots (22 / 20pt, 1.25px navy ring):** done = navy fill + bold check; partly = left half navy; not today = `#0f274626` at 45% opacity; to do = dashed ring.
- **Back row:** top 52, “‹ Back” text button (caret 18, Newsreader 16).
- **Bottom action bar:** padding 12 / 18 / 34 (home-indicator safe).
- **Tab bar (client: Home, Journal; psych: Clients):** floating pill centred 28pt above bottom, glass (`theme.glass.tabBar`), buttons 48 high, padding 0/20, radius 40, selected = navy fill + cream + filled icon.
- **Toast:** top 58, inset 14, glass, check-circle icon, auto-hide 3s.
- **Bottom sheet:** inset 10, radius 30, near-opaque cream glass, scrim `#0F274640` + 2px blur, close X top right, “Got it” secondary button.
- **Focus:** 2px navy outline, offset 3 (accessibility focus).
- Fonts: Newsreader is used for headings **and** body. DM Sans only for kickers. Ms Madi only for logo/name/celebration lines.

---

## Screens — Client

### 1. Opening screen (splash)
Full-bleed photo (centre 60%) with cream fade from top (`theme.background.splashTint`). Centred stack, nudged 60pt above centre: logo “righto” Ms Madi 104 + 12pt champagne dot `#D8B48E` after it (baseline), 22pt gap, tagline **“YOUR WAY FORWARD.”** DM Sans 500 12, letter-spacing 4, two lines (“Your way / forward.”), line height 2. Auto-advances to Home after 2.2s or on tap. First launch: go to Consent (PRIVACY.md §3) instead.

### 2. Home — **Mindful start (chosen direction, prototype `homeVariant="mindful"`)**
Padding 26 sides. Header row (top 58): logo Ms Madi 30 + 5pt dot; right “Monday” Newsreader 15 slate.
Scroll content (top 44, gap 30):
- Greeting: “Good afternoon,” Newsreader 28/31, −0.5 tracking; “Sam.” Ms Madi 66.
- Calm line (italic 17, slate, 16 above): before mood → “Take a breath. There’s nothing you need to do this second.”; after → “Take a breath. One small step is enough today.”
- Session line (10 below, Newsreader 15 slate, calendar-blank icon 17): “Your next session is Monday 20 Oct.”
- **Mood card** (glass, radius 26, padding 24, gap 16): “How are you feeling right now?” serif 22; 4-column grid of mood buttons (Low – cloud, Tense – wind, Okay – circle, Good – sun), each min 84 high, radius 20, `#fbf8f150` + 1px `#ffffffa8`, icon 24 steel, label serif 15. “Skip for today” italic text button.
- After a mood is chosen, the card is replaced by the **Next step card** (glass, radius 26, padding 26/24/22, gap 12): kicker (by mood: Low “LET’S KEEP IT SMALL”, Tense “SOMETHING SETTLING FIRST”, Okay/skip “YOUR NEXT SMALL STEP”, Good “NICE. HERE’S YOUR NEXT STEP”), task title serif 28, sub italic 16 slate, row: primary “▶ Start” (or “Have a look” for new tasks) flex 1 + text button “Something else” (returns to mood card).
  - Selection: Low → shortest pending task; Tense → breathing task if pending else shortest; Okay/Good/skip → current-routine task first, then new homework, then others.
- New homework line (if any, and not already the next step): 7pt champagne dot + “Dr Chen sent you something new. *Have a look when you’re ready.*” (underlined, 40% navy underline). Opens New task.
- All done: Ms Madi 46 “You’ve done enough for today.” + serif 16 “Rest, or look back over your journal.”
- **No countdown labels, no “?”/“i” on Home.**
- Alternatives kept in the prototype for reference: `one` (single next-step card + “See everything for today”), `quiet` (routine groups with only the current one open), `busy` (original dense layout — do not build).

### 3. New task (from alert or Home)
Back “‹ Home”; top-right “?” and “i”. Content (padding 18, gap 14):
- Kicker with champagne dot: “NEW FROM DR CHEN · TODAY”; title serif 34; meta “About 2 min · Your phone’s notes app”; quiet line italic 15 with calendar icon “Before Monday’s session”.
- “What to do” glass card (kicker + serif 17 body).
- If psychologist suggested something: navy card — kicker “DR CHEN SUGGESTS A COMMITMENT / A GOAL”, sentence serif 19, “From your session. You can change any of it.”
- “How would you like to start?” serif 21, then a glass list (rows 72 high, hairline dividers):
  - **Do it now** — “About N min. We’ll start a timer.” (play)
  - **Set a commitment** — “Link it to something you already do, like your morning coffee.” (link)
  - **Set a goal** — “Spell out exactly what, how much and by when, with your own reminder.” (target)
  - Each row: 42pt icon circle (`#fbf8f1a0`, or navy with cream icon if suggested), label serif 18, sand “Suggested” pill if applicable, sub 14 slate, caret.
- Bottom: text button **“Nothing for now”** (500 17) + caption “We’ll check in again in a few days.” → task moves to **Later** and a local nudge is scheduled +3 days.

### 4. Set a commitment (When · Where · How)
Header right kicker “WHEN · WHERE · HOW”. Pinned navy preview card: kicker “YOUR PLAN” (+ “ · EVERY DAY” if daily), sentence serif 20 with chosen parts in sand: “{After I finish lunch}, I will {walk for 10 minutes}, {around the block near work}.” + italic “To make it easier, I’ll {keep my trainers under my desk}.”
Sections (gap 22): **When** — glass list of 3 routines (icon, anchor serif 17, “Lunch break routine · around 12:30 pm”, check-circle / circle); **Where**, **How**, **Make it easy** — chip groups (last includes “Nothing needed”). Options come from the task (psychologist-entered + defaults). Bottom: “Next: confirm your commitment →”.
Routines (v1 fixed, later user-editable): Morning coffee “While my coffee brews” 7:30 am (coffee); Lunch break “After I finish lunch” 12:30 pm (fork-knife); Evening wind-down “After I brush my teeth” 9:30 pm (moon).

### 5. Your commitment
Back “‹ Edit plan”. Kicker “COMMITMENT”, title “Your commitment”. Navy card (160° gradient, radius 24, padding 22): Ms Madi 46 “I commit,” (sand), sentence serif 23, italic prep line, divider `#FBF8F133`, signature row: Ms Madi 30 “Sam Patel” + kicker date. Bell line: “We’ll nudge you around 12:30 pm, when your lunch break usually starts.” Checkbox “Share my commitment with Dr Chen” (default on). Primary **“Make this commitment”** (simple tap). → toast “Committed. Added to your lunch break routine.” → Home.

### 6. Set a goal
Header right “Fill example” (prototype only). Kicker “SET A GOAL”, title “Make it specific”, intro (pre-filled note if suggested). Glass card with 5 plain-language questions (label serif 17, input): “What exactly will you do, and where?” / “How will you know you’ve done it?” / “What makes it doable for you right now?” / “Why does it matter to you?” / “When will you do it, and until when?”. Second glass card “REMIND ME”: 2×2 time chips (7:30 am, 12:30 pm, 6:00 pm, 8:30 pm) and 7 day circles (M T W T F S S). Primary “◎ Set this goal” disabled (45%) until all 5 answered and ≥1 day. → toast “Goal set. We’ll remind you at 8:30 pm, weekdays.”

### 7. Do it now (timer)
Top-right “?” “i”. Kicker “DOING IT NOW · ABOUT 10 MIN”, title serif 32. Glass card with 150pt ring (conic progress navy on `#0f27461a`, inner cream `#f6efe4`, time serif 40 tabular, sub “ready when you are / remaining / paused / Time’s up”), button “Start timer / Pause / Resume”. “What to do” text = commitment/goal sentence or task detail. Bottom: primary “✓ I’ve done it” → Check-in; text “Not now, see other options” (new tasks) / “Not right now”.

### 8. Check-in
Title “How did it go?”. 3-column outcome tiles (min 112, radius 20): Done (check, mist), Some of it (circle-half, sand), Not today (leaf). Selected = 1.5px navy border + `#fbf8f1b0`. Glass card “WHAT YOU LEARNED · Optional”: “What helped?” (or “What got in the way?” for Not today), “What would you change next time?”. Primary “Save check-in”.

### 9. Keep it going
Skip (top right). Kicker “CHECK-IN SAVED”, Ms Madi 50 “Nice work.” / “That’s okay.”, title “Want to keep it going?” / “Want to try it again?”, body, navy card “YOUR COMMITMENT / YOUR GOAL” sentence. Buttons: primary “Make it part of my daily routine” (or “Keep it as part of my day”), secondary “Repeat it once more”, text “Not for now”.

### 10. Journal
Kicker “JOURNAL”, title “What you’ve learned”. **Progress tile** (glass): big serif 52 count + “of N done or partly done in October”; 12pt segmented bar (one segment per check-in, oldest left, using outcome styles; to-do segments dashed); 4-column legend with counts (Done / Partly / Not today / To do). Below: glass list of entries (date, outcome pill, task title DM 16 500, italic serif 18 quote).

### 11. Lock-screen notifications
Use OS notifications. **Default copy must be generic** — see PRIVACY.md §4. Actions: New homework → “Do it now”, “See options”; Routine reminder → “Done”, “Not today”, “Start”.

## Screens — Psychologist
- **Clients:** logo, kicker “DR MAYA CHEN”, title “Your clients”. Glass rows: 44pt navy initials circle, name serif 21, line, **5pt progress bar** (navy on `#0f27461a`) + “3 of 4 done”.
- **Client review:** “‹ Clients” + primary “+ Assign”. Kicker “HOMEWORK”, name serif 34, “Next session Mon 20 Oct, 10:00 am · in 7 days”. **Homework dashboard** (glass): kicker “HOMEWORK THIS MONTH” + “75% follow-through”; serif 46 count + “of 4 check-ins done or partly done”; 10pt segmented bar; per-task rows (title serif 15, outcome dots 10pt, ratio “2/2”). Then a card per task: “Sent …”, status pill (Not started / Later · date / Commitment · routine / Daily · routine / Goal · time), title serif 23, commitment/goal sentence italic (or “You suggested: …”), latest learning box.
- **Assign homework:** Task, Instructions, **Why this helps** (required, shown on “?”), Takes about (2/5/10/20 min chips), They’ll need (shown on “i”). **“Talked it through in session?”**: chips Let them choose / Suggest a commitment / Suggest a goal → reveals routine + where + how, or the 5 goal questions (psych wording). Note: “Sam gets an alert straight away, then chooses how to start. Anything you suggest is a starting point they can change.” Primary “Send to Sam” disabled until Task and Why are filled.
- Add (not in prototype): set/edit next session date.

## Interactions & behaviour
- Splash → (first launch: Consent → App lock → Notification primer) → Home.
- Task statuses: `new → planned (kind: commitment|goal) | tried | later | finished`. `today` = outcome for today (`done|partial|missed|null`), reset at local midnight.
- “Nothing for now” → `later`, `laterUntil = now + 3 days`, schedule local nudge.
- Commitment reminder = local notification at routine time on routine days (daily if `daily`). Goal reminder = chosen time/days.
- Notification “Done” records a check-in without opening; “Not today” records missed; “Start” opens timer.
- Sheet: “?” → kicker “WHY DR CHEN SUGGESTED THIS” + rationale; “i” → “ABOUT THIS TASK”: What to do, Takes about, You’ll need, Sent by.
- Toasts after commit, goal, send, snooze, save.
- Transitions: native stack push (iOS default), sheet slide-up 250ms ease-out, toast fade/slide 200ms. Timer ticks every second.
- Accessibility: all targets ≥44pt; labels on icon buttons (“Why this task?”, “More about this task”); Dynamic Type up to 130% without truncation; WCAG AA contrast (slate `#4B5B70` on cream passes).

## State / data model (server, AU-hosted)
```ts
User { id, role: 'client'|'psych', displayName, email, consent: {version, at}, settings }
Link { clientId, psychId, createdAt, active }
Session { id, clientId, psychId, startsAt, mode }
Task { id, clientId, psychId, title, detail, why, mins, needs, sentAt,
       status, kind, daily, laterUntil,
       plan?: {routineId, where, how, prep}, goal?: {s,m,a,r,t, rem:{time, days[7]}},
       suggestion?: {kind, plan|goal}, shared: boolean }
CheckIn { id, taskId, date, outcome, helped, next, shared }
Routine { id, name, anchor, time, icon }   // per client, seeded with 3 defaults
Mood { date, value } // device-only unless opted in
```

## Assets
- `assets/background-coast.webp` — background photo (user confirmed reuse; confirm licence).
- `assets/style-guide.png` — brand style guide (colours, script logo).
- Fonts: Newsreader, DM Sans, Ms Madi — Google Fonts, SIL Open Font License (free to bundle commercially).
- Icons: Phosphor (MIT), light weight.
- App icon: navy `#0F2746` rounded square, Ms Madi “r” in cream + 4pt dot `#E6C7A3`.

## Files
- `README.md` — this spec
- `INTENDED_PURPOSE.md` — intended purpose statement and TGA build rules
- `PRIVACY.md` — Australian Privacy Principles build requirements, extra screens, notification copy
- `theme.ts` — design tokens
- `reference/Righto App v3.dc.html` — current reference
- `reference/Righto App v2.dc.html` (+ `support.js`, `assets/`) — interactive HTML reference
- `assets/` — photo and style guide
