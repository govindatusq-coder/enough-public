# Righto v3 — Compliance & vulnerability assessment
Date: 15 Oct 2026 · Scope: `reference/Righto App v3.dc.html` + README, PRIVACY.md, INTENDED_PURPOSE.md
> Design-stage review, not legal advice. Confirm with a health-regulatory lawyer before launch.

Ratings: 🔴 High (fix before any real client) · 🟠 Medium (fix before launch) · 🟢 Low / note

---

## A. TGA — software as a medical device

| # | Area | Finding | Rating | Fix |
|---|---|---|---|---|
| A1 | Core function | Delivers clinician-written homework, reminders, records outcomes. Fits "display information" and "record or track results" — outside the medical-device definition. | 🟢 | Keep intended purpose statement; no new clinical functions without review. |
| A2 | "What feels doable?" picker | App **chooses which clinician task to show** from the answer (tiny → shortest, quiet → breathing). This is rules-based selection, not assessment, but it is the closest feature to "recommending". | 🟠 | Show all matching tasks and let the client pick, or label "Shortest task" / "Quietest task" so it's plainly a sort, not advice. Keep clinician off-switch. |
| A3 | "Something quiet" → breathing task | Hard-coded link between a preference and a specific technique. | 🟠 | Let the clinician tag tasks as "quiet" when assigning; app never infers. |
| A4 | Psychologist dashboard | Counts and dots only; "% follow-through" removed. No alerts. | 🟢 | Keep. Never add trends, flags or "at risk" indicators. |
| A5 | Calm copy ("Take a breath…") | Wellbeing language, no therapeutic claim. | 🟢 | Keep; avoid "calms anxiety" etc. |
| A6 | Do-it-now timer | Neutral utility. | 🟢 | — |
| A7 | Future CBT content / psychiatrist medication features | Would move toward regulated territory. DMHT exclusion requires referenced, displayed guidelines and is under TGA review. | 🟠 | Gate behind INTENDED_PURPOSE.md change control. |
| A8 | Mixed features | If any regulated feature is added, the whole app becomes regulated. | 🟢 | Change control already documented. |

## B. AHPRA / Psychology Board

