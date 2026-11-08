# API documentation

- OpenAPI 3.1: `docs/api/openapi.yaml`.
- Handler: `lib/bear/enterprise/api.ts` (framework-agnostic); Next.js adapter: `app/api/v1/[...path]/route.ts`.
- Enable with `BEAR_ENTERPRISE_API_ENABLED=on` (needs `SUPABASE_SERVICE_ROLE_KEY`) and apply
  `supabase/migrations/20261109130000_bear_enterprise.sql`.
- Create a tenant and key: insert into `bear_tenants`, then store `sha256(key)` in `bear_tenant_keys`
  (a key looks like `lbk_…`; generate with `newApiKey()` in `lib/bear/enterprise/tenants.ts`). There is no
  admin UI yet.
- Contract tests: `tests/bear-enterprise-api.test.mjs` (auth, isolation, idempotency, rate limits,
  reporting suppression, white-label safety, deprovisioning, actions honesty).
