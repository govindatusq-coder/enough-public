# Load Bear: product and technical specification

A description of Load Bear as built (build `8b521cb`, November 2026), detailed enough to rebuild it on another platform. Where something is switched off or untested, it says so.

---

## 1. What it is

Load Bear carries the mental load for busy parents in Australia. The parent tells Bear anything they need to remember or do, by typing, speaking, a photo, a screenshot, a PDF, a pasted email or a link. Bear then:

1. works out each separate responsibility in it;
2. gives each a clear, action-led title;
3. files it under one of six life areas;
4. gives it a traffic light (urgent, coming up, can wait) and a timeframe;
5. prepares what it can (draft replies, calendar holds, shopping lists, form steps, a filled-in PDF form);
6. reminds the parent at a sensible time.

**Bear never sends, books, pays or submits anything.** It prepares, and the parent acts.

Tagline: **"Your mental load is ours to bear."** The character is **Mama Bear**: a navy bear in a red polka-dot bandana and a mustard top, flexing an arm, in a Rosie-the-Riveter style. Voice: warm, brief, capable, Australian English, no emoji, no jargon.

---

## 2. Visual design

### Colours (design tokens)

| Token | Value | Use |
|---|---|---|
| navy / ink | `#102A43` | text, dark buttons, the person's own chat bubbles |
| coral | `#FF5147` | primary buttons, the + Bear button, microphone |
| mustard | `#FFB72B` | accents, underline under "Welcome" |
| teal | `#18B7AA` | secondary accent |
| blush | `#FF9FA3` | soft accent |
| cream | `#FFF7E8` | page background base |
| ink-2 / ink-3 | navy at 72% / 52% | secondary and tertiary text |
| line | navy at 10% | borders |
| tints | sky `#CFE7F7`, lavender `#E4DDFB`, mint `#D6F3EF`, mustard-tint `#FFEFC9`, coral-tint `#FFE1DE`, blush-tint `#FFE6E7`, teal-tint `#D5F3F0` | backgrounds of tiles and cards |
| traffic light | red `#E5484D`, amber `#F5A524`, green `#30A46C` | 5 px left border on task cards |

Area accent colours (accent / tint):

| Area | Accent | Tint |
|---|---|---|
| Work | `#2F7DB8` | `#E3F1FB` |
| Family | `#E8505B` | `#FFE6E7` |
| Home | `#C98A00` | `#FFEFC9` |
| Money | `#118F85` | `#D5F3F0` |
| Health | `#E5603F` | `#FFE1DE` |
| Me | `#7A63D1` | `#E4DDFB` |

### Type

- **Display:** Archivo Black (headings, greeting banner).
- **UI:** Inter (everything else).
- **Hand:** Caveat (the big "Welcome, Name!" and small playful lines).

### Shape and feel

- **"Liquid glass" surfaces:** white at 62–80% opacity with a white border and a soft navy shadow (`0 10px 30px -18px`).
- **Corner radii:** 28 / 22 / 16 / 12 px. Pills are fully rounded.
- **Motion:** gentle spring easing; nothing flashy.
- **Layout:** mobile first (designed at 390 px), respecting safe areas. Touch targets are at least 44 px.
- **Illustrations:** painted, flat-colour scenes, one per area (`scene-work`, `area-family`, …), the hero bear (`hero-bear`, with a transparent cut-out version), and onboarding tiles per life domain.

### Navigation

- **Bottom bar:** My Bear, Bear Ideas, a large coral **+ Bear** button in the middle, My Wins, Settings.
- **The + Bear chat screen has no bottom bar.** It links out with "Everything Bear's holding ›", which opens My Bear, and offers page buttons when a chat ends.

---

## 3. Screens

