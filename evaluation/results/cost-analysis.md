# Cost and latency (SYNTHETIC)

- **AI cost per scenario (text):** A$0 for both legacy and engine. The Responsibility Engine's text understanding is deterministic and makes no model calls.
- **Where AI cost does arise in the product:** reading photos/PDFs (Claude vision), breaking down bigger tasks, and estimating shopping costs. Those need ANTHROPIC_API_KEY and were not exercised here; their cost per call is not measured by this benchmark.
- **Latency (this machine, single process, in-memory store):** engine p50 0.56 ms, p95 163.6 ms; legacy p50 0.13 ms, p95 323.41 ms. App-pipeline scenarios (duplicates, updates, lifecycle) include in-memory database work and dominate p95.
- **LLM baselines:** NOT RUN: no ANTHROPIC_API_KEY in this environment. No competitor or model results are reported or estimated.
