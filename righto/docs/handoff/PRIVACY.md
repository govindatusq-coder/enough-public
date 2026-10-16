# Righto — Privacy build requirements (Australian Privacy Principles)

Righto collects **health information** (homework, reflections, mood, session dates, the client–psychologist link). Under the *Privacy Act 1988 (Cth)* this is **sensitive information**, and health service providers are covered regardless of turnover. Treat every item below as a build requirement, not a nice-to-have.

> This is engineering guidance, not legal advice. Before launch: commission a **Privacy Impact Assessment** (OAIC has a free template) and a privacy-lawyer review. Also check state health-records law (e.g. *Health Records Act 2001* (Vic), *HRIPA 2002* (NSW), *Health Records (Privacy and Access) Act 1997* (ACT)), Psychology Board / APS record-keeping guidance, and the latest Privacy Act amendments.

---

## 1. Data inventory (what each screen collects)

| Screen | Data | Sensitive? | Stored where | Shared with psychologist |
|---|---|---|---|---|
| Sign-up | Name, email, password hash, DOB (age check only) | Personal | Server | Name only |
| Link to psychologist | Invite code → psychologist ID | Health (implies treatment) | Server | Yes (that's the link) |
| Assign homework (psych) | Task title, instructions, rationale, minutes, needs, suggested commitment/goal | Health | Server | — (authored by psych) |
| Home – “What feels doable?” | Task preference (tiny / quiet / next / time) | Low | **Device only, never synced** | Never |
| Commitment | Routine, where, how, prep | Health | Server | Only if "Share my commitment" is on |
| Goal | 5 answers + reminder time/days | Health | Server | Only if sharing is on |
| Do it now | Timer state | No | Device only | No |
| Check-in | Outcome, "what helped", "what to change" | Health | Server | Yes, default on, toggle per check-in |
| Journal | History of the above | Health | Server | Same rules as above |
| Next session | Date/time, mode | Health | Server | Authored by psych |

**Do not collect:** location, contacts, photos, advertising ID, device fingerprint, free-text crash breadcrumbs containing user content.

---

## 2. APP-by-APP requirements

### APP 1 — Open and transparent management
- [ ] Publish a plain-English **Privacy Policy** (web URL) covering: what's collected, why, where stored (Australia), who can see it, retention, overseas disclosure (none), how to access/correct/delete, how to complain (to Righto, then OAIC).
- [ ] Link it in: onboarding consent screen, Settings → Privacy, App Store / Google Play listing.
- [ ] Name a **privacy officer** contact (email) in the policy and in-app.
- [ ] Keep an internal **privacy governance doc**: data map (above), retention schedule, breach plan, vendor list.

### APP 2 — Anonymity and pseudonymity
- [ ] Allow a display name / first name only. Don't require surname, phone or address to use the client app.

### APP 3 — Collection of solicited personal information
- [ ] Collect only what each feature needs (table above). Mood is **optional** and has "Skip for today".
- [ ] **Express consent before any health data is collected** — onboarding consent screen (see §3) with an unticked checkbox/explicit button, logged with timestamp + policy version.
- [ ] Psychologists must confirm in their onboarding that they have the client's consent to use Righto as part of treatment.

### APP 4 — Unsolicited information
- [ ] Free-text fields (reflections, notes): if a client enters information about third parties, handle under the same rules; provide psychologists a "delete entry" action.

### APP 5 — Notification of collection
- [ ] **Collection notice** at onboarding (short, layered) and a just-in-time notice:
  - Mood check: "Only you can see this unless you choose to share it."
  - Check-in: "Dr Chen will see this before your next session." with the share toggle.
  - Commitment / Goal: existing "Share my commitment with Dr Chen" toggle.

### APP 6 — Use or disclosure
- [ ] Use data **only** to deliver the homework service between client and their linked psychologist.
- [ ] **No advertising, no data sale, no marketing use** of health data.
- [ ] Analytics: event counts only (e.g. `checkin_saved`), **no task titles, reflections or mood values**, no user IDs sent to third-party analytics. Prefer self-hosted or privacy-first analytics, or none in v1.
- [ ] Client controls sharing per item; psychologist sees only what's shared.
- [ ] If client unlinks a psychologist, the psychologist loses access to future data immediately.

### APP 7 — Direct marketing
- [ ] No marketing to clients using their health information. Any product emails require separate opt-in, never pre-ticked.

### APP 8 — Cross-border disclosure
- [ ] Host database, file storage and backups in **Australia** (e.g. Supabase / AWS `ap-southeast-2` Sydney, Azure Australia East, GCP `australia-southeast1`).
- [ ] Audit every vendor's data location (push, email, crash reporting, auth). Choose AU-region or configure so **no health content leaves Australia**:
  - Push notifications: payload must contain **no health content** (see §4). Expo Push / APNs / FCM then only carry generic text.
  - Crash reporting (e.g. Sentry): AU/EU region if available, scrub all user content, disable breadcrumbs of text inputs.
  - Email (invites, resets): no health content in emails.
- [ ] Record each vendor + region in the governance doc.

### APP 9 — Government identifiers
- [ ] Do not collect or use Medicare numbers, IHI, TFN etc.

### APP 10 — Quality of personal information
- [ ] Clients can edit commitments, goals and reflections; psychologists can edit tasks and session dates.
- [ ] Show "last updated" on shared items.

### APP 11 — Security
- [ ] TLS 1.2+ everywhere; certificate pinning optional.
- [ ] Encryption at rest on the server (DB + backups) and on device:
  - Store tokens with `expo-secure-store` (Keychain / Keystore).
  - Local cache (offline journal) encrypted — e.g. SQLCipher via `expo-sqlite` with encryption, or MMKV with encryption key in SecureStore.
- [ ] **App lock**: Face ID / Touch ID / passcode via `expo-local-authentication`; on by default, re-lock after 5 min in background. Blur app content in the app switcher (`expo-screen-capture` / privacy overlay on `AppState` change).
- [ ] Auth: email + password with strong rules or passwordless magic link; **MFA required for psychologists**.
- [ ] **Row-level security**: a psychologist can read only clients linked to them, and only items marked shared. Client reads only own rows. (Supabase RLS policies or equivalent.)
- [ ] **Audit log**: who viewed/edited which client record, when (psychologist side).
- [ ] Least-privilege staff access; no production data in dev/test.
- [ ] Dependency scanning, regular updates, annual penetration test before scale.
- [ ] **Retention & destruction**: configurable; default keep while account active; on account deletion, delete or de-identify within 30 days, backups roll off within 35 days. Psychologists retain their own clinical records outside Righto per Board guidance — make clear Righto is not the clinical record unless you build for that.

### APP 12 — Access
- [ ] Settings → Privacy → **Download my data** (JSON + readable PDF/CSV) within the app; respond to emailed requests within 30 days.

### APP 13 — Correction
- [ ] Inline edit on all user-entered data; "Request a correction" link for psychologist-authored items.

### Notifiable Data Breaches (NDB) scheme
- [ ] Written **breach response plan**: contain → assess within 30 days → notify affected users + OAIC if likely serious harm.
- [ ] Alerting on unusual access patterns; ability to revoke all sessions.

### Children / young people
- [ ] If clients under 18 are in scope, add age gate and guardian-consent flow, or restrict to 18+ in v1 (recommended).

---

## 3. Screens to add for compliance

1. **Welcome → Consent** (after splash, before Home, first launch only)
   - Title (serif 34): "Your privacy"
   - Body (serif 17): "Righto keeps your homework, notes and check-ins private. Only you, and the psychologist you link with, can see what you choose to share. Your information is stored in Australia and never sold or used for advertising."
   - Three bullet rows with light icons: lock "Locked with Face ID", map-pin "Stored in Australia", eye-slash "You choose what Dr Chen sees".
   - Links: "Read the privacy policy", "Collection notice".
   - Checkbox (unticked): "I agree to Righto collecting and storing my health information for this purpose."
   - Primary button (disabled until ticked): "Agree and continue". Secondary text button: "Not now" (exits; no data collected).
   - Log: `consent{version, timestamp, scopes}`.
2. **Enable app lock** (one screen): "Keep Righto private" → "Use Face ID" / "Set a passcode" / "Skip".
3. **Notification permission** primer (before OS prompt): "We'll send gentle reminders at the times you choose. They won't show what the task is unless you turn that on."
4. **Settings → Privacy & data**
   - Show task details in notifications (off by default)
   - Share check-ins with my psychologist by default (on)
   - Share mood with my psychologist (off)
   - App lock (on) + lock after (Immediately / 1 / 5 min)
   - Linked psychologist → Unlink
   - Download my data
   - Delete my account (two-step, explains retention)
   - Privacy policy · Contact privacy officer
5. **Psychologist onboarding**: MFA setup; attestation "I have my client's consent to use Righto as part of their care."

## 4. Notification copy (no health content on the lock screen by default)

| Prototype copy (detail ON) | Default private copy |
|---|---|
| "New homework from Dr Chen — Write down one worry…" | **"Righto** · You have something new from your psychologist." |
| "Finished lunch? Righto, Sam. You committed to walk for 10 minutes…" | **"Righto** · Time for your lunch break routine." |
| Goal reminder with goal text | **"Righto** · A gentle reminder for today." |
| Later nudge | **"Righto** · Ready to have another look?" |

- Push payload must not contain task titles, reflections or psychologist name. Fetch details after unlock.
- Use `expo-notifications` local scheduling for routine/goal reminders (no server needed, no data leaves device). Use remote push only for "new homework", generic text.
- iOS: set `hiddenPreviewsBodyPlaceholder`; Android: `VISIBILITY_PRIVATE` with public version.

## 5. Store listings
- [ ] Apple **Privacy Nutrition Label**: Health & Fitness data (linked to user, not used for tracking), Contact info (email), Identifiers (user ID). Tracking: **No**.
- [ ] Google Play **Data safety**: same; data encrypted in transit; users can request deletion.
- [ ] Apple: no HealthKit unless needed; if added later, follow HealthKit rules (no ads, no sale).

## 6. Regulatory check
- [ ] **TGA**: a homework reminder app generally isn't Software as a Medical Device if it doesn't diagnose, treat or make clinical decisions. Avoid claims like "treats anxiety". Confirm with the TGA SaMD guidance.
- [ ] Marketing claims: "supports the work you do with your psychologist", not therapeutic claims.
