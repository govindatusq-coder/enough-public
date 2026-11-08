# Incident response (starter runbook)

1. **Detect:** Vercel function errors and logs; Supabase logs; user reports. (No paging/monitoring
   service is configured yet. **Gap.**)
2. **Contain (fast switches, no deploy needed):** set any of these Vercel env vars to `off` and redeploy:
   `BEAR_ENTERPRISE_API_ENABLED`, `BEAR_INBOUND_EMAIL_ENABLED` (forwarding), `BEAR_COVERAGE_PACKS_ENABLED`,
   `BEAR_RESPONSIBILITY_ENGINE_ENABLED`, `BEAR_PRIORITY_ENGINE_V1`. Revoke a tenant key by setting
   `revoked_at` on `bear_tenant_keys`. Rotate the inbound webhook secret in Resend and Vercel.
3. **Rotate secrets** (only with the owner's authorisation): Supabase service role key, `ANTHROPIC_API_KEY`,
   `RESEND_API_KEY`, `BEAR_INBOUND_SECRET`, `BEAR_CRON_SECRET`, VAPID keys.
4. **Assess:** which tables and users; use `bear_responsibility_events` and `bear_behaviour_events` (no
   content) to reconstruct timelines.
5. **Notify:** if personal information is involved and serious harm is likely, the Notifiable Data Breaches
   scheme (Privacy Act 1988) requires notifying affected individuals and the OAIC. Get legal advice.
6. **Recover and review:** roll back with Vercel "Promote" of the last good deployment; migrations are
   additive with rollback SQL in each file; write a blameless review.