| Route | Screen | What it does |
|---|---|---|
| `/bear` | Router | Not signed in: Welcome. Not onboarded: Onboarding. Otherwise: **+ Bear chat** (the first screen). |
| `/bear/welcome` | Welcome | Big hero lockup and the line "Give it to Bear. We'll take care of the thinking, planning and follow-up." Button: "Let's begin" (create account) and a sign-in link. |
| `/bear/signin` | Sign in / create | Email and password (Supabase Auth); email confirmation link. |
| `/bear/onboarding` | Onboarding, 6 steps | "What's yours to carry?" (9 picture tiles: Kids, Home, Work, Money, Health, People, Life admin, Pets, Other); "Your life at a glance" (name, household, children's ages, work pattern, country and state; no demographics); "What tends to get you?"; "What would you happily hand over to Bear?"; "How should Bear behave?" (reminder lead time, nudge style, detail level); "Let's get something out of your head" (first real item, or later). Skippable. |
| `/bear/capture` | **+ Bear chat** (home of the app) | See section 4. |
| `/bear/capture/more` | Other ways in | Text box, plus a fold: "Other ways: say it, photo, screenshot, PDF". Also the landing spot for things shared from other apps. |
| `/bear/home` | **My Bear** | Greeting banner (Archivo, rotating hand-written line, bear art); a "N things need you" pill (the count always matches the list); "How's today?" (Good / Full / Wiped / Chaos) until rated; six **area tiles** with illustrations, an "N current" count and a red number badge when something is overdue; the example-bill card for new users; a "Bear's handling" banner with three numbers (Covered / Waiting / Need you). |
| `/bear/areas/[key]` | Area | Big scene banner, "N current / N done", items grouped by project, rename a project, set importance and role. |
| `/bear/tasks/[id]` | Task | Title, area, date and time, notes; a "Bear's got this" panel (what needs you, what Bear has covered, "Bear's preparation"); "Add the form" (PDF form filling); Add to calendar (.ics); "Why this matters?"; Details; Done / Not important anymore / Delete. |
| `/bear/bills/[id]` | Bill | Biller, amount, due date, payment reference, original document, plan, mark paid. |
| `/bear/verify/[captureId]` | Check what I read | Used when Bear is unsure (mostly bills): each field shown with one specific question. |
| `/bear/sort/[captureId]` | Line them up | A "brain dump" of several projects, ordered. |
| `/bear/ideas` | **Bear Ideas** | Suggestions with "Why this?", Not today / Do it; a red badge count on the tab. |
| `/bear/wins` | **My Wins** | Finished things, savings, by area. |
| `/bear/wishlist` | Wishlist | Big spends parked until affordable, with a check-back date. |
| `/bear/me` | **Settings** | Name; what matters to you; reminders and quiet hours; notifications (push); Bear in Outlook; forward to Bear (off); calendar (off); **Family details**; privacy notice; Delete my data; log out. |
| `/bear/me/everything` | Everything | Every open item by area. |
| `/bear/privacy` | Privacy | A plain-language notice (not yet legally reviewed). |
| `/bear/outlook`, `/bear/outlook/help`, `/bear/outlook/connect` | Bear in Outlook | The Outlook add-in task pane, install help, and sign-in popup. |
| `/bear/share` | Share target | Receives text or a link shared from another app and puts it in the chat box. |
| `/bear/tour` | How Bear works | A 5-card tour: Give it to Bear / Bear sorts it out / Only what needs you / Ideas that save a thought / Tell Bear when it's done. |

---

## 4. The + Bear chat (the core)

### Layout

- **Before the first message:** a large cut-out bear on a coral circle; "Welcome, {first name}!" in Caveat with a mustard underline; "I've got you. What do you need me to take care of today?".
- **After the first message:** the bear and greeting shrink into a small header, and the conversation fills the screen.
- **Docked at the bottom:** a white pill box ("What do you need to do?", then "Anything else?") with a coral **microphone** that is always present, and a send arrow that appears once there is text.
- **Under the box:** "Add photos or a file" and "Everything Bear's holding ›".
- **Messages:** the person's messages are navy bubbles on the right; Bear's are white bubbles on the left. The newest scrolls into view.

### What happens to a message

```
person's input
 ├─ photos / PDFs ...................... TRIAGE (vision, one pass)
 ├─ pasted or forwarded email, or text > 700 chars .. TRIAGE (text)
 ├─ a link on its own .................. read the page (web fetch) → one task per event
 └─ anything else (typed or spoken) .... CHAT AI (Claude with tools)
      ├─ small talk / thanks / "no" / venting / "what is this app?" → replies, adds nothing
      ├─ things to do → tool add_tasks → task cards
      ├─ a question about the world or a link → web_search / web_fetch → answer + source
      │     then "Want me to remind you?" → yes → add_tasks with the found date
      ├─ a correction ("actually the dentist is urgent") → tool change_task
      └─ unclear → ONE short question
 If the AI is unavailable: the rule-based fallback (section 6), which never turns chatter into tasks.
```

### Replies Bear can give

- **Task cards**, grouped under 🔴 Urgent / 🟠 Coming up / 🟢 Can wait. Each card shows:
  - an action title;
  - the area, the family member and a timeframe;
  - for triage cards, what Bear prepared, with draft buttons: Open in email, Copy, Open in Messages, Add to calendar, a list to buy or pack, and steps.
- **For several items:** "Want me to get started?" with **Looks good, Bear** and **Change something**. A single item needs no confirmation.
- **"I looked it up."** An answer with a source link, and **Remind me for {date}**. Nothing is saved until tapped.
- **One question** when a picture can't be understood: "I think this is about X. What do you need to do, and by when?" The answer becomes the task, with the picture attached. Bear never asks a second question.
- **"Anything else?"** after each settled turn. Saying "no", "that's all" or "thanks" ends the chat with "All sorted. I'm here whenever you need me." plus buttons for My Bear, Bear Ideas, My Wins and Settings.
- **Progress while reading files**, advancing on a timer: "Reading layout & dates…", then "Matching family profile…", then "Drafting 90% done cards…".
- **AI Reasoning drawer** on each triage card, shown only after opening the app with `?debug=1` (and hidden again with `?debug=0`).

### Voice

- Uses the browser's speech recognition (en-AU) when available; the transcript goes in the box.
- Where the browser has none, the microphone focuses the box and says: "Tap the microphone on your keyboard."

### Photos

- **On the phone:** resized to at most 1600 px wide, as JPEG at 0.85, with white behind transparent parts. Up to 6 files share a 3.2 MB budget, because the server accepts about 4.5 MB per request.
- **No text extraction:** nothing reads text out of the picture on the phone or server. The image itself goes to the AI.

---

## 5. AI pipelines (all on Anthropic Claude)

**Model:** `BEAR_MODEL`, default `claude-opus-5-5`. Thinking is adaptive (always on for this model).

**One rule across all pipelines: the AI never decides a date by itself.** Fixed rules derive dates from the person's words, and every date the AI gives is checked before it is believed.

### 5.1 Chat (`POST /api/bear/chat`)

- **Request:** `{text, history[≤24 turns], recent[task ids from this chat]}`.
- **The model is told:**
  - what Load Bear is for;
  - today's weekday and date;
  - the parent's name and the children's names;
  - how to tell chat from tasks from questions from corrections;
  - to use at most one question;
  - never to claim it has sent, booked or paid anything;
  - never to invent a date, name or amount;
  - how to answer frustration (say sorry briefly and offer one example of what it can do).
- **Tools:**
  - `add_tasks {tasks:[{original, title, area}]}`. `original` must be the person's own words, date words included. Dates come from `original` by rules. A title naming a person never mentioned is replaced by the rule-based title.
  - `change_task {task, priority: urgent|coming up|can wait|null, area|null, due|null}`. Can only change tasks added in this conversation.
  - `web_search` (server tool, at most 3 uses, user location AU) and `web_fetch` (at most 2 uses, at most 40k tokens per page).
- **Request settings:** effort `low`; server-side fallback to a backup model on refusal (beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`).
- **On a rejected request,** it retries plainly: first without the fallback option, then without web tools and strict schemas.
- **On failure,** it returns `{fallback:true, reason, code}`, and the app uses its rule-based reading.
- **Limit:** 150 chat calls per person per day.

### 5.2 Triage (`POST /api/bear/triage`)

For photos, PDFs, and pasted or forwarded emails.

- **Request:** `{inputs:[{kind:image|pdf|text, mime, data(base64 data URL)}], currentDateTime, timeZone, familyProfile}`. The server uses its own stored date, time zone and family; the values sent by the client are hints only.
- **Email cleaning** (`cleanEmailInput`):
  - strips HTML, CSS, scripts and tracking pixels, and decodes entities;
  - turns `<li>` into "- " lines and table cells into " | ";
  - removes a forward's header block but **keeps the forwarded message**;
  - cuts quoted history ("On … wrote:", "Original Message", `From/Sent/Subject` blocks, ">" lines) and phone signatures.
- **Anchors in the system prompt:**
  - "Today is {Weekday} {YYYY-MM-DD}, {HH:MM} local time ({IANA zone})";
  - the parent's first name;
  - the family profile: name, relation, age, year level, school, allergies, notes.
- **Strict JSON schema** (closed objects, every property required, nullable fields as `["string","null"]`):

```
reasoning_scratchpad  (FIRST: document type and sender; every date resolved to YYYY-MM-DD;
                       family match; explicit and implicit tasks; what Bear can prepare)
source_summary
action_cards[]:
  card_id, family_member|null, action_type (email_reply|sms|calendar_hold|shopping_list|form|payment|booking|task),
  urgency (red|amber|green), hard_deadline (YYYY-MM-DD)|null, card_headline, ai_work_completed,
  execution_payload { email{to|null,subject,body}|null, sms{to|null,body}|null,
                      calendar_hold{title,start,end|null,all_day,location|null}|null,
                      shopping_list[]|null, steps[]|null },
  confidence_score (0–1), missing_blocker (one question)|null
```

- **Checks after the AI answers:**
  - a family member not in the profile becomes null;
  - an impossible or implausible deadline (more than 45 days past, or more than 550 days ahead) becomes null and gives the card the question "When is this due?";
  - a bad calendar time removes the hold;
  - duplicate card ids are renumbered;
  - a malformed answer is refused with a plain message.
- **Each card becomes a task** with the draft stored as `task.prepared`. The area is family for a child or partner, unless the card is about health or money.
- **Settings:** effort `medium`. **Limit:** 40 triage calls per person per day.

### 5.3 Older readers (still used as fallback)

- **Single capture reader:** a general fields reader (title, area, when, person, location, steps, items) plus a detailed bill reader (biller, amount, due date, payment methods, reference, category) and a school-notice reader (events, obligations, child).
- **Page events reader:** lists every event on a page, and checks each date against the weekday printed on the page.
- **Web lookup** for "search/look up/find out…", "remind me when X is on" and questions about the world: answers only from pages the search actually returned, and offers "Remind me" only for a future date a source states.

---

## 6. Rule-based layer (no AI, deterministic)

- **Splitting:** one message splits into separate things at commas, "and", "then", "also", full stops, new lines and numbered or bulleted lists, but only where a new action or a new "X is due …" clause starts. "Buy milk, eggs and bread" stays one item. Up to 12 items.
- **Titles:** action-led. Filler like "I need to" or "remind me to" and trailing dates are removed, and a missing verb is added: "electricity bill" becomes "Pay the electricity bill"; "dentist" becomes "Book the dentist appointment"; "X form is due Monday" becomes "Complete and return X form". "Remind me when X is on" becomes "Find out when X is on".
- **Dates said** (Australian, in the parent's time zone):
  - today/tonight; tomorrow; the day after tomorrow; "in N days/weeks"; weekdays ("Friday", "next Friday" mean the coming one); explicit dates (day before month; a date more than 30 days past without a year means next year);
  - loose windows such as "this weekend / this week / next week / this month / next month / soon" are kept as the parent's words and **never** turned into a deadline.
- **Areas:** by purpose. Keyword groups are checked in priority order health → money → work → family → home → me. A child named in the profile means family. "Pay …" stays money, and school forms are family.
- **Traffic light** (worked out each time it's shown, so it moves as the date nears):
  - **red:** overdue, due today or tomorrow, or "urgent / asap / final notice / can't wait" (a deadline that has arrived outranks the parent's own "can wait");
  - **amber:** due within 14 days, a window within 14 days, "soon", or no date but the kind of thing that costs if left (bill, reply, RSVP, appointment, prescription, form, renewal);
  - **green:** everything else, including "no rush / whenever / sometime".
  - There is no cap on reds. "Important" never makes something red. The parent's own choice stands until the deadline arrives.
- **Suggested start:** for things needing preparation (forms, reports, parties, packing, gifts) due 3 or more days out, start about half-way, at most 5 days before. For undated quick things in amber, the next weekday 2 days out. Shown as "Suggested: Tuesday", **never saved as a deadline**.
- **Duplicates:** the same title or original words matching an open task is "Already on my list". A date given the second time is taken.
- **Conversation words:** "no / nope / nothing / that's all / all good / I'm done / thanks / bye" close the chat; "yes / ok / sure / hi / test" get "Go ahead…". Nothing is saved.
- **Fallback chatter guard:**
  - questions about the app get an explanation with examples;
  - swearing or frustration gets "Sorry, I've let you down there…";
  - a message with no action word, nothing recognisable and no list gets "I'm not sure that's something for me to do…".
- **Household questions never go to the web:** "where is the permission form", "who is picking up Ava", "what's on my list", and anything naming the parent's own child.

---

## 7. Reminders and notifications

- **Planned per task:** quiet hours default to 9:30 pm–7 am. Day mode Wiped or Chaos holds non-essential reminders. A gentle "nudge" kind exists. A task repeatedly put off gets "This keeps getting pushed back. Want Bear to make it easier?"
- **Delivery:**
  - **In app:** the list on My Bear, always.
  - **Web push:** VAPID keys are derived on the server from a secret it already holds (`BEAR_SERVER_SECRET` or the AI key), unless `BEAR_VAPID_*` keys are set.
  - **Who sends it:** a server-owned "delivery account" in the database keeps a small per-person outbox (titles, dates, reminder wording, push addresses; never documents). It is refreshed whenever the person uses the app.
  - **When:** a GitHub Actions job calls `/api/bear/cron/reminders` every 15 minutes. GitHub actually runs it far less often (hours apart). A run lock per 10-minute window stops double sends.
  - **Rules:** at most one push per task per day; failed sends retry; dead push addresses are removed.
- **iPhone:** push only works once Bear has been added to the Home Screen from Safari.
- **Status:** push delivery is unverified on a real phone.

---

## 8. Other functions

- **Bills:** read from text or photo; checked field by field when unsure; a reminder plan; mark paid. A paid bill becomes a win, with the saving where defensible.
- **School form filling:** add the school's fillable PDF to a task. Bear fills only verified facts (child, event, date, year level, and parent name, phone, email and address if the parent chose to save them). It **never** fills consent, signature, medical, allergy, emergency contact, photo, payment or tick boxes. The parent downloads it and signs it.
- **Calendar file (.ics)** for any dated task. Outlook calendar creation is built but **switched off** (needs a Microsoft app registration).
- **Bear in Outlook:** an add-in manifest at `/outlook/manifest.xml`. "Give to Bear" sends the open email (and chosen attachments) to Bear; it can open a reply draft.
- **Share to Bear:** text or links from other apps land in the chat box, ready to send.
- **Shopping lists:** ticked over several trips; can be split into purchases.
- **Wishlist:** a big spend asks when it's affordable and is parked off the busy screens.
- **Brain dump:** a page of projects becomes projects with to-dos, lined up.
- **Bear Ideas:** suggestions such as missing expected bills, related areas and helpful habits. Priority and strategic-attention engines rank them.
- **My Wins:** completions, savings, by area.
- **Family details** (Settings): name, child/partner/other, age, year level, school, allergies, notes. Optional, and used by triage.
- **Delete my data:** type DELETE to confirm. It removes every row and stored file; the sign-in is also removed if the service key is set. Bear says honestly if anything remains.
- **Privacy page:** what is kept, who can see it, the AI service used, and Bear's limits.

---

## 9. Data model (Postgres, one row per record, JSON `body` plus index columns, row-level security per user)

Tables (all prefixed `bear_`, each with `id`, `user_id`, `created_at`, `updated_at`, `body jsonb`):

`profiles, areas, people, captures, source_documents, extractions, ai_inferences, user_corrections, projects, tasks, task_dependencies, bills, recurring_expectations, reminders, reminder_interactions, suggestions, completions, wins, value_ledger, behaviour_events, push_subscriptions, responsibility_events, study_responses, connected_accounts`, plus `bear_job_runs` (service role only).

Key records:

- **Profile:** name, onboarding state, areas, people, preferences (reminder lead time, nudge tolerance, detail, tone), life rhythm (time zone and blocks), quiet hours, day mode, load map, values, form facts, offer groups, **family[]**, tour seen.
- **Project:** area key, title, status, due date, resource documents, bill id, priority, paused.
- **Task:**
  - basics: project, kind, title, status (`open | done | dropped | archived`), due date, due time, location, notes, estimated minutes, effort, for person, items (shopping);
  - planning: importance, reliance, timing (`time_sensitive | flexible`), snoozed until, wishlist;
  - engine and forms: load graph (responsibility engine), prepared form;
  - **sorted** (`originalInput`, `via`, secondary areas, urgency words, deadline source `stated | web`, window, suggested start, next action);
  - **light** (the parent's own traffic light);
  - **prepared** (triage action type, member, work done, blocker, confidence, payload).
- **Reminder:** task, bill, kind (`planned | deadline | nudge`), status (`scheduled | snoozed | delivered | cancelled …`), scheduled for, plan, delivered via (in app / local / push), attempts, message.
- **Capture → SourceDocument → Extraction:** what was given, the stored original (a private storage bucket, under the owner's folder), and what Bear read (kind `bill | task`, general fields, bill fields, school reading, questions).
- **AIInference:** service (`Chat | Triage | WebLookup | CaptureUnderstanding…`), model, latency, ok or error, token use. **Never the person's content.**

---

## 10. API (all under `/api/bear`, signed-in, JSON; writes must come from the app's own origin)

- **Core:** `captures` (POST text or multipart files), `captures/[id]` (`keep | reject | answer`), `chat`, `triage`, `sort` (POST accept a found reminder; PATCH change a sorted item), `home`, `everything`, `areas/[key]`.
- **Tasks:** `tasks/[id]` (and `complete, drop, reopen, later, notes, area, importance, reliance, plan, steps, items, split, breakdown, estimate, afford, form, calendar, why, proposal, read, nudge, load`).
- **Bills:** `bills/[id]` (and `plan`), `bills/confirm`.
- **Ideas and wins:** `ideas` (and `act, seen, count, capacity`), `suggestions` (and `respond`), `wins` (and `[id]/saving`), `wishlist`.
- **Profile and data:** `profile` (GET/PUT), `values`, `timezone`, `push` (subscribe), `reminders/delivered`, `reminders/interact`, `me/data` (DELETE all), `documents/[id]` (stream the original).
- **Operations:** `cron/reminders`, `health` (secret-protected, counts only), `version`.
- **Switched off by default:** `inbound/*` (forward-by-email), `calendar/*` (Outlook calendar), `decide`, `study`.

---

## 11. Platform and configuration

- **Original stack:** Next.js 16 (App Router, React 19, TypeScript), Supabase (Postgres, Auth, Storage), Vercel (Sydney region), Anthropic SDK, pdf-lib, web-push, Zod. Also a Capacitor iOS shell and an Outlook add-in.
- **Environment variables:**
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
  - `ANTHROPIC_API_KEY`, `BEAR_MODEL`;
  - `BEAR_WEB_LOOKUP` (`off` disables web search, links and lookups);
  - optional: `SUPABASE_SERVICE_ROLE_KEY`, `BEAR_CRON_SECRET`, `BEAR_VAPID_PUBLIC_KEY`, `BEAR_VAPID_PRIVATE_KEY`, `BEAR_VAPID_SUBJECT`, `BEAR_SERVER_SECRET`, `NEXT_PUBLIC_BEAR_SUPPORT_EMAIL`, `BEAR_PRICE_*`;
  - feature flags `BEAR_*_ENABLED`.
- **Limits:**

| What | Limit |
|---|---|
| Captures | 60 per person per day |
| Chat | 150 per day |
| Triage | 40 per day |
| Web lookups and links | 20 per day |
| Upload | about 4.5 MB per request |
| Any single file | 10 MB |

---

## 12. Rebuild checklist

1. Six areas, the colour tokens and the three fonts. The bear art is needed: hero bear (with a transparent cut-out), area scenes and onboarding tiles.
2. Auth, and a per-user data store with the records in section 9.
3. **+ Bear chat** as the first screen, with the docked box, an always-present microphone, file attach, conversation bubbles and the reply types in section 4.
4. The chat AI with the `add_tasks` and `change_task` tools, web search and fetch, and the system prompt rules in 5.1.
5. Triage with the strict schema (reasoning first), email cleaning, date and family anchors, and the card checks in 5.2.
6. The deterministic rules in section 6: splitting, titles, dates, areas, traffic light, suggested start, duplicates, and the chatter guard.
7. My Bear, Area, Task, Settings (including Family details), Bear Ideas and My Wins.
8. Reminders: quiet hours, at most one push per task per day, an in-app list and push.
9. Honesty rules: Bear never claims to have sent, booked, paid or submitted anything; it never invents a date, a name or an amount; it asks at most one question; it never guesses.
