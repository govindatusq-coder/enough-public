# Lovable prompt — Righto as a web app

Paste the block below into Lovable as the first message. Before you do, attach these files from this repo to the
same message (Lovable reads attachments far more precisely than prose):

- `docs/handoff/reference/Righto App v3.dc.html` — the pixel reference for every screen
- `src/theme.ts` — exact colours, fonts and sizes
- `docs/handoff/INTENDED_PURPOSE.md`, `docs/handoff/PRIVACY.md` — the rules it must not break
- `supabase/migrations/20261016120000_righto_core.sql` and `supabase/migrations/20261016130000_righto_home_prompt.sql` — the database it must use as-is
- `assets/background-coast.webp` — the background photo

Then connect Lovable to the existing Supabase project **righto** (Sydney, `nvszkfxbduokokihsbgx`) through Lovable's
Supabase integration, and tell it not to create new tables. Build in stages (the prompt is written in stages); check each
stage against the reference before asking for the next.

---

```
You are building "Righto", a mobile-first web app for psychologists and their clients. The attached HTML file
"Righto App v3.dc.html" is the single source of truth for layout, copy and look. The attached theme.ts holds the exact
design tokens. Reproduce the reference as closely as the web allows; where this prompt and the reference differ, the
reference wins, except for the five rules marked DEVIATION below.

## 1. What Righto is (and is not)

A psychologist sends a client a piece of homework they agreed in session. The client decides how to start it, gets
reminders, does it, and records what they did and learned. The psychologist sees only what the client chose to share.

Hard rules (from INTENDED_PURPOSE.md, never break these):
- No scoring, no mood tracking, no generated advice, no interpretation. The app shows the clinician's words as written.
- "What feels doable right now?" on Home is a sort over the clinician's tasks. It is never stored, shown to the
  psychologist, or charted.
- Progress is counts of records only ("3 of 5 check-ins done or partly done").
- Crisis information is static text: 000, Lifeline 13 11 14, Beyond Blue 1300 22 4636. Free-text fields carry the
  note "Not monitored in real time."
- Health data lives only in the connected Supabase project (Sydney). No third-party analytics, no other storage.

## 2. Tech

- React + Vite + TypeScript + Tailwind. Single-page app with client-side routes.
- Supabase: connect to the EXISTING project. Do not create tables or policies. Use the tables and SQL functions
  listed in section 7 exactly as named. Row-level security is already on.
- Auth: Supabase email + password, plus "Continue with Google" (Supabase OAuth, provider "google").
  Psychologist accounts must pass Supabase TOTP MFA (aal2) before any client data loads.
- Mobile-first: design at 390px wide. On wider screens centre a 430px column on the cream background; never
  stretch the layout.
- Page changes cross-fade over 380ms (opacity only, no slide).

## 3. Visual system (from theme.ts, use these exact values)

Colours: navy #0F2746 (all text, primary buttons, selected states), cream #FBF8F1 (page ground, text on navy),
sand #F6E7D6 (warm pills), champagne #D8B48E (logo dot), slate #4B5B70 (secondary text), slateLight #5f6c7d,
steel #5E7C96 (light icons), mist #e3eaf0 ("Done" pill), partlyText #7a5a36.

Fonts (Google Fonts): Newsreader 400/500/400-italic for headings AND body; DM Sans 500 only for small uppercase
kickers (11px, letter-spacing 2.2px); Ms Madi 400 for the logo "righto." (with a champagne dot), the client's first
name on Home ("Sam."), "I commit," and celebratory lines.

Type scale: h1 34/37 letter-spacing -1; h2 28/32; card title 25/29; body 17/25; meta 14/19; button 17 medium.

Surfaces:
- Background on every screen: the attached coast photo, blur 3px, with a vertical tint
  #fbf8f180 → #f6e7d6a8 (65%) → #0f274670, then a wash #fbf8f1b0 → #fbf8f138 (45%) → #fbf8f158.
- Glass card: backdrop-filter blur 24px saturate 1.5; gradient 115deg #fbf8f142 → #f6e7d61f (60%) → #fbf8f133;
  1px border #ffffffa8; radius 22 (26 on Home's calm cards); inset highlight 0 1px 1px #ffffffe0;
  shadow 0 8px 35px rgba(15,39,70,.08).
- Navy feature card: gradient 120deg #0f2746e8 → #0f2746c4 over the photo; radius 22; padding 18; cream text;
  secondary text #E9DFD2; kicker #E6C7A3.
- Primary button: navy pill, cream Newsreader 500 17px, min-height 56. Secondary: #fbf8f170 with 1px #0F274640.
  Chip: #fbf8f170 with 1px #0F274633, selected = navy fill with cream text. Inputs: #ffffff4d, 1px #ffffffc4,
  radius 14, min-height 46.
- Tab bar: floating glass pill at the bottom, radius 60; the active tab is a navy pill with cream text.
- Icons: Phosphor icons, "light" weight, size 20–22.

## 4. Shared chrome

- Every inner screen has a header row: a plain "‹ Back" button on the left, the "righto." logo centred.
  DEVIATION 1: the logo always returns to Home (client) or Clients (psychologist). Back goes one step back; on the
  New task screen, if the "Do it later" panel is open, Back only closes the panel.
- Home and Clients have a visible Settings gear (36px circle, #fbf8f1a0, 1px #0F274633) placed to the LEFT of the
  day name in the header.
- "Need support now?" link (Lifebuoy icon) on Home, New task, Do it now, Check-in and Journal opens a sheet with
  000, Lifeline, Beyond Blue and About Righto.
- Toasts: glass pill at the bottom, 2.5s.

## 5. Client screens and flows

Onboarding (first visit): Splash (logo 104px script, tagline "YOUR WAY / FORWARD." in DM Sans 12px spaced 4px,
auto-advance after 2.2s or tap) → Consent → Account → Invite code → Reminders → Home.

5.1 Consent ("Step 1 of 4 · Before you start", h1 "Your privacy"). Glass list of five rows with icons:
"Locked with Face ID or a passcode." / "Stored in Australia. Never sold or used for advertising." / "You choose what
your psychologist sees." / "Not monitored in real time. For urgent help call 000 or Lifeline 13 11 14." /
"Righto doesn't assess, diagnose or treat. It helps you do the homework you plan in session." Links: Privacy policy,
Collection notice (open as sheets). Two checkboxes: "I agree to Righto collecting and storing my health information
so I can share homework with my psychologist." (required) and "Share my check-ins with my psychologist by default. I
can change this each time." (on). Buttons: "Agree and continue", text "Not now". On agree, store consent_version
"2026-10-15" and the time; write them to righto_profiles once signed in.

5.2 Account. Tabs "Create account" / "Sign in". "Continue with Google" button above a divider "or with email".
Create: "I am" chips "Doing homework" / "A psychologist"; Your name; Email; Password (min 8); for psychologists also
Practice and "Ahpra registration" (PSY + 10 digits, shown to clients before linking). A first Google sign-in with no
profile row shows an "About you" step with the same role/name fields. After sign-in: psychologists go to the
two-step (MFA) screen, clients to the invite code (or Home if already set up).

5.3 Invite code ("Step 3 of 5", h1 "Your invite code"). One input for a 10-character code (A–Z, 2–9). "Check this
code" calls righto_preview_invite(p_code) and shows a glass card: initials circle, name, "Psychologist · practice",
"Ahpra registration PSY…", "Single-use invite · expires in N hours". Buttons "Yes, link with <surname>"
(righto_redeem_invite) and "This isn't my psychologist". Text link "I don't have a code yet" skips. Also reachable
from Settings → Privacy & data when not linked.

5.4 Reminders primer ("Step 4 of 4", h1 "Gentle reminders"). Explains that reminders never show the task on the
lock screen; toggle "Show task details in notifications" (off). Preview card of the notification. "Allow reminders"
asks for browser Notification permission; "Not now" skips. Both go to Home and mark onboarding done.

5.5 Home. Header: Settings gear, then the day ("Friday 17 October"), logo at left (tapping it resets the picker).
Greeting "Good morning," / "Good afternoon," / "Good evening," (before 12 / before 18 / after) above the client's
first name in Ms Madi 66px, then the italic line "Take a breath. There's nothing you need to do this second." and
"Your next session is Monday 20 October." (only if the next session is in the future).
Calm card "What feels doable right now?" with four tiles: "Something quick" (Feather icon), "Something quiet" (Wind),
"Whatever's next" (ArrowRight), "I've got time" (Clock). Choosing one shows the next-step card for ONE task:
quick → shortest task; quiet → a task the clinician tagged "quiet", else shortest; time → longest; next → the ordered
next step. DEVIATION 2: the tile on that card always reads "Have a look" and always opens the New task screen,
whatever the task's state. DEVIATION 3: the four tiles must always find something: live tasks are those that are
new, planned, later or tried; if every live task is done today, fall back to all active tasks. "Something else" goes
back to the four tiles. The pick is reset every time Home is shown and is never saved.
If the psychologist has turned the Home prompt off (righto_links.home_prompt = false), skip the four tiles and show
the next step directly, with "Something else" cycling to the next task.
A line "New homework from Dr Chen" with a champagne dot appears when a task is still "new".
Tab bar: Home, Journal.

5.6 New task (route /task/:id). Navy card: kicker "From Dr Chen · about 10 min", title, the clinician's
instructions, and two 22px buttons "?" (opens "Why this helps" sheet with the clinician's "why", verbatim) and
"i" (opens "About this task": takes about, you'll need). Heading "How would you like to do it?" with three
options as glass rows: "Do it now" (→ Do it now screen), "Do it later" (expands a panel in place with two choices:
"With something I already do" → Set a commitment; "At a time I choose" → Set a goal; plus a link "Back to the other
options"), "Something else" (→ Check-in, so they can record what they did instead). There is no "Nothing for now".
If the clinician suggested a start (task.suggestion), show a navy "Suggested" card above with the suggestion text and
a button to accept it, which pre-fills the matching screen.

5.7 Set a commitment (/commit/:id). Sections: When (three routines as radio rows: "While my coffee brews · Morning
coffee 7:30 am", "After I finish lunch · Lunch break 12:30 pm", "After I brush my teeth · Evening wind-down
9:30 pm"), Where (chips from task.where_opts + free text), How (chips from task.how_opts + free text), Make it easy
(chips from prep_opts, "Nothing needed"), Reminder (chip "At the routine time" or a time picker "Choose my own
time"), a toggle "Every day" vs "Just once". A live navy preview card reads "I commit, [anchor], to [how], [where]."
Button "Set this commitment" saves kind "commitment", status "planned", plan {routine, where, how, prep, time}, then
shows Your commitment (/pledge/:id): the pledge in Ms Madi, reminder summary, "Share this plan with Dr Chen" toggle
(default from consent), "Back to Home".

5.8 Set a goal (/goal/:id). Five questions, each with 3 ready-made chips and a fourth "Something else…" that
reveals a text field. DEVIATION 4: the chips are generated from the task: the client's own previous answer or the
clinician's suggestion first, then two sensible options built from the task title, duration and the next session
date. Questions, in order:
 1. "What exactly will you do, and where?"
 2. "How will you know you've done it?"
 3. "What makes it doable for you right now?"
 4. "Why does it matter to you?"
 5. "When will you do it, and until when?"
Then "Which days?" (Mon–Sun chips), "Remind me at" (chips 7:30 am, 12:30 pm, 6:00 pm, 8:30 pm, or own time via a
time picker). Navy preview card. Button "Set this goal" saves kind "goal", status "planned", goal {s,m,a,r,t,days,
time}, then the same share toggle screen.

5.9 Do it now (/now/:id). The task title, the clinician's instructions, a circular timer (SVG ring, navy on
#0f27461a) for task.mins with Start / Pause / "I'm done" (goes to Check-in). "Need support now?" link.

5.10 Check-in (/checkin/:id). "How did it go?" with three big options: Done, Some of it, Not today. "What helped, or
got in the way?" (free text, "Not monitored in real time." note). "Anything to try next time?" (optional). Toggle
"Share this check-in with Dr Chen" (default = share default). Button "Save check-in" inserts righto_checkins and
sets the task's today_outcome and today_date; a task that was new/later/finished becomes "tried". Then
Keep it going (/again/:id): Ms Madi line "That counts." for done/partial or "Tomorrow is fine." for missed, the task's
next reminder, "Back to Home", "Skip".

5.11 Journal. Header with logo. Glass "Homework this month": big count of done-or-partly check-ins "of N
check-ins", a segmented bar (one segment per check-in: Done = mist, Partly = sand, Not today = white 50%), a legend,
per-task rows with dots. Card "Finished homework" listing tasks with status "finished", each with "Try again" (sets
status "tried", clears today). Then the list of check-ins, newest first: date label, task title, outcome pill, the
"helped" text in Newsreader italic. Tab bar: Home, Journal.

5.12 Settings. Rows: account (name, email, role, "stored in Sydney"), "Privacy & data" (›), "Sign out". About text:
"Righto lets psychologists and psychiatrists send homework to their clients. Clients plan when to do it, get
reminders, and record what they did and learned. Clinicians can view what clients choose to share. Righto does not
assess, diagnose, monitor, predict or treat any condition, and it is not monitored in real time."

5.13 Privacy & data. Toggles: "Show task details in notifications" (with live preview), "Share check-ins with my
psychologist by default"; row "“What feels doable right now?” — Stays on this device. Never stored, scored or
shared."; the linked psychologist card (name, practice, Ahpra) with "Unlink" (righto_end_link) or, when not linked,
"Link with a psychologist" (› invite code); "Download my data" (righto_export_me → JSON download); "Delete my
account" (two-step confirm, text: "Your homework, plans and check-ins are deleted from this device now and from
Righto's servers within 30 days (backups within 35 days). Your psychologist keeps their own clinical record." →
righto_delete_me, then sign out); Privacy policy, Collection notice, "Contact privacy officer privacy@righto.app";
footer "Consent v2026-10-15 · date".

## 6. Psychologist screens

6.1 Two-step sign-in (/mfa). If no TOTP factor: enrol with supabase.auth.mfa.enroll, show the QR code and the
manual key, a six-digit input, "Verify". If a factor exists: six-digit input only. "Sign out" link. Clients never
see this.

6.2 Clients (/psych). Header: logo, Settings gear. Kicker with the psychologist's name, h1 "Your clients".
Button "Invite a client" → righto_create_invite → modal showing the 10-character code, "works once and expires in
48 hours", and a Copy button. List from righto_my_clients(): initials circle, name, line ("Checked in Fri 10 Oct ·
next session Mon 20 Oct"), a 5px progress bar and "3 of 5 done" (checkins_done / checkins_total), chevron.
Tab bar with just "Clients".

6.3 Client review (/psych/:id). Header "‹ Clients", logo, "Assign" primary button on the right. Kicker
"Homework", h1 client name, "Next session …" line, "Your access to this record is logged" (ShieldCheck).
Dashboard glass card: "Homework this month", "Recorded by <first name>", big count, segmented bar, per-task rows.
Glass row "Ask “What feels doable?” on Home — Lets Sam pick a small, quiet or longer task first. Not scored or
shared." with a toggle (righto_set_home_prompt). Buttons "Export to notes" (builds a plain-text summary of shared
items, copies/downloads it, logs via righto_log_access 'export_record') and "End sharing" (confirm → righto_end_link).
Task cards: "Sent <date>", status pill (New / Planned / Tried / Later / Finished), title, and either the shared plan
in italics with a HandHeart icon, "Sam chose not to share the plan.", or "Waiting for Sam to choose how to start."
Below a task, the latest shared check-in as "Latest learning · date" with the text in quotes. All data comes from
righto_client_record(p_client); never query righto_tasks or righto_checkins directly as a psychologist.

6.4 Assign homework (/psych/:id/assign). Glass form: Task (required), Instructions, "Why this helps" (required; hint
"Sam sees this when they tap “?”. Righto shows your words as written and never generates advice."), "Takes about"
chips 2/5/10/20 min, "They'll need" (optional, "Shown when they tap “i”."), "Tag it" chips Quick / Quiet ("Used only
to sort when Sam picks “Something quick” or “Something quiet”."), "Talked it through in session?" chips "Let them
choose" / "Suggest a commitment" (then When routine radios, Where, How) / "Suggest a goal" (then the five questions
in clinician wording: "What exactly will they do, and where?", "How will they know it's done?", "What makes it doable
right now?", "Why does it matter to them?", "When, and until when?"). Note with a Bell icon: "Sam gets an alert
straight away, then chooses how to start. Anything you suggest is a starting point they can change." Button
"Send to Sam" inserts into righto_tasks (client_id, psych_id = auth user, title, detail, why, mins, needs, tags,
suggestion, suggest, where_opts, how_opts, prep_opts).

## 7. Database (already exists; use as-is)

Tables (all with RLS): righto_profiles (user_id, role 'client'|'psych', display_name, consent_version, consent_at,
settings), righto_psychologists (user_id, title, practice, ahpra), righto_links (id, client_id, psych_id, active,
home_prompt, created_at), righto_invites, righto_sessions (client_id, psych_id, starts_at, mode), righto_tasks (id,
client_id, psych_id, title, detail, why, mins, needs, tags text[], suggestion jsonb, suggest, where_opts, how_opts,
prep_opts, sent_at, status 'new'|'planned'|'tried'|'later'|'finished', kind 'commitment'|'goal'|null, daily, plan
jsonb, goal jsonb, later_until date, today_outcome 'done'|'partial'|'missed'|null, today_date, shared),
righto_checkins (id, task_id, client_id, outcome, helped, next, shared, created_at), righto_access_log.
Clients may update only status, kind, daily, plan, goal, shared, later_until, today_outcome, today_date on their own
tasks. Psychologists cannot SELECT tasks or check-ins directly.

RPC functions (call with supabase.rpc): righto_create_invite() → {code, expires_at}; righto_preview_invite(p_code);
righto_redeem_invite(p_code) → link id; righto_end_link(p_link); righto_my_psychologist(); righto_my_clients();
righto_client_record(p_client) → jsonb {client, tasks, checkins, sessions}; righto_set_home_prompt(p_client, p_on);
righto_log_access(p_client, p_action); righto_export_me(); righto_delete_me(); righto_setting(p_key).

Client-side rules: at local midnight clear today_outcome on every task. A task with status "later" is shown again
after later_until (3 days). Reminders: use the Web Notifications API when allowed; copy when details are hidden is
"Righto — Time for your morning coffee routine." / "You have something new from your psychologist." / "A gentle
reminder for today."; with details on, "Righto · <title> — After I finish lunch? Walk for 10 minutes, around the
block."

## 8. Build order

Stage 1: design system + Splash, Consent, Account (email + Google), Home with sample data, New task, Journal,
Settings. Stage 2: Commitment, Goal, Do it now, Check-in, Keep it going, Privacy & data. Stage 3: Supabase wiring for
clients (profile, invite code, tasks, check-ins, export, delete). Stage 4: psychologist side (MFA, Clients, Invite a
client, Client review, Assign). After each stage, compare every screen with the attached reference and list the
differences before moving on.
```
