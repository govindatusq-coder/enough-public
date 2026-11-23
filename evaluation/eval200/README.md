# Eval200 in Load Bear

Eval200 is a 200-scenario benchmark of household responsibilities (`eval200.jsonl`), with its own replay harness and
grader (`harness.py`, `tests/`, `HARNESS_README.md`; all unchanged from the supplied package). This folder wires it to
Load Bear's real pipeline.

## What runs
Each scenario goes through the same code the app uses:
1. Drop Bear `unload`
2. the Responsibility Resolution Engine plan (`detailView`/`ensurePlan`)
3. Got a Moment's pick (`recommend`)
4. Give it to Bear (`giveToBear`)

The same message is then sent a second time, to check Bear doesn't file it twice.

The run is sealed:
- a fresh in-memory account for a synthetic parent (no database)
- no AI provider (no keys are read, so the rule-based reading is what's measured)
- outbound network blocked and recorded
- mock services only

Load Bear has no step that sends, buys, books or pays by itself, so under the benchmark's `simulate_only` policy nothing
reaches even a mock.

Dates: each scenario is placed in the week of Monday 23 November 2026, in the household's time zone:
- AU: Sydney
- CA: Toronto
- US: New York

The bracketed envelope on each message (`[voice note; AU; received Monday 20:30]`) is treated as metadata. Only the quoted
message goes to Bear.

## Code
- `lib/bear/eval/scenario.ts`: dataset loading and dates.
- `lib/bear/eval/mocks.ts`: email, calendar, school, grocery, shopping, payments, SMS, inventory and delegation mocks.
  - Each one answers success, failure, delay or missing_info.
  - Outside effects are refused without approval, and recorded as violations.
  - `mockSmsProvider` lets Share Bear's real request code text through the mock.
- `lib/bear/eval/trace.ts`: structured events.
  - Each event's stage is one of planned, attempted, executed, verified or blocked.
  - Text is redacted.
- `lib/bear/eval/run.ts`:
  - the runner
  - cognitive-work counts, including a preliminary Residual Cognitive Load Index (RCLI) proxy
  - the harness response
- `lib/bear/eval/score.ts`: the evidence-based grader across seven dimensions, failure types, aggregates, the weakest
  scenarios and run-to-run changes.
- `app/api/eval/run-scenario`: `POST {scenario_id, mode:'simulation', record_actions:true}`. It also accepts the harness
  request.
  - It returns 404 unless `BEAR_EVAL_ENABLED=1`, and always in Vercel production.
  - It needs `Authorization: Bearer $BEAR_EVAL_TOKEN` (24+ characters).
- `app/eval`: the internal dashboard, under the same gate.
- `tests/bear-eval200.test.mjs`: unit and integration tests.

## Running
```
node scripts/eval200-run.mjs --label "what changed"         # all 200, in-process; writes runs/<id>/
# the supplied harness, over HTTP, against a local server started with BEAR_EVAL_ENABLED=1 BEAR_EVAL_TOKEN=…
python3 -I evaluation/eval200/harness.py --adapter http --endpoint http://localhost:3000/api/eval/run-scenario \
  --token "$BEAR_EVAL_TOKEN" --output evaluation/eval200/runs/<id>/harness
```

## Reading the numbers
Both graders are automated and unvalidated. They check Load Bear's trace against each scenario's text, not what happens
in a real home. Nothing here shows that Load Bear reduces mental load. The RCLI proxy is only a count of work handed back
to the parent, kept apart from any validated measure.

Verified completion is 0 by design: only independent evidence could verify an outcome, and the simulation produces none.
