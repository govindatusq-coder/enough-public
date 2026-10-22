import 'server-only';
/**
 * Single place that talks to the model. Structured outputs only.
 * The API key never leaves the server. If no key is configured the
 * function layer falls back to deterministic heuristics and says so.
 */
import Anthropic from '@anthropic-ai/sdk';
import {zodOutputFormat} from '@anthropic-ai/sdk/helpers/zod';
import type {z} from 'zod/v4';

export const MODEL = process.env.RECKON_AI_MODEL || 'claude-opus-5-5';

export interface AiMeta {
  provider: 'anthropic' | 'fallback';
  model?: string;
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}

export function aiAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({timeout: 90_000, maxRetries: 1});
  return client;
}

export type UserContent = string | Anthropic.Beta.BetaContentBlockParam[];

export const GUARDRAILS = `House rules that apply to every Reckon prompt:
- Reckon notices, proposes, asks and learns. It never diagnoses or declares personal truths. Say "I'm noticing…", "this might…", "does this show up for you?" rather than "you are…" or "you struggle with…".
- Never present a psychological hypothesis as established fact. Never infer diagnoses, or sensitive identity characteristics, from saved content.
- Plain, warm, unhurried Australian English. No clinical or self-help jargon, no exclamation marks, no emoji, no preaching, no gamification.
- Never invent source content. If something was not retrieved, say so plainly rather than guessing what a video contained.
- One thoughtful question is better than five.`;

export async function callStructured<S extends z.ZodType>(fn: string, system: string, user: UserContent, schema: S, effort: 'low' | 'medium' | 'high' = 'low'): Promise<{output: z.infer<S>; meta: AiMeta}> {
  const started = Date.now();
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [{type: 'text', text: GUARDRAILS + '\n\n' + system, cache_control: {type: 'ephemeral'}}],
    messages: [{role: 'user', content: user}],
    output_config: {effort, format: zodOutputFormat(schema)},
  });
  const ms = Date.now() - started;
  if (response.stop_reason === 'refusal') throw new Error(`Model declined (${response.stop_details?.category ?? 'unspecified'}) in ${fn}`);
  if (!response.parsed_output) throw new Error(`Model returned no parseable output in ${fn}`);
  return {output: response.parsed_output, meta: {provider: 'anthropic', model: response.model, ms, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens}};
}
