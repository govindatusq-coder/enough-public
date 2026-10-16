# Righto — Intended purpose & TGA guardrails

> General guidance, not legal advice. Get a short written regulatory opinion before launch and file it with this statement.

## Intended purpose statement (use verbatim in store listings, website, Terms)
"Righto lets psychologists and psychiatrists send homework to their clients. Clients plan when to do it, get reminders, and record what they did and learned. Clinicians can view what clients choose to share. Righto does not assess, diagnose, monitor, predict or treat any condition, and it is not monitored in real time."

## Why this keeps Righto outside medical-device regulation
The TGA does not regulate software used simply to display information or resources, to record or track results, to facilitate telehealth, or to generate/update a health record. Righto's functions are limited to those. If a product combines regulated and non-regulated features, the whole product is regulated — so every feature must stay inside these lines.

## Build rules (must)
1. **Clinician authors, app delivers.** All task text, rationale ("?"), instructions and suggested commitments/goals are written by the clinician and shown as written. No AI or rules engine generates advice, tasks or content.
2. **No assessment.** No questionnaires that are scored (K10, PHQ-9, GAD-7, DASS etc.), no symptom ratings, no risk scores or flags, no trends with clinical meaning.
3. **"What feels doable right now?"** is a task-preference picker only (Something tiny / Something quiet / Whatever’s next / I’ve got time). It is not called mood, not stored on the server, not shown to the clinician, not charted. Clinician can switch it off per client (default on).
4. **Progress = records, not interpretation.** Show counts of check-ins and outcomes. No percentages framed as "follow-through", "adherence", "improvement" or "progress towards recovery". No automated alerts to clinicians.
5. **Medication (psychiatrists):** at most a plain reminder the clinician sets ("Take as prescribed at 8 am"). No dose calculation, titration, missed-dose advice or adherence alerts.
6. **Crisis:** a static "Need support now?" link on Home with 000, Lifeline 13 11 14, Beyond Blue 1300 22 4636, plus the "About Righto" statement. No keyword detection, no automated risk response.
7. **Copy:** never say treats, reduces symptoms, manages depression/anxiety, therapy, clinically proven. Use: homework, plan, reminder, record, share with your psychologist.
8. **Store category:** Productivity or Health & Fitness with the intended purpose statement. Avoid "Medical".

## Change control
Before adding any feature, ask: does it assess, diagnose, monitor, predict or treat? Does it generate clinical content? Does it interpret results? If yes to any → stop and get regulatory advice. Log the decision in this file.

## If you later want therapy content (e.g. CBT modules)
That would make Righto a digital mental health tool. It may only stay excluded if it follows established clinical practice guidelines that are referenced and displayed in the app. The TGA has said this exclusion is under review, so plan for possible regulation.

## Changes in v3 (reference/Righto App v3.dc.html)
- Home prompt reframed from mood to "What feels doable right now?"; "Just show me what’s next" skip.
- "Need support now?" sheet on Home with crisis lines + About Righto statement.
- Psychologist review: "Ask ‘What feels doable?’ on Home" switch; "% follow-through" replaced by "Recorded by Sam".
- Assign: helper text "Righto shows your words as written and never generates advice."
