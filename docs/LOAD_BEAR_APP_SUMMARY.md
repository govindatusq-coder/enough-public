# Load Bear: the app as it is

*Summary as of 23 November 2026.*

## What it is
Load Bear carries the mental load for busy parents, mainly working mothers in Australia. She tells Bear what's on her mind,
by typing, talking, or sending a photo, PDF or forwarded email. Bear sorts it, plans it, reminds her at the right time,
and does what it safely can to get it done. The promise: *"Your mental load is ours to bear."*

- **Live web app:** https://enough-public-zuue.vercel.app/bear
- **iPhone:** a TestFlight app that wraps the live web app, so web changes reach it without a new build.
- **Marketing site:** https://getloadbear.app, a separate site that the app links to.

## The three tabs
Navigation has three tabs. Settings is the gear in each screen's header.

### 1. Drop Bear: get it out of your head
- **One big box.** Type, tap the microphone to talk, or attach photos and PDFs.
- **Photos of lists, notes and letters.**
  - Bear writes down every line first, including messy ones. Each line becomes its own task.
  - Crossed-out and ticked lines are left out.
  - Lines it can't read clearly are still filed, with a question asking her to check them.
  - Long lists (40+ lines) are handled.
- **While Bear works,** a card shows the steps (reading, working out what needs doing, filing) and the seconds ticking.
- **When it's done,** a list shows everything Bear caught, with **Back to Drop Bear** and **See it in Bear Brain**.
- **News appears here.** Due reminders, and answers from people she asked for help.

### 2. Got a Moment?: three choices, nothing else
- **Need a Break.**
  - She picks 2, 5, 10 or 20 minutes (or longer) and gets one restful idea.
  - Ideas use her interests where saved, and are never chores or errands.
  - She can tap Sounds good, Another idea or Not now. Bear learns only from "Sounds good".
- **Talk It Out.**
  - A text-message style chat with Bear: "I'm listening. What's on your mind?"
  - She can talk or type. Replies can be read aloud on request, in an Australian woman's voice where the phone has one.
  - Bear listens first and keeps it short. It isn't a therapist.
  - It asks before helping. A to-do list it suggests waits for her approval before anything is saved.
  - When she talks about feelings, Bear doesn't bring tasks or lists back.
  - If someone seems in danger, Bear always gives 000 and Lifeline (13 11 14).
- **Finish or share a task.**
  - She picks her time, and Bear chooses one real task from Bear Brain that fits.
  - It weighs time fit, readiness, deadlines, and what finishing it unlocks.
  - The task card offers **Let's do it** and **Ask someone** side by side. "Let's do it" has Bear prepare its part, then
    **Mark as done**. "Ask someone" opens Share Bear on that task.
  - **No time? Hand something off** skips the time question. Bear suggests one task someone else could do (errands, buying
    things, chores, calls and bookings coming up; never her own appointments, presents, bills or forms, or anything she has
    started or already handed off), with **Ask someone**, **Another one**, **Not now** and **Choose from Bear Brain**.
  - Done gives a tick: "One less thing on your mind." If nothing fits, Bear says so honestly.
  - What she chooses (do it, ask someone, another, not now) is kept as a private event, to see whether handing off helps.

### 3. Bear Brain: everything Bear is holding
- **All Tasks,** with filters: All, Needs attention, Ready to check, Waiting. Plus search.
- **Priority Actions:** what needs attention, with the reason.
- **Shared with others:** people she has asked for help, and where each request stands.
- **By Category:** six categories she can rename.
  - Night Time
  - Phone Calls
  - Organise Follow-Up
  - Organise Time-Permitting
  - This Week & Weekend
  - Aspirations
  - Bear files tasks into these. She can correct it, and Bear remembers.
- **Task rows:** swipe left for a red **Delete** bin (with undo), or drag to reorder.
- **Each task's page:**
  - What needs to happen, and the next step.
  - **Give it to Bear,** where Bear prepares drafts, steps or shortlists, and never sends, buys or books.
  - The plan, other ways to do it, dates, the category and history.
  - **🐻 Share Bear.**
  - Add to Outlook, where connected.
