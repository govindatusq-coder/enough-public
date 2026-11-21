# Got a Moment? as a conversation with Bear

Status: built and tested locally (unit tests and browser walkthroughs). The live AI conversation has not been checked
on production yet.

## What the person sees
- **Opening:** the Load Bear logo, Settings, Mama Bear, "Got a moment?", "How's your day going?", and one box ("Whatever's
  on your mind…") with a microphone, an optional "read replies aloud" switch and Send. No chips, timers, moods or cards.
- **First message:** the same screen turns into a chat (no route change). The header shows a small Mama Bear, "Bear",
  "Here with you", Back and the read-aloud switch. Her messages are pale blue on the right; Bear's are warm white on the
  left, with a Listen button. The box stays fixed above the tab bar.
- **Cards under Bear's messages:** a suggestion that fits the time she has (Give it to Bear / Not now), a task found by topic
  (Open, plus Add to Outlook where connected), something Bear prepared (ready for her to check), a draft message (Open in
  Mail or Messages / Copy; Bear can't send it), and things saved to Bear Brain.

## How it works
- `app/api/bear/moment/chat/route.ts`: the single entry point. GET returns the kept conversation and whether to resume it
  (last message under 12 hours ago). POST sends one message: duplicates are prevented by message id, and a retry gets the
  same reply. DELETE clears it.
- `lib/bear/services/moment-chat.ts`: message types, Bear's instructions, the tools, safety handling, the answer without the
  AI, and storage. The tools are an adapter onto the responsibility engine:
  - `find_responsibilities` → `brainView`
  - `suggest_for_time` → `recommend`
  - `prepare_help` → `giveToBear` (prepares only)
  - `draft_message` → a reviewable draft
  - `add_tasks` → the existing Drop Bear chat tool
- `lib/bear/ai/chat.ts`: the existing chat call now accepts its own instructions and can leave out web search.
- `components/bear/moment-chat.tsx`: the screen. `components/bear/speech.ts`: voice in and voice out.
- **Action states:** `proposed → preparing → ready_for_review → approved → executing → verified_success | failed | cancelled`.
  The only action with provider confirmation is Add to Outlook, which reuses the existing approve-then-read-back flow.
- **Privacy:** the conversation is kept on her own profile (`momentChat`, at most 80 messages), never on anything shared
  with the household. Bear reads back only the current sitting (at most 16 messages). Logs hold tool names and counts,
  never her words. Drafts to a partner carry only the practical request.
- **Safety:** the instructions cover 000 and Lifeline (13 11 14). The server also adds that line to any reply to a message
  that shows danger signs, whatever the AI said.
- **Without the AI** (no key, or the daily cap of 150 reached): a time she mentions still finds one thing through the
  engine; otherwise Bear says plainly that it can't chat properly just now.

## Voice
- **In:** the phone's own speech recognition (en-AU), the same behaviour as Drop Bear. Words fill the box for her to check
  and send; Cancel restores what was there. If permission is refused or the phone won't let the page listen, the keyboard's
  microphone is offered. No audio leaves the phone.
- **Out:** the phone's own speech, in an Australian voice where available. Per-message Listen/Stop; auto-read is off by
  default and remembered per device. Only one reply plays at a time, and playback stops on leaving the screen. It costs
  nothing; it is not streamed or duplex.

## Not available yet (said honestly in the app)
- **Sending email or texts:** Outlook is connected for calendar only (`Calendars.ReadWrite`). Drafts open in her Mail or
  Messages app, and Bear says it can't see whether they were sent. To send from the app, Mail.Send would need adding to
  the Microsoft app and an approval-then-confirm flow like the calendar's.
- **Streamed replies:** replies arrive whole, with a typing indicator.
- **Server-side voice:** there is no Australian neural voice; it would need a TTS provider key and a budget cap.
- **A thinking-pose illustration:** the reference shows Mama Bear with her chin on her hand. The approved assets don't
  include that pose, so the welcome uses `hero-bear-cut` and the avatar uses `avatar`.
