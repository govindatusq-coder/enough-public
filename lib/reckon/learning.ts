/**
 * Cautious n-of-1 learning from repeated reflections. No causal certainty.
 */
import type {Experiment, Reflection} from './types.ts';
import {classify} from './reflection.ts';

export interface ExperimentSummary {
  experimentId: string;
  opportunities: number;
  remembered: number;
  tried: number;
  helped: number;
  somewhat: number;
  didntHelp: number;
  retrievalFailures: number;
  transferFailures: number;
  barriers: Record<string, number>;
  verdict: 'too_early' | 'promising' | 'mixed' | 'retrieval_problem' | 'transfer_problem' | 'not_useful';
  text: string;
  consolidationReady: boolean;
}

export function summariseExperiment(exp: Experiment, all: Reflection[]): ExperimentSummary {
  const rs = all.filter(r => r.experimentId === exp.id);
  const s = {opportunities: 0, remembered: 0, tried: 0, helped: 0, somewhat: 0, didntHelp: 0, retrievalFailures: 0, transferFailures: 0, barriers: {} as Record<string, number>};
  for (const r of rs) {
    const o = classify(r);
    if (o === 'no_opportunity') continue;
    s.opportunities++;
    if (r.barrier) s.barriers[r.barrier] = (s.barriers[r.barrier] ?? 0) + 1;
    if (o === 'retrieval') { s.retrievalFailures++; continue; }
    s.remembered++;
    if (o === 'transfer') { s.transferFailures++; continue; }
    s.tried++;
    if (o === 'helped') s.helped++; else if (o === 'somewhat') s.somewhat++; else s.didntHelp++;
  }
  const times = (n: number) => n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
  let verdict: ExperimentSummary['verdict'] = 'too_early';
  let text = '';
  if (s.opportunities < 3) {
    text = s.opportunities === 0 ? 'No real opportunity has come up yet. That is not a failure.' : `The situation has come up ${times(s.opportunities)}. Too early to say much; worth continuing.`;
  } else if (s.retrievalFailures / s.opportunities >= 0.5) {
    verdict = 'retrieval_problem';
    text = `The situation has come up ${times(s.opportunities)}, but the idea came to mind only ${times(s.remembered)}. The cue may be the problem, not the idea.`;
  } else if (s.tried && (s.helped + 0.5 * s.somewhat) / s.tried >= 0.6) {
    verdict = 'promising';
    text = `You've tried this ${times(s.tried)} across ${times(s.opportunities)} the situation came up. On ${s.helped} ${s.helped === 1 ? 'occasion' : 'occasions'} it helped${s.somewhat ? ` and on ${s.somewhat} it helped somewhat` : ''}. So far, this seems useful for you. Worth continuing to test.`;
  } else if (s.transferFailures / s.opportunities >= 0.5) {
    verdict = 'transfer_problem';
    text = `You remembered it ${times(s.remembered)} but tried it ${times(s.tried)}. Something between remembering and doing may need adjusting.`;
  } else if (s.tried >= 3 && s.didntHelp / s.tried >= 0.6) {
    verdict = 'not_useful';
    text = `You've genuinely tried this ${times(s.tried)} and it has mostly not helped. This idea may not be particularly useful for you. Internet advice is not assumed to be right.`;
  } else {
    verdict = 'mixed';
    text = `Results so far are mixed: ${s.helped} helped, ${s.somewhat} somewhat, ${s.didntHelp} didn't. May be worth a different cue or a smaller step.`;
  }
  const recentTried = rs.filter(r => classify(r) !== 'no_opportunity').slice(-5);
  const consolidationReady = recentTried.length >= 4 && recentTried.filter(r => classify(r) === 'helped').length >= 4 && exp.status !== 'integrated';
  return {experimentId: exp.id, ...s, verdict, text, consolidationReady};
}
