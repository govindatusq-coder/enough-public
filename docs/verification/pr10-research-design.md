# PR10 — design for approval

Documentation only. No research tables, migrations, collection code, surveys, dependencies or enrolment have been created. The brief asks for design approval first, so the proposed architecture is in docs/research/pr10-design.md.

The proposal specifies separate study/participant/consent/event/survey relations; owner insert/read and immutable event rows; transactionally consistent withdrawal; random study-scoped references; a strict coded event union; configurable baseline/week4/week8/week12 surveys using supplied text; and a server-only allowlist export. It includes a permissions/race/deletion/export test matrix for implementation after approval. No research state is placed in `enough_accounts.state_json`.

## Validation and limits

- 144 existing tests and TypeScript pass on the PR10 branch; diff checks clean. The unchanged application production build passed in PR9. No new implementation tests are claimed for a documentation proposal.
- Reviewed the design against the brief and existing normal account export/deletion, AI permission, outcome, plan, review and threshold flows.
- Participant information, survey instruments, eligibility, retention, study contacts and authorised researcher identities were not supplied. The design requires those before enrolment can be enabled; none has been fabricated.
- Review and approve the design before implementation. Research remains off. Rollback is removal of these documents; there is no research data or schema to roll back.
