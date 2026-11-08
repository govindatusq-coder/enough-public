# Data governance

- **Data classes:** account (email, name); household context (areas, people's first names and roles);
  responsibilities (titles, dates, amounts, references, documents); behaviour events (types and counts);
  lifecycle events (state names); tenant data (tenant name, hashed keys, external member ids).
- **Sensitive classes:** children's names and schools, health-related items, finances. Never shared with
  employers; health details never inferred.
- **Ownership and access:** each person owns their data; tenants see only aggregated, suppressed counts.
- **Retention:** not yet scheduled (gap). Proposed: captures/documents while the account exists; idempotency
  and inbound message keys 7 days; behaviour events 24 months; deleted on account deletion (cascade exists).
- **Research:** opt-in only; pseudonymous; counts only (docs/research/DATA_DICTIONARY.md).
- **Subprocessors:** Vercel, Supabase, Anthropic (optional), Resend (optional), Apple (TestFlight shell).
