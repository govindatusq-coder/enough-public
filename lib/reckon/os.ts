/**
 * Personal OS derivation. Produces *proposed* facts from evidence; only the
 * user turns them into confirmed facts. Rejected facts are never revived.
 */
import type {ReckonState, EvidenceRef, Confidence} from './types.ts';
import {confirmedThemes, proposeFact, themeTitle} from './model.ts';
import {summariseExperiment} from './learning.ts';

export function deriveOsProposals(state: ReckonState): ReckonState {
  let next = state;
  const at = new Date().toISOString();
  const sys = (detail: string) => ({kind: 'system' as const, at, detail});

  // Ideas I keep returning to: confirmed themes.
  for (const t of confirmedThemes(next)) {
    const evidence: EvidenceRef[] = [{kind: 'theme', id: t.id, label: themeTitle(t)}, ...t.evidence.map(e => ({kind: 'item' as const, id: e.itemId}))];
    next = proposeFact(next, {section: 'returning', text: themeTitle(t), confidence: t.userResponse === 'a_little' ? 'low' : 'medium', evidence, provenance: sys('from a theme you confirmed'), fingerprint: 'theme:' + t.id, status: 'user_confirmed'}).state;
  }
  // Still figuring out: themes answered "a little", proposed but undecided themes are not included.
  for (const t of next.themes.filter(t => t.userResponse === 'a_little')) {
    next = proposeFact(next, {section: 'figuring_out', text: `Whether "${themeTitle(t)}" really shows up in my life`, confidence: 'low', evidence: [{kind: 'theme', id: t.id}], provenance: sys('you said this was only a little true'), fingerprint: 'theme-open:' + t.id}).state;
  }
  // What matters: user-stated goals.
  for (const g of next.goals.filter(g => g.status === 'active')) {
    const exps = next.experiments.filter(e => e.goalId === g.id);
    next = proposeFact(next, {section: 'matters', text: g.text, confidence: 'high', evidence: exps.map(e => ({kind: 'experiment' as const, id: e.id})), provenance: {kind: 'user', at, detail: 'stated while designing an experiment'}, fingerprint: 'goal:' + g.id, status: 'user_confirmed'}).state;
  }
  // Patterns: the "noticing" line of a confirmed experiment.
  for (const e of next.experiments.filter(e => e.userConfirmed && e.noticing)) {
    next = proposeFact(next, {section: 'patterns', text: e.noticing, confidence: 'medium', evidence: [{kind: 'experiment', id: e.id}, ...(e.conversationId ? [{kind: 'conversation' as const, id: e.conversationId}] : [])], provenance: sys('identified together in conversation'), fingerprint: 'noticing:' + e.id}).state;
  }
  // Principles: items routed to BECOME with a confirmed takeaway, plus thinking alternatives.
  for (const i of next.items.filter(i => i.takeaway && i.route?.function === 'BECOME' && i.route.status !== 'rejected')) {
    next = proposeFact(next, {section: 'principles', text: i.takeaway!.text, confidence: i.route!.status === 'user_confirmed' ? 'medium' : 'low', evidence: [{kind: 'item', id: i.id}], provenance: sys('something you said you wanted to live by'), fingerprint: 'principle:' + i.id}).state;
  }
  // What seems to help / doesn't: cautious learning.
  for (const e of next.experiments) {
    const s = summariseExperiment(e, next.reflections);
    const ev: EvidenceRef[] = [{kind: 'experiment', id: e.id}, ...next.reflections.filter(r => r.experimentId === e.id).map(r => ({kind: 'reflection' as const, id: r.id}))];
    const conf: Confidence = s.tried >= 5 ? 'medium' : 'low';
    if (s.verdict === 'promising') next = proposeFact(next, {section: 'helps', text: `${e.try} (so far, ${s.helped} of ${s.tried} tries helped)`, confidence: conf, evidence: ev, provenance: sys('from your reflections'), fingerprint: 'helps:' + e.id}).state;
    if (s.verdict === 'not_useful') next = proposeFact(next, {section: 'doesnt_help', text: `${e.try} (${s.didntHelp} of ${s.tried} tries didn't help)`, confidence: conf, evidence: ev, provenance: sys('from your reflections'), fingerprint: 'doesnt:' + e.id}).state;
    if (s.verdict === 'retrieval_problem') next = proposeFact(next, {section: 'figuring_out', text: `Why "${e.try}" doesn't come to mind when ${e.when.replace(/\.$/, '')}`, confidence: 'low', evidence: ev, provenance: sys('a cue problem rather than a motivation problem'), fingerprint: 'retrieval:' + e.id}).state;
  }
  return next;
}
