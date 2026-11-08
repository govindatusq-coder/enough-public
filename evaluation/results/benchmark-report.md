# Benchmark report (SYNTHETIC)

**Read this first.** All 213 scenarios are synthetic and were written by the same team that built the engine (dev 93, held-out 120). Results describe this dataset only. They are likely optimistic and are **not** evidence of real-world accuracy or of reduced mental load.

**Baselines:** NOT RUN: no ANTHROPIC_API_KEY in this environment. No competitor or model results are reported or estimated.

Systems: **legacy** = the existing pipeline before this work (one item per capture, Load Pattern Engine; School pack single item); **engine** = the Responsibility Engine. 95% Wilson confidence intervals in brackets.

## Held-out phrasings (quote these)

| Metric | legacy | engine |
|---|---|---|
| Extraction precision | 81.1% [72.6–87.4] (n=106) | 85.3% [77.1–90.9] (n=102) |
| Extraction recall | 82.7% [74.3–88.8] (n=104) | 83.7% [75.4–89.5] (n=104) |
| Deadline accuracy (matched items) | 91.9% [84.1–96.0] (n=86) | 94.3% [87.2–97.5] (n=87) |
| Amount accuracy | 100.0% [70.1–100.0] (n=9) | 100.0% [70.1–100.0] (n=9) |
| Fabricated deadlines (count) | 2 | 0 |
| Correct abstention (no-action) | 0.0% [0.0–29.9] (n=9) | 88.9% [56.5–98.0] (n=9) |
| False-action rate (items invented in no-action cases) | 100.0% [70.1–100.0] (n=9) | 11.1% [2.0–43.5] (n=9) |
| Injection flagged | 0.0% [0.0–49.0] (n=4) | 100.0% [51.0–100.0] (n=4) |
| Duplicates handled (right number of open items) | 36.4% [15.2–64.6] (n=11) | 100.0% [74.1–100.0] (n=11) |
| Updated document applied | 0.0% [0.0–65.8] (n=2) | 100.0% [34.2–100.0] (n=2) |
| Dependency chains: right number of items | 33.3% [6.1–79.2] (n=3) | 100.0% [43.8–100.0] (n=3) |
| False verified completions (lifecycle, 60 days on) | n/a | 0 |
| Correction burden (fixes per scenario, proxy) | 0.425 | 0.349 |
| Latency p50 / p95 (ms) | 0.12 / 334.87 | 0.52 / 169.38 |

## All scenarios

| Metric | legacy | engine |
|---|---|---|
| Extraction precision | 80.2% [74.0–85.2] (n=192) | 92.1% [87.3–95.1] (n=189) |
| Extraction recall | 80.6% [74.4–85.6] (n=191) | 91.1% [86.2–94.4] (n=191) |
| Deadline accuracy (matched items) | 93.5% [88.5–96.4] (n=154) | 97.1% [93.5–98.8] (n=174) |
| Amount accuracy | 100.0% [81.6–100.0] (n=17) | 100.0% [82.4–100.0] (n=18) |
| Fabricated deadlines (count) | 2 | 0 |
| Correct abstention (no-action) | 0.0% [0.0–22.8] (n=13) | 92.3% [66.7–98.6] (n=13) |
| False-action rate (items invented in no-action cases) | 100.0% [77.2–100.0] (n=13) | 7.7% [1.4–33.3] (n=13) |
| Injection flagged | 0.0% [0.0–39.0] (n=6) | 100.0% [61.0–100.0] (n=6) |
| Duplicates handled (right number of open items) | 25.0% [10.2–49.5] (n=16) | 100.0% [80.6–100.0] (n=16) |
| Updated document applied | 0.0% [0.0–49.0] (n=4) | 100.0% [51.0–100.0] (n=4) |
| Dependency chains: right number of items | 20.0% [3.6–62.4] (n=5) | 100.0% [56.6–100.0] (n=5) |
| False verified completions (lifecycle, 60 days on) | n/a | 0 |
| Correction burden (fixes per scenario, proxy) | 0.443 | 0.193 |
| Latency p50 / p95 (ms) | 0.13 / 323.41 | 0.56 / 163.6 |

