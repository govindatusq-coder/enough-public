# Claude Code prompt: Update 2 (Do it now / Do it later / Something else)

Paste into Claude Code from inside `righto-app`. Reference: reference/Righto App v3.dc.html (New task screen + lock-screen alert).

```
Change how every homework suggestion is started. Match reference/Righto App v3.dc.html.

NEW TASK SCREEN
- Heading above the options: "How would you like to do it?" (Newsreader 21).
- Replace the three rows (Do it now / Set a commitment / Set a goal) with:
  1. "Do it now" (play icon) · sub "About {mins} min. We'll start a timer." → timer screen.
  2. "Do it later" (calendar-plus icon) · sub "Choose when, and we'll remind you." Shows sand "Suggested" pill + navy icon circle if the psychologist suggested a commitment or goal. Caret down/up. Tapping toggles an expandable glass card directly below the list:
       Kicker "WHEN WILL YOU DO IT?"
       a) "With something I already do" (link icon) · "Like after lunch or while my coffee brews." → Set a commitment screen
       b) "At a time I choose" (target icon) · "Say what you'll do and when, and pick your reminder." → Set a goal screen
       Put the "Suggested" pill on whichever of a/b matches the psychologist's suggestion.
       Animate open/close with reanimated (height + opacity, 200ms).
  3. "Something else" (shuffle icon) · sub "Set this one aside for now and see what else there is." → status 'later', laterUntil = now + 3 days, schedule the private nudge, toast "Set aside. We'll check in again on {weekday}.", router.replace('/home').
- Remove the bottom "Nothing for now" button and its "We'll check in again in a few days." caption. Keep "Need support now?".
- The expanded state resets to closed whenever the screen opens, unless opened with param later=1.

ELSEWHERE
- Lock-screen / notification actions for new homework: "Do it now" and "Do it later" (Do it later opens New task with later=1 so the panel is already open).
- Timer screen secondary button for new tasks: "Not now, do it later" → New task with later=1.
- Home next-step card keeps "Start" + "Something else".

Use existing components and theme tokens only. ≥44pt targets. Test in Expo Go. Commit "Update 2: now / later / something else".
```
