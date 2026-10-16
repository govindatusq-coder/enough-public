# Claude Code prompt: Update 1 (Home button, Try again, own reminder time)

Paste into Claude Code from inside your `righto-app` folder. Make sure the updated `reference/Righto App v3.dc.html` is in the handoff folder first.

```
Update Righto to match the latest reference (reference/Righto App v3.dc.html). Three changes:

1. TOP-LEFT BUTTON GOES HOME
On these client screens: Set a commitment, Your commitment, Set a goal, Do it now, Check-in:
- Change the top-left button label to "Home" (caret-left icon 18, Newsreader 16, navy, 44pt min height).
- onPress: router.replace('/home'), not router.back(). Discard any unsaved plan/goal draft.
- Keep the iOS swipe-back gesture and the Android back button behaving as normal back.
- New task screen already says "Home"; leave it.

2. FINISHED HOMEWORK CAN BE TRIED AGAIN
- In the Journal screen, between the progress tile and the entries list, add a glass card (same GlassCard as the other Journal tiles, padding 16/18/6, gap 8), shown only if there are tasks with status 'finished':
  - Kicker "FINISHED HOMEWORK"
  - Sub (Newsreader 14, slate): "You can come back to any of these whenever you like."
  - One row per finished task (hairline divider #0f274614 between rows): left = title (Newsreader 17) + sub (13, slate): the commitment/goal sentence if it has one, otherwise "From Dr Chen · {sent}". Right = SecondaryButton-style pill "Try again" (arrow-counter-clockwise icon, Newsreader 500 15, min height 44, padding 0 14).
- "Try again": set status to 'tried', today = null, keep its previous plan/goal, then router.push to the New task screen for that task (Do it now / Set a commitment / Set a goal).
- Psychologist Client review: a re-opened task shows as its normal status, not "Finished".
- Add a seeded finished task to mock data so it's visible: "Notice three things you can hear", 2 min, tags ['quick'], sent "Mon 29 Sep", why "Shifting attention to your senses can help you step out of a busy mind for a moment."

3. CHOOSE YOUR OWN REMINDER TIME
A. Set a commitment: after the "Make it easy" section, add section:
   - Kicker "REMINDER", question "When should we nudge you?"
   - Glass card (padding 14, gap 8) with two options:
     a) Pill button "Around {routine time}, with my routine" + check-circle (selected = navy fill, cream text). Default.
     b) Pill row "At a time I choose" (clock icon) with a time picker on the right. Use @react-native-community/datetimepicker (install with npx expo install; it works in Expo Go) in mode="time". iOS: show the compact inline picker; Android: tapping the pill opens the native dialog. Selected = 1px navy border + #fbf8f1b0 bg.
   - Store as plan.time ("h:mm am/pm") or null for routine time.
   - Your commitment screen bell line: if plan.time → "We'll nudge you at {time}." (+ ", every day." if daily), else the existing routine line.
   - Toast after committing: "Committed. We'll nudge you at {time}." when a custom time is set.
   - Notification scheduling uses plan.time if set, otherwise the routine time.
B. Set a goal → "Remind me" card: keep the 4 time chips (7:30 am, 12:30 pm, 6:00 pm, 8:30 pm), and under them add the same "Or pick your own time" pill with time picker. Picking a custom time deselects the chips; tapping a chip clears the custom time. The summary line top-right shows the chosen time + days.
C. Add helpers to src/utils/time.ts: to12("14:05") → "2:05 pm", to24("2:05 pm") → "14:05", and a Date ↔ "h:mm am/pm" converter for the picker.

RULES
- Use only existing components and theme.ts tokens. No new colours or fonts.
- Touch targets ≥ 44pt; accessibilityLabel on the time picker ("Pick your own reminder time").
- Test in Expo Go on iOS and Android: Home button on each screen, Try again flow, both custom-time pickers, reminders fire at the custom time.
- Commit with message "Update 1: Home button, Try again, own reminder time".
```
