# Study protocol: Does Load Bear make household admin lighter? (pilot)

**Status:** ready to run in the app; needs ethics review and named researchers before recruiting.
**Study id (in the app):** `loadbear-pilot-1` (env `BEAR_STUDY_ID`).

## Question
Over six weeks of normal use, do adults who manage household admin report lower admin workload and spend
less time on it, and does anything slip less often? Secondary: usability, trust, notification burden.

## Design
Single-arm, within-person pre/post pilot (n = 10–20). Baseline survey at enrolment (about the past week),
a one-minute check-in at weeks 1–5, and a final survey at week 6. No control group, so results are
indicative only: improvement could be expectation, novelty or seasonal. A later controlled study (waitlist
or randomised) is needed for causal claims.

## Participants
Adults (18+) in Australia who are responsible for at least some household admin (bills, school, health,
renewals), own a smartphone, and can use the app in English. Exclusions: members of the research team and
their households. Recruit through personal networks or parent groups (see RECRUITMENT.md).

## Procedure
1. Participant receives the invitation with the participant information sheet and the study code.
2. Signs up for Load Bear (or uses an existing account), opens Settings → Research study → Join, enters the
   code and gives consent in the app (consent is stored with a timestamp).
3. Uses Load Bear normally for six weeks. Bear shows one quiet card in Bear Ideas when a survey is due.
4. Optional short exit interview (separate consent; outside the app).
5. Can leave any time in Settings, with the option to delete their answers.

## Measures (in the app)
| When | Measure | Items | Notes |
|---|---|---|---|
| Baseline, end | NASA-TLX, raw (household-admin wording) | 6 × 0–100 | Public domain; context adaptation not separately validated |
| Baseline, end | Context: share of admin carried, admin minutes (past 7 days) | 2 | Purpose-built |
| End | Trust in Load Bear (single item) | 1 × 1–5 | Purpose-built |
| End | System Usability Scale | 10 × 1–5 | Free with attribution |
| Weeks 1–5 | Weekly check-in: admin minutes, mental load (0–10), things that slipped, reminder burden (1–5) | 4 | Purpose-built |
| Throughout | Behavioural counts (pseudonymous, see DATA_DICTIONARY.md) | n/a | No content |

To add only after confirming permission to reproduce item wording: Work–Family Conflict Scale (Netemeyer,
Boles & McMurrian, 1996); Trust in Automation (Jian, Bisantz & Drury, 2000). A validated measure of cognitive
household labour should be chosen with a researcher; none is assumed here.

## Data handling
Survey answers are numbers only (no free text) in `bear_study_responses` (owner-only RLS). The researcher
export (`scripts/study-export.mjs`) runs locally with the service role and replaces user ids with an HMAC
pseudonym using a secret only the researcher holds. Exports contain counts and survey numbers, never item
titles, documents, names, children's details, amounts or free text. Store exports encrypted; delete after
the retention period stated in the information sheet.

## Outcomes and analysis
See ANALYSIS_PLAN.md. Primary: change in raw TLX from baseline to week 6.

## Risks
Minimal: time burden (about 15 minutes total plus normal use); possible discomfort reflecting on workload.
Participants can skip questions and leave at any time. Load Bear does not pay, submit or contact anyone, so
there is no financial risk from the app acting on their behalf.
