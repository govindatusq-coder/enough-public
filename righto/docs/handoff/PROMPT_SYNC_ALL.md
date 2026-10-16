# Righto: one prompt to bring the app up to date

Use this ONE prompt. It replaces running Update 1 and Update 2 separately.

1. Unzip this folder next to your `righto-app` folder, so you have:
   ```
   Documents/
     righto-app/                 ← your Expo app
     design_handoff_righto_app/  ← this folder
   ```
2. Open Terminal in `righto-app`, type `claude`, paste everything below.
3. When done: `npx expo start`, shake phone → Reload.

```
SOURCE OF TRUTH: ../design_handoff_righto_app/reference/Righto App v3.dc.html
Open it in a browser (it needs support.js and assets/ beside it, already there). Every screen, label, colour, spacing and behaviour in the app must match it. If anything in starter/, README.md or earlier prompts disagrees, the reference wins. Do NOT copy starter/ screens over existing ones.

Also read: ../design_handoff_righto_app/PROMPT_update_1.md and PROMPT_update_2.md, and apply both.

Then go through every client and psychologist screen in the reference and make the app match, including:
- Home (mindful): "What feels doable right now?" card with 4 tiles (Something quick, Something quiet, Whatever's next, I've got time) and "Just show me what's next" link; calm line; next-session line; "Need support now?". No mood check. Every time the user lands on Home, reset the pick so the "What feels doable right now?" card shows first (the next-step card only appears after they tap a tile; "Something else" returns to the tiles).
- Onboarding: Consent → Confirm psychologist → App lock → Gentle reminders (private preview, details toggle off by default).
- New task: "How would you like to do it?" → Do it now / Do it later (expands: With something I already do / At a time I choose) / Something else. No "Nothing for now".
- Top-left button says "Home" and goes to Home on Set a commitment, Your commitment, Set a goal, Do it now, Check-in.
- Set a commitment: Reminder section (routine time or "At a time I choose" time picker).
- Set a goal: 4 time chips + "Or pick your own time".
- Journal: progress tile, "Finished homework" card with "Try again", entries.
- "Not monitored in real time" note under check-in and goal text boxes.
- Private lock-screen notification copy.
- Psychologist: Clients list, Client review (dashboard, access-logged line, Export to notes, End sharing), Assign (incl. Why this helps, Tag it, Talked it through in session).

Process:
1. List every screen in the reference and every screen in the app side by side. Show me the list.
2. Fix differences one screen at a time. After each, tell me what changed.
3. Run npx expo start and fix all errors.
4. git commit -m "Sync with reference v3".
```

If it still looks old after this, send a screenshot of the phone.
