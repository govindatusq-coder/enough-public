# Righto backend (Supabase, Sydney)

Phase 4 of the handoff. This document is the runbook; the schema is in `supabase/migrations/`, the app-side client
in `src/backend/supabase.ts`, and the isolation tests in `tests/backend/`.

## What the schema guarantees

| Rule | Where |
|---|---|
| A client reads and writes only their own rows | RLS on `righto_tasks`, `righto_checkins`, `righto_sessions`, `righto_access_log` |
| A client cannot edit the clinician's words (title, instructions, why) | `tasks_client_update` policy |
| A psychologist assigns only to clients linked to them | `tasks_psych_insert` policy + `righto_active_link()` |
| A psychologist reads a client's record only through one function that logs the view and hides anything unshared | `righto_client_record()`; there is deliberately no psychologist SELECT policy on tasks or check-ins |
| Every psychologist view, assignment and export is logged; the client can see that log | `righto_access_log` |
| Psychologists need MFA | `righto_require_psych()` checks the JWT `aal` claim; `righto_settings.require_psych_mfa` |
| Invites are single-use, expire in 48 h, stored hashed, 20 per psychologist per day | `righto_invites`, `righto_create_invite()`, `righto_redeem_invite()` |
| Either side can end sharing; access to anything new stops at once | `righto_end_link()` |
| Download my data / delete my account | `righto_export_me()`, `righto_delete_me()` |

Nothing on the server scores, flags or interprets. Counts shown to the psychologist are counts of records.

## One-time setup (you)

1. Create a project at https://supabase.com. Region **Sydney (ap-southeast-2)**. Give it a strong database password and keep it in a password manager.
2. Open **SQL Editor → New query**, paste the whole of `supabase/migrations/20261016120000_righto_core.sql`, run it. It should finish with "Success. No rows returned".
3. **Authentication → Providers → Email**: leave "Confirm email" on. Under **Authentication → Multi-Factor**, enable TOTP (this is what the psychologist MFA check relies on).
4. **Project Settings → API**: copy the **Project URL** and the **anon public** key. Never share or commit the **service_role** key.
5. In the `righto` folder create a file named `.env` (it is git-ignored) with:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

   Then restart the dev server with `npx expo start -c`.

6. Optional, to run the isolation tests against the project (use a **separate test project**, not the one real people will use):

   ```
   RIGHTO_SUPABASE_URL=... RIGHTO_SUPABASE_ANON_KEY=... RIGHTO_SUPABASE_SERVICE_ROLE_KEY=... node --test tests/backend/*.test.ts
   ```

   The tests create throw-away users, prove that a psychologist cannot read another psychologist's client, that
   unshared plans and check-ins stay hidden, that invites are single-use, and that ending a link cuts access, then
   delete the users.

## What the app does with it

Until `.env` exists the app runs exactly as now, on local sample data. Once configured, the next step wires:

- sign up / sign in (email + password; psychologists then enrol TOTP), the consent record written to `righto_profiles`;
- the invite flow: psychologist mints a code in Clients, client types it on "Confirm your psychologist", which shows the
  name, practice and Ahpra number from `righto_preview_invite()` before linking;
- tasks and check-ins stored in the project instead of the local store (the local encrypted store becomes an offline cache);
- the psychologist screens reading through `righto_client_record()` and `righto_my_clients()`;
- a "new homework" push via Expo Push with the private copy only (needs a development build; Expo Go cannot receive remote push).

## Still open after this

- Vendor register and data-location audit (push, email, crash reporting) per PRIVACY.md APP 8.
- Retention schedule and backup roll-off; `righto_delete_me()` deletes immediately, backups follow Supabase's PITR window.
- Edge Function for sending the "new homework" push so device tokens never reach the client app of another user.
- Privacy Impact Assessment and lawyer review before any real client.