## By category (engine vs legacy, recall and deadline accuracy)

| Category | n | engine recall | legacy recall | engine deadline | legacy deadline | engine precision | legacy precision |
|---|---|---|---|---|---|---|---|
| simple | 131 | 93.1% [87.5–96.3] (n=131) | 90.1% [83.8–94.1] (n=131) | 96.7% [91.9–98.7] (n=122) | 100.0% [96.8–100.0] (n=118) | 96.1% [91.1–98.3] (n=127) | 90.1% [83.8–94.1] (n=131) |
| multiple | 10 | 81.8% [61.5–92.7] (n=22) | 31.8% [16.4–52.7] (n=22) | 100.0% [82.4–100.0] (n=18) | 42.9% [15.8–75.0] (n=7) | 90.0% [69.9–97.2] (n=20) | 70.0% [39.7–89.2] (n=10) |
| ambiguous_deadline | 8 | 87.5% [52.9–97.8] (n=8) | 75.0% [40.9–92.9] (n=8) | 100.0% [64.6–100.0] (n=7) | 100.0% [61.0–100.0] (n=6) | 87.5% [52.9–97.8] (n=8) | 75.0% [40.9–92.9] (n=8) |
| missing_information | 6 | 100.0% [61.0–100.0] (n=6) | 83.3% [43.6–97.0] (n=6) | 100.0% [61.0–100.0] (n=6) | 100.0% [56.6–100.0] (n=5) | 100.0% [61.0–100.0] (n=6) | 83.3% [43.6–97.0] (n=6) |
| conflicting | 3 | 66.7% [20.8–93.9] (n=3) | 66.7% [20.8–93.9] (n=3) | 100.0% [34.2–100.0] (n=2) | 50.0% [9.5–90.5] (n=2) | 50.0% [15.0–85.0] (n=4) | 66.7% [20.8–93.9] (n=3) |
| contradictory_evidence | 3 | 100.0% [43.8–100.0] (n=3) | 100.0% [43.8–100.0] (n=3) | 66.7% [20.8–93.9] (n=3) | 0.0% [0.0–56.2] (n=3) | 75.0% [30.1–95.4] (n=4) | 100.0% [43.8–100.0] (n=3) |
| duplicate | 12 | n/a | n/a | n/a | n/a | n/a | n/a |
| updated_document | 4 | n/a | n/a | n/a | n/a | n/a | n/a |
| dependency_chain | 5 | n/a | n/a | n/a | n/a | n/a | n/a |
| irrelevant_information | 5 | 100.0% [56.6–100.0] (n=5) | 80.0% [37.6–96.4] (n=5) | 100.0% [56.6–100.0] (n=5) | 100.0% [51.0–100.0] (n=4) | 83.3% [43.6–97.0] (n=6) | 80.0% [37.6–96.4] (n=5) |
| no_action | 12 | n/a | n/a | n/a | n/a | 0.0% [0.0–79.3] (n=1) | 0.0% [0.0–24.3] (n=12) |
| misleading | 4 | 66.7% [20.8–93.9] (n=3) | 33.3% [6.1–79.2] (n=3) | 100.0% [34.2–100.0] (n=2) | 0.0% [0.0–79.3] (n=1) | 50.0% [15.0–85.0] (n=4) | 25.0% [4.6–69.9] (n=4) |
| prompt_injection | 6 | 100.0% [61.0–100.0] (n=6) | 83.3% [43.6–97.0] (n=6) | 100.0% [61.0–100.0] (n=6) | 100.0% [56.6–100.0] (n=5) | 100.0% [61.0–100.0] (n=6) | 83.3% [43.6–97.0] (n=6) |
| sensitive_information | 4 | 75.0% [30.1–95.4] (n=4) | 75.0% [30.1–95.4] (n=4) | 100.0% [43.8–100.0] (n=3) | 66.7% [20.8–93.9] (n=3) | 100.0% [43.8–100.0] (n=3) | 75.0% [30.1–95.4] (n=4) |

See error-analysis.md for every failure and cost-analysis.md for cost and latency.
