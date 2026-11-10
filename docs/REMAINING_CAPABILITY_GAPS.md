# Remaining capability gaps

1. **No real integration** for sending, calendar, forms, booking or payment. Until one exists Bear prepares and hands off. Needs the owner's decision, credentials and authorisation per integration.
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
