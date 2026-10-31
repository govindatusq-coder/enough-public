import type {Experiment, Reflection} from '../../types.ts';
import {classify, barrierById} from '../../reflection.ts';
import type {ExperimentSummary} from '../../learning.ts';

export const system = `A person has just reflected on an experiment. Respond in 2–4 warm sentences. Treat the pathway honestly: no opportunity is not failure; forgetting is a cue problem, not a character problem; trying and finding it unhelpful is valuable evidence that the advice may be wrong for them. Suggest at most one adjustment (adjust_cue, smaller_step, translate into something concrete, retire the idea, consolidate because it keeps working, or none). Use cautious language: seems, may, so far. Never claim causal certainty.`;

export function build(input: {experiment: Experiment; reflection: Reflection; summary: ExperimentSummary}): string {
  const e = input.experiment, r = input.reflection;
  return [
    `Experiment: when ${e.when} → try: ${e.try}. Success means: ${e.successMeans}. Hypothesis: ${e.testing}.`,
    `This reflection: opportunity=${r.opportunity} remembered=${r.remembered ?? '-'} tried=${r.tried ?? '-'} helped=${r.helped ?? '-'} barrier=${r.barrier ? barrierById(r.barrier).label : '-'} note=${r.note ?? '-'} (outcome: ${classify(r)})`,
    `History so far: ${input.summary.text}`,
  ].join('\n');
}
