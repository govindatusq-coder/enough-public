# AI evaluation framework

All data here is synthetic or small. Nothing below is evidence of real-world accuracy until independent real emails are labelled by someone other than the authors.

## Harnesses (all reproducible)
| What | Run | Data |
|---|---|---|
| Extraction benchmark (213 scenarios, dev/held-out) | `node evaluation/run.mjs` | `evaluation/dataset/scenarios.json` |
| Decision sets (ACT/ASK/WAIT/UPDATE/CLOSE/IGNORE) | `node evaluation/run-decisions.mjs`, `run-fresh.mjs <set>` | `decisions.json`, `fresh-unseen*.json` |
| Real-email samples | `node evaluation/run-real.mjs <set>` | `real-sample-5.json` in the repo; later batches are local-only and git-ignored |
| Synthetic audience (12 households, 480 emails) | `node evaluation/audience/run.mjs` | generated, seeded |
| Scorecard | `node evaluation/scorecard.mjs` | `evaluation/results/readiness-scorecard.md` |
| School-camp end-to-end | `tests/bear-school-camp-e2e.test.mjs` | real pipeline |

## Method
Labels are written and committed before a set is run; a set is only fair on its first run, after which it is development data. Dev and held-out are reported separately. Intervals are Wilson. LLM baselines are NOT RUN (no API key in the build environment); no number is estimated.

## Measures and status
Detection precision/recall, deadline accuracy, fabricated dates, duplicate and update handling: measured. Decision accuracy, false alarms, questions per 100 emails, missed deadlines: measured on synthetic data. Planning accuracy, autonomous completion, incorrect actions, notification relevance: **not measured**. User effort: measured in the camp test only (3 decisions for the person: share the notice, approve the send, tick "packed").

## Safety gates (automated)
No outward action without approval of the exact details; no repeat after a timeout; nothing "done" without evidence; no cross-household use of approvals; the log holds no recipients, amounts or text; failed actions never become complete. See `tests/bear-execution.test.mjs` and the camp test. These were mutation-checked: removing each rule makes a test fail.
