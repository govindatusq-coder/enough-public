# Relational Priority + strategic attention

Bear reasons about a task's relationships across people and time. The person never sees the model:
the default view is a calm label, roughly how long, and one short line. "Why this matters? ⌄" is
collapsed until tapped, and then shows at most four plain-language reasons.

## Flags (on by default; set to `off` to roll back)
`BEAR_RELATIONAL_V1` (relationalPriorityV1), `BEAR_PTM_V1` (ptmInterpretationV1), plus the earlier
`BEAR_PRIORITY_ENGINE_V2`, `BEAR_STRATEGIC_ATTENTION_V1`, `BEAR_MENTAL_LOAD_V1`, `BEAR_IDEAS_V2`.

## Where it lives
- `lib/bear/priority/relational.ts`: pure. Other people (relationship type, waiting, blocked, commitment,
  dependency, relational importance vs relational pressure, confidence), the hidden power / loss exposure /
  meaning interpretation, future self (option value, future load), past self (PersonalEvidenceModel) and
  present self (load today, suggestion saturation, four-week area balance).
- `lib/bear/priority/engine.ts`: the existing sequential pipeline with relational inputs:
  reality gates (safety, deadlines, non-negotiables) → people (bounded importance lift from relational
  IMPORTANCE only; someone waiting counts as dependency leverage) → strategic protection (project
  hierarchy, strategic attention) → present self (saturation silences Bear Ideas) → past self (act earlier,
  smaller steps; timing and support only) → ownership → minimum human action.
- `lib/bear/services/priority.ts`: derives everything from data already held; plain to-dos Bear can only
  hold ("Review Maya's chapter") count as the person's to do; the next to-do in a project is the most
  worthwhile one; `priorityView` (minimal) and `whyView` (on demand, `/api/bear/tasks/[id]/why`).

## Guardrails (tested in `tests/bear-relational.test.mjs`)
- Pressure is not importance: chasing adds nothing; calling Mum outranks a pushy meeting request.
- Power is context, not privilege: a title alone adds nothing. Power shows up as responsibility (a student
  depends on you), opportunity (a collaboration) or contribution (mentoring), in kind words.
- Past behaviour predicts friction, timing and support, never importance. Lots of admin done never makes
  admin more important. Not finishing something you said really matters never lowers it.
- Present life isn't optimised away: family and presence count; heavy days make Bear quieter; a single area
  taking ~75% of four weeks damps more of the same.
- Low-confidence inference moves things only a little; the person's own answers always win
  (traffic light, "Is someone relying on you for this?", No rush).
- No internal terms or numbers reach the screen.

## What the person sees
- Task page: label (e.g. "Worth closing the loop"), "~5 minutes", one line, "Why this matters? ⌄".
  At most one question: the importance traffic light, or (in Edit) "Is someone relying on you for this?",
  only when the answer would change what Bear does.
- Project lists order themselves: Worth doing now / Worth closing the loop / Good to do this week /
  Coming up / Later is fine, with "~N min" where it helps.
- Bear Ideas: minimal priority cards ("Worth doing now · Renew the library card · ~10 min · Do it now ·
  Not now"), "Worth closing the loop", "Worth protecting time for", alongside the original mental-load
  ideas; and "Nothing else from Bear needs your attention right now." when you've carried enough today.
- My Wins: adds "N people no longer waiting on you this week".