| # | Area | Finding | Rating | Fix |
|---|---|---|---|---|
| B1 | Code of conduct (PsyBA, in force 1 Dec 2025) | Mandatory for psychologists; covers informed consent (revisited on material change), privacy, records, digital/telehealth practice and explaining service limits. Righto has no **clinician-side consent capture** or **limits-of-service** statement shown to the client at onboarding. | 🔴 | Add to client onboarding: what Righto is, that it isn't monitored, emergency steps, privacy. Psychologist attestation + "re-consent if use changes" prompt. |
| B2 | Records | Code expects clear, accurate client records held lawfully in any format. Righto data may be part of the clinical record if relied on. | 🟠 | Decide and state: either "not the clinical record — psychologist summarises in their own notes" or build export/retention to meet record rules. Add "Export to my notes" (PDF) for psychologists. |
| B3 | Title "Dr" | "Dr Chen" appears in alerts, sheets and copy. In **advertising** (store screenshots, website) a non-medical "Dr" must state profession, e.g. "Dr Maya Chen (Psychologist)". | 🟠 | In-app: show "Dr Maya Chen · Psychologist" on New task / sheet headers. Marketing assets: always include profession. |
| B4 | Advertising (National Law s133) | Store listing and site must not mislead, use testimonials, create unreasonable expectations or encourage unnecessary use. Tagline "Your way forward" is fine; avoid "proven", "cure", outcome claims, client quotes. | 🟠 | Pre-approve listing copy against AHPRA guidelines; no reviews/testimonials on marketing pages. |
| B5 | Scope & competence | Psychologists must use digital tools competently and lawfully. | 🟢 | Provide a 1-page clinician guide (what the app does/doesn't, risk workflow, privacy). |
| B6 | Cultural safety | Code embeds cultural safety. Copy and routines assume one daily pattern (coffee, lunch, teeth). | 🟢 | Let clients rename/add routines; review copy with diverse users incl. Aboriginal and Torres Strait Islander people. |

## C. Clinical-safety vulnerabilities (highest real-world risk)

| # | Finding | Rating | Fix |
|---|---|---|---|
| C1 | **Unmonitored disclosures.** Check-in free text ("What got in the way?") and notes could contain risk disclosures (self-harm, abuse). Client may expect the psychologist to see it promptly. No in-context warning. | 🔴 | Under every free-text field: "Dr Chen reads these before your session, not in real time. If you need help now, call 000 or Lifeline 13 11 14." Make "Need support now?" reachable from **every** screen (check-in, journal, timer), not just Home. Clinician guide: how often to review, what to do on discovery. No keyword scanning (keeps A-rating). |
| C2 | Share defaults: check-ins shared **on** by default; commitments shared on. | 🟠 | Consent screen sets the default explicitly; per-item toggle stays visible. Consider default off for free-text notes. |
| C3 | Psychologist can edit tasks after client planned them → mismatch. | 🟢 | Version tasks; notify client of changes. |
| C4 | Unlink / end of therapy not designed. | 🟠 | Add "End sharing with Dr Chen" for client; psychologist "Discharge client" that stops access and alerts. |

## D. Privacy & security vulnerabilities (APPs, NDB)

| # | Finding | Rating | Fix |
|---|---|---|---|
| D1 | **Prototype lock-screen notifications show health content** ("New homework from Dr Chen — Write down one worry…", "You committed to walk… trainers under your desk"). Conflicts with PRIVACY.md §4. | 🔴 | Use private default copy in the build; detail only if client opts in after unlock. Update prototype to match. |
| D2 | No app lock / consent screens in the prototype (only in docs). | 🔴 | Build Consent, App-lock and Notification-primer screens before beta. |
| D3 | Invite/link flow not designed — risk of linking to wrong psychologist or brute-forcing codes. | 🔴 | Single-use, expiring, high-entropy invite links; client confirms psychologist name + practice + AHPRA number before linking; rate-limit. |
| D4 | IDOR / access control: task, check-in and client IDs in URLs/API. | 🔴 | Row-level security on every table; server never trusts client-supplied clientId/psychId; automated tests for cross-tenant reads. |
| D5 | Psychologist account takeover exposes many clients. | 🔴 | MFA mandatory, session timeout, device list + remote sign-out, audit log of every view. |
| D6 | Push providers (APNs/FCM/Expo) are offshore. | 🟠 | Payloads carry no health content or names; fetch after unlock. Record in vendor register (APP 8). |
| D7 | Crash/analytics SDKs capturing text inputs or screen content. | 🟠 | Disable session replay; scrub breadcrumbs; no third-party analytics in v1. |
| D8 | App switcher snapshot & screenshots show content. | 🟠 | Privacy overlay on background; optional screenshot block on Journal/review. |
| D9 | Shared/family devices. | 🟠 | App lock default on; "Hide Righto content from notifications" default on. |
| D10 | Local storage of journal/offline cache. | 🟠 | Encrypted store; wipe on sign-out; jailbreak/root warning. |
| D11 | Data retention vs Board record-keeping duties. | 🟠 | Retention schedule agreed with psychologists; client delete ≠ psychologist record if exported. Document. |
| D12 | Breach response (NDB). | 🟠 | Written plan, contact list, OAIC form ready; tabletop test pre-launch. |
| D13 | Background photo & fonts. | 🟢 | Fonts OFL ✓. Confirm photo licence in writing. |

## E. Accessibility & usability (Disability Discrimination Act, WCAG 2.2 AA)

| # | Finding | Rating | Fix |
|---|---|---|---|
| E1 | Slate italic text over the photo's lower half and on glass may drop below 4.5:1. | 🟠 | Test with real contrast tool on device; raise wash opacity behind text blocks if needed. |
| E2 | 11–13pt kickers/legends. | 🟠 | Support Dynamic Type; minimum 12pt; never convey status by colour/opacity alone (dots need labels for screen readers). |
| E3 | Timer & toast need screen-reader announcements. | 🟢 | `accessibilityLiveRegion` / announce. |

---

## Priority fix list
**Before any real client (🔴):** C1 support everywhere + "not monitored" notes · D1 private notifications · D2 consent + app lock · D3 secure linking · D4 access control · D5 psychologist MFA/audit · B1 onboarding limits-of-service + consent.
**Before public launch (🟠):** A2/A3 picker as a sort with clinician tags · B2 records position + export · B3 "Dr … · Psychologist" · B4 listing copy review · C2 share defaults · C4 unlink/discharge · D6–D12 · E1–E2.
**Ongoing:** change control (INTENDED_PURPOSE.md), annual pen test, PIA refresh, Code of conduct re-consent on material change.
