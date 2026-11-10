# Responsibility data model

Conceptual entities mapped to what is actually stored. Nothing here is a new table unless stated.

| Concept | Stored as | Notes |
|---|---|---|
| Responsibility | `tasks` row with a `load` graph (JSONB) | Primary node plus attached nodes (consent, payment) |
| Requirement, Action, Dependency | `load.nodes[].steps[]` with `dependsOn`, `owner`, `evidence` | Confirmed vs inferred tracked per fact in extraction |
| Evidence | `completions.evidence` (level, source, verifiedAt) | Levels: confirmed, user_confirmed, inferred, unknown |
| Event / transition / approval / execution attempt | `bear_responsibility_events` (append-only, JSONB metadata ≤ 16 KB, no update or delete for users) | Execution events carry keys and kinds only |
| Household members | `profiles.people` | Roles, names |
| Preferences | `profiles` (`pins`, `lifeRhythm`, `notification`, `offerGroups`) | `offerGroups`: staff/student/senior/parent yes/no only |
| Learning events | `behaviour_events` | Includes decision feedback labels, never email text |
| Notification decisions | `services/notification-decision.ts`, `reminders` | |
| Tenant, API keys, idempotency | `bear_tenants`, `bear_tenant_keys`, `bear_tenant_members`, `bear_api_idempotency` | Enterprise API (off) |
| Connected accounts | not built | No integration to connect |
| ContextEntity / ContextRelationship / Household tables | not built | Relationships live in the profile and the load graph |

Isolation: every table is per user with row-level security; the store is constructed with the user id. A test proves one household's approvals mean nothing to another.

Execution event types: `approval_requested/granted/declined/revoked`, `execution_started/accepted/confirmed/unknown`, `action_failed`, `state_changed`, `state_conflict`, `verified`. The log must be readable and writable for any outward action to run.
