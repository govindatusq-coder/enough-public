/**
 * Reflection pathway and barrier model.
 *
 * OPPORTUNITY → RETRIEVAL → TRANSFER → CONSEQUENCE
 * Failure is never collapsed into "didn't comply".
 */
import type {Barrier, Helped, Reflection} from './types.ts';

export type ReflectionStep = 'opportunity' | 'remembered' | 'tried' | 'helped' | 'barrier' | 'done';

export interface ReflectionDraft {
  opportunity?: boolean;
  remembered?: boolean;
  tried?: boolean;
  helped?: Helped;
  barrier?: Barrier;
}

export function nextStep(d: ReflectionDraft): ReflectionStep {
  if (d.opportunity === undefined) return 'opportunity';
  if (d.opportunity === false) return 'done';
  if (d.remembered === undefined) return 'remembered';
  if (d.remembered === false) return d.barrier ? 'done' : 'barrier';
  if (d.tried === undefined) return 'tried';
  if (d.tried === false) return d.barrier ? 'done' : 'barrier';
  if (d.helped === undefined) return 'helped';
  if (d.helped === 'no' && !d.barrier) return 'barrier';
  return 'done';
}

export type Outcome = 'no_opportunity' | 'retrieval' | 'transfer' | 'helped' | 'somewhat' | 'didnt_help';

export function classify(r: Pick<Reflection, 'opportunity' | 'remembered' | 'tried' | 'helped'>): Outcome {
  if (!r.opportunity) return 'no_opportunity';
  if (r.remembered === false) return 'retrieval';
  if (r.tried === false) return 'transfer';
  if (r.helped === 'yes') return 'helped';
  if (r.helped === 'somewhat') return 'somewhat';
  return 'didnt_help';
}

export type BarrierProblem = 'cue' | 'timing' | 'relevance' | 'translation' | 'capability' | 'friction' | 'competing_response' | 'motivation' | 'opportunity' | 'consequence';

export const BARRIERS: {id: Barrier; label: string; problem: BarrierProblem; meaning: string}[] = [
  {id: 'forgot', label: 'I forgot', problem: 'cue', meaning: 'The cue may not be reaching you at the right moment.'},
  {id: 'wrong_time', label: 'Wrong time', problem: 'timing', meaning: 'The moment it came up may not match the cue we chose.'},
  {id: 'didnt_fit', label: "It didn't fit the situation", problem: 'relevance', meaning: 'The idea may not apply as widely as it seemed.'},
  {id: 'too_vague', label: 'It was too vague', problem: 'translation', meaning: 'The idea may need translating into a more concrete action.'},
  {id: 'didnt_know_how', label: "I didn't know how", problem: 'capability', meaning: 'This may need a skill or a worked example first.'},
  {id: 'too_hard', label: 'It was too hard', problem: 'friction', meaning: 'The step may still be too big. Smaller is allowed.'},
  {id: 'old_habit', label: 'Old habit took over', problem: 'competing_response', meaning: 'A well-worn response is competing with the new one.'},
  {id: 'didnt_want_to', label: "I didn't really want to", problem: 'motivation', meaning: 'Worth asking whether this matters to you as much as it seemed.'},
  {id: 'couldnt_in_situation', label: "I couldn't in that situation", problem: 'opportunity', meaning: 'The situation may not allow it; the cue could be wrong.'},
  {id: 'didnt_help', label: "I tried it and it didn't help", problem: 'consequence', meaning: 'The advice may simply not be right for you. That is useful to know.'},
];

export const barrierById = (id: Barrier) => BARRIERS.find(b => b.id === id)!;

/** Which barriers make sense to offer for a given failure point. */
export function barriersFor(step: 'remembered' | 'tried' | 'helped'): Barrier[] {
  if (step === 'remembered') return ['forgot', 'wrong_time'];
  if (step === 'tried') return ['wrong_time', 'didnt_fit', 'too_vague', 'didnt_know_how', 'too_hard', 'old_habit', 'didnt_want_to', 'couldnt_in_situation'];
  return ['didnt_help', 'didnt_fit', 'too_vague'];
}
