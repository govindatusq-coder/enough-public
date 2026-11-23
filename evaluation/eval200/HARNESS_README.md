# LoadBear Eval200 — Replay and Trace Harness

Runs all 200 supplied synthetic scenarios through a selectable adapter, captures each **reported** agent action in append-only JSONL traces, and generates conservative diagnostic scores and CSV summaries. Standard library Python 3.10+; no credentials needed for mock mode.

## Quick start

```bash
python harness.py --adapter mock --output results/mock
python harness.py --adapter mock --limit 5 --output results/smoke
python harness.py --adapter http --endpoint http://127.0.0.1:8000/evaluate --output results/loadbear
python harness.py --adapter subprocess --command python agent_adapter_example.py --output results/local
python -m unittest discover -s tests -v
```

**HTTP integration contract:** POST a JSON object with `scenario_id`, `input`, `raw_materials`, `context`, `approval_policy` and `requested_output`. Return a JSON object such as:

```json
{
  "responsibility": "Get costume ready for Friday",
  "status": "prepared",
  "actions": [
    {"kind":"interpret","description":"Read school notice","status":"completed"},
    {"kind":"plan","description":"Identify prerequisites and lead times","status":"completed"},
    {"kind":"order_draft","description":"Draft basket for review","status":"prepared","requires_approval":true,"approval_granted":false},
    {"kind":"verify","description":"Check delivery receipt","status":"blocked"}
  ],
  "parent_interventions": 1,
  "evidence": []
}
```

`--command` executes a program once per scenario; it receives one request JSON on stdin and must print one response JSON on stdout. The HTTP endpoint should be a **test/staging endpoint**, not a production task execution endpoint. HTTP is allowed only for localhost or HTTPS. Add `--token TOKEN` for bearer auth (avoid committing tokens). The harness does **not** actually approve purchases or send messages.

## Output

- `events.jsonl`: timestamped input, agent-action reports, approval gates, claimed evidence, evaluations, and errors.
- `results.jsonl`: complete response and evaluation per scenario.
- `summary.csv`: per-scenario analysis-ready results.
- `summary.json`: aggregate metrics and limitations.

## Scientific validity and security

The dataset is currently template-generated, with many implausible school-newsletter wrappers for unrelated household tasks. This is a **software smoke test**, not a publication-ready evaluation. The harness can observe agent responses but **cannot see hidden agent tool calls**; to capture actual actions, integrate an instrumentation callback or provide independently signed sandbox tool logs. `parent_interventions` is **agent-reported**, not independently measured. The grader deliberately refuses to credit `verified_complete` without a harness-verified sandbox receipt. No such simulator receipts are issued in this version; therefore verified completion will remain zero even if an agent claims success. This is intentional.

For a credible study: create realistic multi-source scenario fixtures, isolated mock service endpoints with observable state transitions, independent human adjudication, verified approval events, and counterbalanced baseline comparisons. Do not interpret heuristic scores as measured cognitive-load reduction.
