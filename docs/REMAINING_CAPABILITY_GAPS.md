# Remaining capability gaps

1. **Outlook calendar** is built but needs the owner to register the Microsoft app and set the environment variables (`docs/CALENDAR_INTEGRATION.md`), and has not been run against the real service. **No integration** for sending email, forms, booking or payment. Timed events, Google Calendar and availability are not built. Until one exists Bear prepares and hands off. Needs the owner's decision, credentials and authorisation per integration.
2. **Execution on screen**: no approval UI or place for the status card yet (nothing to approve until an integration exists). Wiring `applyConfirmation` to `confirmExecution` is not done.
3. **Context engine**: no household/context tables or generic relationship retrieval.
4. **Free-form outcome inference and plan generation by a model**: today patterns drive this; model-generated plans would go through `validatePlan`.
5. **Attention**: approval bundling and escalation timing are not built.
6. **Learning**: no preference confidence model, no timing adaptation beyond reminders.
7. **Measurement**: no independent real-email set; planning accuracy, autonomous completion and incorrect actions are unmeasured; LLM baselines not run.
8. **Operations**: later migrations not confirmed as applied to production; service-role key missing from the variable list (cron reminders and inbound/enterprise need it).
9. **Settings**: no screen listing remembered offer answers.
10. **Image-only emails** can't be read (no vision step).
11. **Document generation** (filling a school's own form) is not built.

## From the "completion engine" brief (what it asks for that is still open)
- **Connected discovery (email/calendar OAuth):** needs a Microsoft or Google app registration and the owner's consent, which the owner has decided not to do for now. Without it, responsibilities still come from what the person shares, forwards or adds in the Outlook panel.
- **Submission of forms:** no school system offers an API we can use. Handoff only.
- **Subscription entitlements / pricing:** not built (no payment screens by design); no cost-per-household instrumentation yet.
- **Work-removed metrics:** form counts are recorded; a verified-completions-per-household report is not built.
- **Targets in the brief** (95% extraction, 99% approval compliance, 90% happy-path completion) are not claimed: the synthetic suites pass, real-world reliability is unmeasured.
- **The 50% time-saving test with 10 to 20 working parents** has not been run; it needs participants (the study framework exists, off by default).
