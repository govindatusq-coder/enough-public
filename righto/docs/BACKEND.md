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
2. Open **SQL Editor → New query**, paste the whole of `supabase/migrations/20261016120000_righto_core.sql`, run it, then do the same with
   `supabase/migrations/20261016130000_righto_home_prompt.sql`, then `supabase/migrations/20261018090000_righto_own_tasks.sql`.
   Each should finish with "Success. No rows returned".
3. **Authentication → Multi-Factor**: enable **TOTP**. Psychologist accounts are refused any client data until the session has passed a second
   factor, so without this psychologists cannot get past the two-step screen. While testing you can switch the requirement off with
   `update public.righto_settings set value = 'false'::jsonb where key = 'require_psych_mfa';` (set it back to `'true'` before real use).
4. **Authentication → Providers → Email**: "Confirm email" on means every new account gets a confirmation email before it can sign in.
   Turn it off while testing on your own phones if you want to skip that.
5. **Project Settings → API Keys**: the **publishable** key (`sb_publishable_…`) is built into `src/backend/supabase.ts` together with the project URL.
   A `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` overrides them (for a second project). Never share or commit the
   **secret** / `service_role` key.
6. **Google sign-in** (optional). In Google Cloud Console → APIs & Services → Credentials → Create credentials → OAuth client ID →
   Web application, with `https://<project-ref>.supabase.co/auth/v1/callback` as the authorised redirect URI. Paste the Client ID and
   Client secret into Supabase → Authentication → Sign In / Providers → Google and enable it. Then under **Authentication → URL
   Configuration → Redirect URLs** add `exp://**` (Expo Go) and `righto://**` (builds) so the browser can hand the sign-in back to the app.
   Google only confirms the person's identity; no homework data goes to Google. Sign in with Apple is left for the development build
   (it needs an Apple Developer account and does not work in Expo Go).
7. Optional, to run the isolation tests against the project (use a **separate test project**, not the one real people will use):

   ```
   RIGHTO_SUPABASE_URL=... RIGHTO_SUPABASE_ANON_KEY=... RIGHTO_SUPABASE_SERVICE_ROLE_KEY=... node --test tests/backend/*.test.ts
   ```

   The tests create throw-away users, prove that a psychologist cannot read another psychologist's client, that
   unshared plans and check-ins stay hidden, that invites are single-use, and that ending a link cuts access, then
   delete the users.

## How the app uses it

`src/backend/cloud.ts` is the only place the screens talk to the project.

- **Accounts.** Splash → Consent → Create account / Sign in (`app/account.tsx`), by email and password or **Continue with Google**
  (system browser, PKCE, `signInWithGoogle` in cloud.ts; a first Google sign-in then asks for the role and name). The role, name and
  (for psychologists) practice and Ahpra number become the `righto_profiles` / `righto_psychologists` rows; consent version and time are written with them. Psychologists
  then go to `app/mfa.tsx` to add an authenticator app or enter their code.
- **Linking.** Clients → Your clients → **Invite a client** mints a code (`righto_create_invite`). The client types it on "Your invite code"
  (`app/link.tsx`, also reachable from Settings → Privacy & data), sees the name, practice and Ahpra number from `righto_preview_invite`
  and confirms (`righto_redeem_invite`). Either side can end sharing (`righto_end_link`).
- **Homework.** Assign homework inserts a `righto_tasks` row. The client's phone pulls tasks, check-ins and the next session on launch,
  when the app comes to the foreground and every 45 seconds while open, and fires the private local "new homework" alert for rows it has
  not seen. Plans, goals, status, today's outcome and check-ins are written back as the client makes them (`pushTaskPatch`, `pushCheckIn`).
  Remote push is still to come (needs a development build; Expo Go cannot receive it), so a task arrives when Righto is next opened.
- **Psychologist screens** read through `righto_my_clients` and `righto_client_record` (logged server-side; unshared plans and check-ins
  never leave the database). The "Ask ‘What feels doable?’ on Home" switch is `righto_set_home_prompt`. Export logs `export_record`.
- **Privacy & data** in cloud mode: Download my data calls `righto_export_me` and includes what is on the phone; Delete my account calls
  `righto_delete_me`, signs out and wipes the phone.
- **Local sample mode.** If the project URL is ever removed from the build, every screen falls back to the sample data as before.

## Still open after this

- Vendor register and data-location audit (push, email, crash reporting) per PRIVACY.md APP 8.
- Retention schedule and backup roll-off; `righto_delete_me()` deletes immediately, backups follow Supabase's PITR window.
- Edge Function for sending the "new homework" push so device tokens never reach the client app of another user.
- Privacy Impact Assessment and lawyer review before any real client.
