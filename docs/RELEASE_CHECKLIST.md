# Release checklist (invited parents)

**Done and verified in code (local):**
- [x] Type check, lint, 624 tests, priority stress 110/110, load stress 100/100 (`npm run verify`)
- [x] Production build passes
- [x] Browser walk-through at phone width (onboarding, capture, school notice, bill, edit, complete, settings)
- [x] Screens audited at 390 px and 1280 px: no placeholder text, no horizontal scroll, no unlabelled controls, one heading per page
- [x] Every `/api/bear` route requires sign-in, except four on purpose (feature flag, signed email webhook, email-link verifier, build stamp)
- [x] Delete-my-data (code + tests), privacy page, daily capture limit, reminder delivery safe to re-run
- [x] Nothing claims Bear sends, submits, books or pays

**Blocked on the owner (see OWNER_ACTIONS.md):**
- [ ] Apply the seven pending database migrations
- [ ] Service role key, cron secret, VAPID keys, GitHub secrets/variable
- [ ] Confirm backups on the Supabase plan
- [ ] Real-phone push test
- [ ] Outlook add-in re-test after deploy
- [ ] Privacy text reviewed by someone qualified
- [ ] "merge it"

**Not verified by anyone yet:** real-device push; real Apple/Google/Outlook calendar import; photo/PDF notice reading with the live AI; delete-my-data against real Supabase; password recovery and session-expiry flows against real Supabase email; behaviour on slow/offline networks beyond error messages; real parents using it unaided.
