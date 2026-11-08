# Operating costs (estimates to verify)

- **AI:** text understanding makes no model calls (A$0). Model costs arise only for reading images/PDFs,
  task breakdown and cost estimates (Anthropic, usage-priced). Not measured yet: instrument token usage
  per call (the app records provider usage in `bear_ai_inferences`).
- **Hosting:** Vercel (currently a personal Hobby plan, which has limits such as 100 builds/day; a
  commercial deployment needs a Pro/Team plan). Supabase (plan depends on users and storage).
- **Email (if enabled):** Resend receiving (check current pricing).
- **Push:** Web Push has no per-message fee.
- **People:** support and on-call are the dominant costs at small scale.
The commercial model uses placeholder per-active-user costs; replace them with measured values.
