# Reckon prompts

One module per AI function. Each exports a `system` prompt and a `build()`
function that turns typed input into the user message. Output shapes live in
`../schemas.ts` and are enforced with structured outputs. `../provider.ts`
prepends the shared guardrails (notice → propose → ask → learn; never
diagnose; never invent source content) to every system prompt.

| # | Module | Purpose | Output schema |
|---|--------|---------|---------------|
| 1 | `distil.ts` | Read legitimately retrieved source content and propose what the person wanted to keep | `distilOutput` |
| 2 | `takeaway.ts` | Turn the person's own words (voice / text) into a crisp candidate takeaway | `distilOutput` |
| 3 | `route.ts` | Suggest the psychological function (KNOW / THINK / DO / FEEL / RELATE / BECOME / CREATE / REMEMBER) | `routeOutput` |
| 4 | `features.ts` | Structured semantic representation of a confirmed takeaway, incl. controlled facets | `featuresOutput` |
| 5 | `theme.ts` | Interpret a candidate cluster as a cautious higher-order theme, or reject it | `themeOutput` |
| 6 | `explain.ts` | "Why does Reckon think this?" for a theme or Personal OS fact | `explainOutput` |
| 7 | `chat.ts` | Talk to Reckon: one thoughtful question at a time, staged | `chatOutput` |
| 8 | `formulation.ts` | Collaborative formulation summary before any experiment is offered | `formulationOutput` |
| 9 | `experiment.ts` | Generate a small, falsifiable behavioural / thinking / relationship experiment | `experimentProposal` |
| 10 | `reflection.ts` | Interpret a reflection without collapsing failure into non-compliance | `reflectionOutput` |
| 11 | `os-update.ts` | Propose Personal OS facts from a conversation or experiment, always as proposals | `osUpdateOutput` |
| 12 | `../../retrieval.ts` | Context selection is deterministic (facet + token scoring), not a prompt; its selection is recorded on each message | — |

When no `ANTHROPIC_API_KEY` is configured, `../fallback.ts` supplies
deterministic heuristics for every function so the loop can still be
exercised. The Lab shows which provider answered each call.
