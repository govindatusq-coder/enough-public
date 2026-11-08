# Privacy controls (as implemented)

- **Minimisation:** bills keep biller, amount, dates, reference and confidence; analytics events store types
  and counts, never notice text. Responsibility events hold state names and minimal flags only.
- **Owner-only access:** RLS on every user table; private document bucket.
- **Employer separation:** no employer access to individual responsibilities, children's information,
  finances, appointments, relationships, health, messages or documents. Usage reports are aggregated,
  rounded to 5 and suppressed below 10 active members.
- **Health information:** never inferred or filled in. Medical forms are identified as needing the person.
- **Research:** opt-in (`profile.research.consent`), pseudonymous HMAC participant ids, counts only.
- **Forwarding:** off by default; the person creates, replaces or turns off their address; turning it off
  deletes the route and message records. Bear only sees what is forwarded.
- **Deletion:** all user tables cascade on deletion of the auth user (`on delete cascade`). There is no
  self-service "delete my Load Bear account" button yet. **Gap:** add one before a commercial pilot.
- **Export:** everything is visible in the app; there is no one-click personal data export yet. **Gap.**
- **Retention:** no automatic retention schedule yet (idempotency keys and inbound message keys can be
  pruned after ~1 day). **Gap:** define retention per table.
- **Certifications:** none. Load Bear does not hold SOC 2, ISO 27001 or any other certification.

Australian Privacy Principles notes (not legal advice): APP 1/5 notice in Settings and the privacy page;
APP 3 sensitive (health) data is not collected beyond what the person provides; APP 6 use limited to the
person's own organisation of obligations; APP 8 cross-border disclosure to subprocessors must be disclosed
after confirming regions; APP 11 security as above; APP 12/13 access and correction in-app.
