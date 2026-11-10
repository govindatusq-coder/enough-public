# Responsibility state machine

States (internal; people see plain words from `stateWords`):
`identified, needs_clarification, planned, ready, in_progress, waiting, completed_unverified, verified, closed, cancelled` and the execution states `awaiting_approval, executing, awaiting_confirmation, failed, blocked`.

Rules, enforced in `checkTransition`:
- `verified` needs a verification method (user confirmation, document, forwarded email, integration). A reminder firing, a draft, a deadline passing or a model's guess is never evidence.
- Execution states never go straight to `closed`.
- An impossible jump is recorded as `state_conflict` and not applied.
- The state is derived from the load graph, completion evidence and, when `BEAR_EXECUTION_ENABLED=on`, the execution log (the worst unresolved action wins: failed > executing > awaiting approval > awaiting confirmation).
- A finished task is never pulled back by an old execution log.
- A start with no outcome for 10 minutes is shown as failed (a lost reply is never "still going").

Mapping to the product brief's names: DETECTED ≈ identified; UNDERSTANDING ≈ identified/needs_clarification; PLANNED = planned; PREPARING and READY_FOR_REVIEW ≈ planned/ready (no separate states); AWAITING_APPROVAL = awaiting_approval; EXECUTING = executing; AWAITING_CONFIRMATION = awaiting_confirmation; VERIFIED_COMPLETE = verified; NEEDS_INFORMATION = needs_clarification; BLOCKED = blocked; FAILED = failed; CANCELLED = cancelled. RETRY_PENDING is not a state: a retry-safe failure stays `failed` and the next attempt is gated by the execution rules.

History is append-only. Recovery after a restart reads the log; nothing depends on in-memory state.
