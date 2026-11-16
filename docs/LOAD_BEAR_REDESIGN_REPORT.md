# Load Bear redesign: designed for interrupted lives

*Less on your mind. More of your life.*

This report covers what was built for the "interrupted lives, not perfectly planned days" redesign. It says what was verified and what was not, and lists what still needs setting up.

## Implemented

| Brief | What exists now | How it was verified |
|---|---|---|
| Brain Dump home | `/bear/home` greets her by name with Mama Bear. Below that: one box for typing or speaking (the browser's speech recognition; typing always works), My Brain Dump, and My Lists. On desktop the two sit side by side; on a phone they stack in one column. `/bear` now opens here. | Browser walkthrough (`scripts/test-bear-board.mjs`), phone and desktop |
| Extraction | One dump becomes separate items. The original words are stored first, so a failed read loses nothing, and they can be read again. Bear's own reading works without AI; when AI is available it is used only if it found at least as many things as there were lines. Explicit dates are kept. Nothing is invented. Repeats are reported as "already here", never merged silently. Up to 40 items per dump; long dumps are read in pieces. | Unit tests (`tests/bear-board.test.mjs`); browser |
| Reminders-style checklist | Each row has a round checkbox, tap-to-edit title, drag handle and ••• menu: Edit, Move to list, Bear help me, Share Bear, Remind me, Details, Delete. Complete and delete both offer Undo. A delete is held for 6 seconds and still goes through if the app closes. Simple rows, not cards. | Browser |
| No pressure | No unsorted warnings, streaks, counts of what's left or scores. My Wins left the main navigation (it is still in Settings). "Done lately" is folded away and faded. | Code review; browser |
| My Lists | Six starter lists with the exact names and icons from the brief. Lists can be renamed, added, removed, reordered and given a new icon at `/bear/me/lists`. Removing a list sends its tasks back to My Brain Dump and says how many. Lists belong to each person. | Unit and browser |
| Bear suggests, Mum decides | A small pill shows the suggestion, e.g. "🌙 Suggested: Nighttime Tasks". Tap it to accept, × to ignore, or use the menu or drag to choose another list. Nothing is filed automatically. Tasks from before the redesign get suggestions too. | Unit and browser |
| Learning | When she moves something, each topical word in its title is recorded against that list. A learned suggestion ("Usually: …") needs two shared words, or one word she has filed that way twice. Her actual choice always wins. Only choices she made are recorded. | Unit (scenario 7) and browser |
| When I have a moment | "Got a moment? 5 / 10 / 20 min / Some time" offers up to three things that fit the time, worded as "Only if you feel like it", with time estimates marked "about". It skips Aspirational items, anything waiting on someone or needing information, and anything handed over. Phone calls are held back outside business hours (weekdays 9–5, Saturday 9–12, in her time zone), and Bear says so. | Unit (scenario 3) and browser |
| Interruption and resumption | The work page `/bear/help/[id]` saves drafts, notes, steps and "Next step" as she types: to the phone straight away, and to Bear about 0.7 s later. If the save can't reach Bear, the copy on the phone wins next time. Home shows "Pick up where you left off". Unsent brain-dump text survives the app closing. Opening a page and only reading Bear's draft does not count as progress. | Unit (scenario 4); browser (leave and return) |
| Readiness | Worked out for each task: captured, needs information, ready, in progress, waiting, completed, cancelled. It shows only as small tags ("Started · pick up", "With James") and feeds "Got a moment?". | Unit |
| Bear prepares work | **Bear Helps** (`/bear/helps`) lists tasks Bear can get ready, started ones first: a follow-up message, an email or RSVP draft (the drafted email from a read notice where one exists), a text message, call notes with a "Find their number" web search, bill amount and due date, the prepared form, or small steps for bigger jobs. Drafts open in her own Mail or Messages app. **Bear never sends, pays or submits anything**, and the screen says so. | Unit and browser |
| Share Bear | Three ways to share: share information, ask them to do it, hand it over. Bear makes a one-off link that she sends herself. Whoever opens it first (signed in) becomes the recipient, and nobody else can use it. The recipient chooses Accept, Discuss (with a message) or Decline. On acceptance the task appears on the recipient's own list. A handed-over task leaves her lists and its reminders stop. When the recipient ticks it off, she sees it and her copy closes. She can take a share back. The Shared screen shows both directions, and home shows a one-line notice ("James accepted responsibility for …"). | Unit (scenario 5, decline and take-back, privacy) and browser (making the link, opening your own link) |
| Relevant reminders | No new nagging. Reminders come only from dates she gave, or from "Remind me", which she sets per task. Aspirational items get no reminders, and existing ones are cancelled when something moves there. Handed-over tasks stop reminding her. Quiet hours and preferences stay with the existing reminder engine. | Unit (scenario 6) |
| Navigation | Home, Shared, Bear Helps, Settings. Calendar, Your areas (the previous home, now at `/bear/overview`), Bear Ideas and What's been handled are linked from Home and Settings. | Browser |
| Works without AI | Unloading, adding, editing, moving, lists, moments, help pages and sharing all work with no AI key. | Unit (scenario 8); the browser run had no AI key at all |

## Architecture

**Preserved:** sign-in, the responsibility engine (domains, load graphs, traffic lights, dependencies), triage of photos, PDFs and emails, chat, bills, calendar, reminders, the store abstraction, the design system, Mama Bear art, and all existing data. Older tasks show up in My Brain Dump with suggestions.

**Added, without changing the database schema:** new optional fields on tasks (`listId`, `rank`, `suggestion`, `dumpId`, `readiness`, `minutesBy`, `progress`, `sharedOut`, `sharedIn`) and on profiles (`lists`, `listLearning`). Both are stored in the existing JSON body columns, so no migration is needed for anything except sharing. Brain dumps are stored as captures, keeping the original text and status.

**New table:** `bear_shares` (migration `supabase/migrations/20261116120000_bear_shares.sql`):
- Row-level security: only the sender and the claimed recipient can see a row.
- A trigger blocks changes to who a share is between, how it was shared, and its link. Only the sender can take a share back; only the recipient can answer.
- Claiming goes through a security-definer function. Only a SHA-256 hash of the link token is stored.

**Code:**
- `lib/bear/board/logic.ts`: pure rules (lists, suggestions, learning, estimates, readiness, business hours, moments).
- `lib/bear/board/service.ts`: storage.
- `lib/bear/board/help.ts`: prepared work.
- `lib/bear/board/shares.ts`: sharing, with in-memory and Supabase backends.
- Routes under `/api/bear/board/*` and `/api/bear/shares/*`.
- Screens: `app/bear/(app)/{home,help/[id],helps,shared,shared/join/[token],me/lists}`, plus `components/bear/board.tsx`.

**Smaller changes:**
- Small changes from the app are sent with `keepalive`, so a tick or move made just before closing still arrives.
- Sign-in follows a safe `next` path, so a Share Bear link survives signing in.
- "Delete my data" also removes shares she sent and lets go of shares sent to her.
- Bear's own reading now recognises "eventually build …" and similar as separate items.
- Booking an appointment (podiatrist, dentist, GP and so on) is suggested for Phone Calls.

## How the experience differs

| Before | Now |
|---|---|
| Home was a dashboard: area tiles, how's today, things that need you | Home is the place to unload and see the list |
| "+ Bear" opened a chat | You type or speak straight into home; photos, PDFs and the chat stay one link away |
| Bear filed things into areas itself | Bear only suggests; things stay in My Brain Dump until you move them, if ever |
| Time-based planning | "Got a moment?" matches the time you actually have |
| Work restarted from scratch | Drafts, notes and the next step are kept, and home offers "Pick up where you left off" |
| No way to hand things over | Share Bear: information, an action, or the whole responsibility, with accept, discuss and decline |

## Testing

- `npm run verify` (typecheck, lint, all unit tests, the two stress scripts) passed: 723 tests. That includes the 16 new board tests, which cover the eight scenarios in the brief plus lists, ordering, repeats, older tasks and Bear Helps.
- `scripts/test-bear-board.mjs`: a 17-step browser walkthrough at phone width (390 px, touch) plus one desktop step (1280 px), with no AI key. All 17 passed. Screenshots go to `.bear-board-results`.
- `scripts/test-bear-browser.mjs` (the existing 46-step walkthrough of onboarding, bills, triage, chat, calendar, areas and so on) was updated for the new home and navigation. It passed 46 of 46 on a production build (`BEAR_TEST_MODE=start`), with no console errors. The board walkthrough also passed 17 of 17 on the same build.
- Not tested in a browser: a second real account opening a share link. The browser can only sign in as one local user, so the two-person flow is covered by the unit tests instead. Not tested at all: the Supabase policies, trigger and claim function against a real database (see risks below).

## Outstanding work, and what needs setting up

1. **Apply the migration** `20261116120000_bear_shares.sql` in Supabase (SQL editor). Until then Share Bear says "Sharing needs a database update first", and everything else works.
2. Voice uses the browser's speech recognition (Safari on iPhone and Chrome support it). Where it isn't available the Speak button is hidden, and the keyboard's own microphone still works.
3. Share links are passed on by the person: copied, or sent through the phone's share sheet. Bear doesn't send them by email or SMS, and there is no household member list yet; each share is one link to one person.
4. When the recipient accepts, the sender sees it in the app (home notice and Shared screen), not as a push notification.
5. Drafts for emails and follow-ups are Bear's own templates, plus drafts the triage reader prepared from documents. There is no AI drafting from scratch on this screen yet.
6. Time estimates are rules of thumb. She can set her own number, but only through the API so far; there is no field on screen yet.
7. Drag and drop works by pointer, on touch and mouse. Keyboard users move items with the ••• menu (Move to list); there is no keyboard reordering within a list yet.
8. On desktop the navigation is the existing floating bar, not a sidebar.

## Risks

- **Sharing security has not been tested against a real Supabase database.** The policies, trigger and claim function are written defensively but were not run here. They should be checked with two test accounts after the migration is applied.
- The recipient can edit the share's descriptive body (title, notes). This never touches the sender's own task, which is matched only by her own record of the share.
- Learning is word-based and can be wrong. It only proposes; it never moves anything.
- Old tasks all appear in My Brain Dump at once. For someone with many open items this can be a long first list (nothing is lost, and lists can absorb it gradually).
