# Integration guide (vendor-neutral; Employment Hero as the reference scenario)

No vendor API is assumed. A benefits platform integrates with Load Bear's v1 API:

1. **Offer** Load Bear as an optional benefit in the platform's catalogue.
2. **Provision** an employee: `POST /api/v1/members {externalId}` with the tenant API key. The platform's own
   employee id is used; Load Bear never exposes its internal ids.
3. **Authenticate and launch:** the platform signs a 5-minute launch token
   (`lib/bear/enterprise/benefits-adapter.ts`, `signLaunch`) and opens `/bear/launch?token=…`. The token
   exchange for a Load Bear session is **not wired yet**; it needs a decision on SSO (OIDC from the platform,
   or Supabase magic-link issuance for the member) and a partner agreement.
4. **Use:** the employee manages private responsibilities in the Load Bear experience (white-label via
   `/api/v1/branding` settings; Load Bear branding by default).
5. **Report:** `GET /api/v1/reports/usage` returns coarse aggregates, suppressed below 10 active members.
   No individual data is ever available to the employer.
6. **Deprovision:** `DELETE /api/v1/members/{externalId}`; access ends immediately. Data deletion follows the
   retention policy (to be agreed).

`MockBenefitsPlatform` demonstrates the full flow in tests. A real connector implements
`BenefitsPlatformAdapter` once the partner provides authorised access.
