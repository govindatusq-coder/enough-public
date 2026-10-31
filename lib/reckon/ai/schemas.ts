/**
 * Zod (v4) schemas shared by prompts and the API layer. Kept apart from the
 * server-only provider so tests can import them.
 */
import {z} from 'zod/v4';
import {FACET_IDS} from '../facets.ts';

export const confidence = z.enum(['low', 'medium', 'high']);
export const routeFunction = z.enum(['KNOW', 'THINK', 'DO', 'FEEL', 'RELATE', 'BECOME', 'CREATE', 'REMEMBER']);
export const experimentKind = z.enum(['behaviour', 'thinking', 'relationship', 'practice']);
export const osSection = z.enum(['matters', 'returning', 'patterns', 'principles', 'helps', 'doesnt_help', 'figuring_out']);

export const distilOutput = z.object({
  insight: z.string().describe('One sentence, the idea the person most likely wanted to keep. Declarative, no "you".'),
  basis: z.enum(['source_content', 'user_input', 'both']),
  confidence,
  enoughContent: z.boolean().describe('false if the source material is too thin to say anything honest'),
});

export const routeOutput = z.object({
  primary: routeFunction,
  alternatives: z.array(routeFunction).max(3),
  reason: z.string().max(200),
});

export const featuresOutput = z.object({
  topic: z.string(),
  principle: z.string().describe('the underlying principle in a short clause'),
  value: z.string().optional(),
  desiredChange: z.string().optional(),
  behavioural: z.string().optional(),
  cognitive: z.string().optional(),
  emotional: z.string().optional(),
  interpersonal: z.string().optional(),
  contexts: z.array(z.string()).max(5),
  entities: z.array(z.string()).max(5).describe('ONLY people or things the user explicitly named; otherwise empty'),
  facets: z.array(z.enum(FACET_IDS as [string, ...string[]])).min(1).max(4),
  confidence,
});

export const themeOutput = z.object({
  isMeaningful: z.boolean().describe('false if these only share a topic, not a psychological thread'),
  title: z.string().describe('short name for the thread, lower-case phrase e.g. "starting before you feel ready"'),
  description: z.string().describe('The cautious message to the person, 3–5 short sentences, ending with a question about whether it shows up in their life'),
  confidence,
  evidence: z.array(z.object({itemId: z.string(), why: z.string().max(140)})),
});

export const explainOutput = z.object({explanation: z.string()});

export const experimentProposal = z.object({
  kind: experimentKind,
  whatMatters: z.string(),
  noticing: z.string(),
  testing: z.string(),
  when: z.string(),
  try: z.string(),
  successMeans: z.string(),
  currentInterpretation: z.string().optional(),
  alternative: z.string().optional(),
  oldResponse: z.string().optional(),
});

export const chatOutput = z.object({
  reply: z.string(),
  stage: z.enum(['opening', 'situation', 'mechanism', 'offer', 'experiment', 'done']),
  proposal: experimentProposal.optional().describe('Only when the person has clearly agreed to try something'),
});

export const formulationOutput = z.object({
  whatMatters: z.string(),
  situation: z.string(),
  whatHappens: z.string(),
  wantDifferent: z.string(),
  mechanism: z.string(),
  readyToAct: z.boolean(),
  summary: z.string().describe('2–3 sentences reflecting this back tentatively'),
});

export const reflectionOutput = z.object({
  message: z.string().describe('2–4 sentences, warm, no judgement'),
  suggestion: z.enum(['continue', 'adjust_cue', 'smaller_step', 'translate', 'retire', 'consolidate', 'none']),
});

export const osUpdateOutput = z.object({
  facts: z.array(z.object({
    section: osSection,
    text: z.string(),
    confidence,
    evidenceItemIds: z.array(z.string()),
    why: z.string().max(200),
  })).max(5),
});