- **Links at the bottom:** Calendar, Share Bear, Bear Helps, Edit categories.

## Share Bear: ask someone for help
- **Asking.** From a task, she chooses a recent helper or types a mobile number. She sees exactly what will be shared (never
  her notes), then sends.
- **Their side.** They get a link and answer on a simple page with no app or account: Yes or No. Later they can mark it
  Done, say Still on track, say they can't any more, or turn reminders off.
- **Bear's follow-up.**
  - It tells her what they said.
  - While they have it, the task waits on them.
  - A "no" puts it back with her, date unchanged.
  - Their "done" completes it, labelled as reported by them.
  - Bear nudges once if there's no answer, reminds them on the day, and tells her once if it's still not done.
- **Sending the text.** No texting service is set up yet, so her Messages app opens with the text ready for her to send.
  When a Twilio account is added, Bear sends the texts itself.
- **The older link-based share** (in a task's ⋯ menu, for people who use Load Bear) still works.

## Other parts of the app
- **Onboarding.** What she carries, who's at home, and where she lives. Every step can be skipped.
- **Settings.**
  - Her household and contacts, categories, and quiet hours.
  - Notifications, and connecting Outlook calendar.
  - "What Bear has learned", where she can see and remove preferences.
  - Deleting all her data.
- **More screens.** Calendar, Bills (check a bill, then Bear plans reminders), Bear Helps, Wins, Wishlist, and areas
  (Work, Family, Home, Money, Health, Me).

## How Bear decides and helps
- **The Responsibility Resolution Engine.**
  - Each task gets a plan: the outcome needed, ways to get there, deadlines (including windows that close early), and
    who does each step.
  - Its decisions are traced, so you can check how Bear chose.
- **Preferences.** Bear learns from what she does (for example, buying online or in person). What she says explicitly
  always wins.
- **Reminders.**
  - Sent by push notification, outside her quiet hours.
  - A scheduled job runs every 15 minutes and also does Share Bear follow-up.
- **AI.** Claude, called from the server only, with daily limits per person. AI is used for:
  - reading photos, PDFs and emails
  - the Got a Moment? chat
  - sorting text into tasks
  - gift ideas
  - optional web look-ups

  When the AI isn't available, the app falls back plainly and never pretends.
- **Honesty rules.**
  - Bear never says something was sent, booked, paid or shared unless it was confirmed.
  - Drafts are labelled as drafts.
  - Actions with outside services, such as adding to Outlook, ask first and confirm afterwards.

## Privacy and data
- **Accounts and storage:** Supabase for sign-in and storage. Each person's data is protected by row-level security.
- **The Got a Moment? conversation** stays private to her and is never shared with her household. Logs never contain her words.
- **Share Bear recipients** see only the one task they were asked about, through a secure link that expires.
- **Deleting her data** removes her tasks, conversations and Share Bear requests.

## Technology
- **App:** Next.js (App Router), TypeScript, React. Hosted on Vercel in the Sydney region.
- **iPhone:** a Capacitor wrapper (`native-loadbear/`) with a Share to Load Bear add-on and App Groups.
- **Tests:** about 780 unit tests, plus two browser click-throughs (13 and 47 steps) run before every release.
- **Releases:** the working branch is released to `main` (production) on request.

## Not finished, or waiting on something
| Item | Status |
|---|---|
| Bear sending Share Bear texts itself | Needs a Twilio account (paid). Until then, she sends the text from her phone. |
| Links from `app.getloadbear.app` | Needs the domain set up in Vercel and Cloudflare. Not resolving yet. |
| Automatic TestFlight uploads | Built and checked. Needs four App Store Connect secrets in GitHub. Uploads are done by hand from Xcode for now. |
| Bear sending email itself | Not connected (Outlook is connected for calendar only). Bear prepares drafts; she sends them. |
| A natural Australian voice for everyone | Uses the phone's built-in voices. A paid voice service was offered and declined for now. |
| Forward-to-Bear email | Built, but off until configured. |
| The "Load Bear checks" GitHub job | Fails at setup (pnpm version mismatch). The same checks pass locally before each release. |
