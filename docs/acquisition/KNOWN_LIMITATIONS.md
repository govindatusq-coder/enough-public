# Known limitations (honest list)

**Product capability**
- No inbox, calendar, bank, payments, form submission, booking or contacting third parties.
- Capture is still manual (type, photo, share), except forwarding once enabled.
- Completion mostly relies on the person's confirmation; waiting is time-based.
- Text understanding is rule-based; unusual phrasing can be missed (see the benchmark error analysis).
- Household coordination is a tested foundation only (no shared storage or UI).

**Evidence**
- The benchmark is synthetic and author-written; held-out precision ~85% and recall ~84% are below the 95%/90%
  targets. LLM baselines were not run (no API key in the build environment).
- No user study, no pilot, no revenue, no buyer interest yet.

**Engineering**
- Rate limiting is per server instance. No monitoring/alerting. No admin UI for tenants and keys.
- No self-service account deletion or data export in Load Bear; no retention schedule.
- The repository mixes Load Bear with an unrelated product ("Enough"); separate before transfer.
- Accounts (GitHub, Vercel, Supabase, Apple, Anthropic) are under the founder's personal ownership.
- The launch-token exchange for single sign-on from a benefits platform is designed, not wired.
- Enterprise and inbound migrations are written but not yet applied to production.

**Not acquisition-ready by engineering alone.** A credible acquisition also needs commercial validation,
buyer interest, legal review and due diligence.
