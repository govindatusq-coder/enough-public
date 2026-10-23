# Load Bear — data model

PARA is internal: Area → Project → Resource → Archive. Users see "Money",
"Electricity bill", "Original bill" and "My Wins"; never the acronym.

Every AI-derived field is stored as a `Traced<T>`:

```ts
{ value: T | null, source: 'model' | 'rules' | 'user' | 'demo' | 'derived',
  confidence: 0..1, userVerified: boolean, lastUpdated: ISO }
```

## Tables (all `public.bear_*`, RLS owner-only, `user_id` → auth.users)

| Table                        | Indexed columns beyond id/user_id/timestamps              | Body (jsonb)                         |
|------------------------------|-----------------------------------------------------------|--------------------------------------|
| bear_profiles                | onboarding_complete, day_mode, revision                   | Profile: name, tone, areas[], people[], pins, lifeRhythm, capacityAnswers, preferences, notificationPreference |
| bear_areas                   | key, archived                                             | Area                                 |
| bear_people                  | role, archived                                            | Person                               |
| bear_captures                | status, method, created_at                                | Capture                              |
| bear_source_documents        | capture_id, object_key, mime                              | SourceDocument                       |
| bear_extractions             | capture_id, kind, status                                  | ExtractedEntity (BillExtraction + per-field traces) |
| bear_ai_inferences           | capture_id, service, provider, model                      | AIInference (prompt hash, raw output, latency, cost) |
| bear_user_corrections        | extraction_id, field                                      | UserCorrection                       |
| bear_projects                | area_id, status, due_at                                   | Project                              |
| bear_tasks                   | project_id, status, due_at, kind                          | Task                                 |
| bear_task_dependencies       | task_id, depends_on_task_id                               | TaskDependency                       |
| bear_bills                   | task_id, status, due_at, biller_key, amount_cents         | Bill (typed fields + traces)         |
| bear_recurring_expectations  | biller_key, status, expected_from, expected_to            | RecurringExpectation                 |
| bear_reminders               | task_id, status, scheduled_for, kind                      | Reminder (plan, rationale, attempts) |
| bear_reminder_interactions   | reminder_id, action, created_at                           | ReminderInteraction                  |
| bear_suggestions             | status, kind, dedupe_key                                  | Suggestion                           |
| bear_completions             | task_id, completed_at                                     | Completion                           |
| bear_wins                    | completion_id, created_at, category                       | Win                                  |
| bear_value_ledger            | kind (wealth/health/happiness), amount_cents, minutes, occurred_at | ValueLedgerEntry (HealthValue / WealthValue / HappinessValue) |
| bear_behaviour_events        | type, created_at                                          | BehaviourEvent                       |
| bear_push_subscriptions      | endpoint (unique)                                         | PushSubscription                     |

`CapacityWindow` is derived (not stored) from the profile plus behaviour
events by CapacityModelService; `NotificationPreference` and `PINSProfile`
and `LifeRhythm` live inside the profile body because they are always read
together and change rarely. `Archive` is a status on projects/tasks.

The full SQL is in `supabase/migrations/20261023120000_load_bear.sql`.
