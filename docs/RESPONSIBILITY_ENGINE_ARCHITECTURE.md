# Responsibility engine architecture

Deterministic orchestration with targeted model calls. AI interprets; code decides what may run. No new framework, database or provider.

| Engine | Where | Status |
|---|---|---|
| 1. Multimodal input | `services/capture.ts`, `inbound/`, `outlook/`, native share | Partial: text, photo, screenshot, PDF, forwarded email, Outlook add-in. Voice unavailable. Calendar and mailbox reading unsupported |
| 2. Understanding | `engine/extract.ts`, `load/`, `coverage/packs/school.ts`, `engine/duplicates.ts`, `engine/decide.ts` | Implemented (rule-based; AI for images). Outcome inference is per pattern, not free-form |
| 3. Household context | `profile.people`, `loadMap`, `engine/household.ts` (off by default) | Partial: no context-entity tables; targeted retrieval is by matching |
| 4. Planning | `engine/plan.ts`, `load/` | Implemented: DAG, parallel steps, validation, completion criteria per pattern |
| 5. Prioritisation | `priority/`, `services/priority.ts` | Implemented: transparent scoring, urgency and importance separate |
| 6. Execution | `engine/actions.ts`, `engine/execution.ts` | Implemented; **no integration can run outward actions yet** (all NOT_SUPPORTED) |
| 7. Verification and monitoring | `engine/state.ts`, `engine/execution-summary.ts`, reminders cron | Implemented for evidence; cron needs service-role key |
| 8. Attention | `engine/intervention.ts`, `services/notification-decision.ts` | Partial: restraint and quiet hours yes; approval bundling not built |
| 9. Personalisation | `services/behaviour.ts`, `decision-feedback.ts`, `engine/offers.ts` | Partial: structured feedback and one preference type; no confidence model |
| 10. State machine | `engine/state.ts`, `engine/events.ts` | Implemented, 15 states |

Flow: input → normalise → extract → duplicate check → decide → plan → prepare → (approval) → execute → verify. The LLM never compares dates, checks approvals, validates transitions, enforces permissions or confirms success.

Untrusted input: email, documents and web content are data. Instructions inside them are ignored and reported (`ignored_instructions`).
