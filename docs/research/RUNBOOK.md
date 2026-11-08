# Running the study: step by step

1. **Approvals:** get HREC review (ETHICS.md); fill in the [brackets] in PARTICIPANT_INFORMATION_AND_CONSENT.md.
2. **Database:** apply `supabase/migrations/20261110120000_bear_study_responses.sql` (and, if not yet applied,
   `20261109120000_bear_responsibility_events.sql`) in the Supabase SQL editor. Both are additive with rollback SQL.
3. **Switch it on (Vercel → Settings → Environment Variables, Production):**
   - `BEAR_STUDY_ENABLED` = `on`
   - `BEAR_STUDY_CODE` = a code to share with participants, e.g. `BEAR-2026` (anyone with the code can join, so
     share it only in invitations)
   - `BEAR_STUDY_ID` = `loadbear-pilot-1`
   Then redeploy. Settings now shows "Research study" for everyone; only people with the code can join.
4. **Invite** participants with RECRUITMENT.md.
5. **During the study:** participants see one quiet card in Bear Ideas when a survey is due. Nothing else changes.
6. **Export** (weekly or at the end), on your own computer:
   ```
   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… BEAR_STUDY_SECRET=<a long random secret you keep> \
   BEAR_STUDY_ID=loadbear-pilot-1 node scripts/study-export.mjs
   ```
   Files appear in `study-export/<date>/` (gitignored). Use the **same** `BEAR_STUDY_SECRET` every time so codes stay
   stable. Never share the secret with the data.
7. **End:** set `BEAR_STUDY_ENABLED` to `off` (Settings card disappears; answers stay until deleted under the
   retention plan). Analyse with ANALYSIS_PLAN.md.
