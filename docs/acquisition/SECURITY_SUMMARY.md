# Security summary

See `docs/security/` for the full set (architecture, data flows, threat model, privacy controls, incident
response). Highlights of implemented controls: Supabase RLS on every user table; server-side authorisation;
narrow service-role use; hashed tenant API keys; tenant-scoped member resolution (tested); Svix-verified
inbound webhook; 128-bit forwarding tokens; idempotency; per-tenant rate limits (per instance);
capability-gated actions with engine-enforced approval; evidence-gated verification; append-only lifecycle
history; injection handling in deterministic readers; employer reporting with k-anonymity (10).

**Known gaps before a commercial pilot:** shared rate limiter; self-service account deletion and data export;
retention schedule; monitoring/alerting; secret rotation procedure; independent penetration test; region
confirmation for APP 8; moving accounts from personal to company ownership. **No certifications held.**
