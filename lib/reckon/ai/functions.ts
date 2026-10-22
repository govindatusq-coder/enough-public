import 'server-only';
/**
 * The twelve Reckon AI functions. Each tries the model (when configured) and
 * otherwise uses the deterministic fallback, always reporting which answered.
 */
import type {z} from 'zod/v4';
import type {Source, ReckonItem, Conversation, Experiment, Reflection, Theme} from '../types.ts';
import type {SelectedContext} from '../retrieval.ts';
import type {ExperimentSummary} from '../learning.ts';
import {aiAvailable, callStructured, type AiMeta, type UserContent} from './provider.ts';
import * as S from './schemas.ts';
import * as F from './fallback.ts';
import * as pDistil from './prompts/distil.ts';
import * as pTakeaway from './prompts/takeaway.ts';
import * as pRoute from './prompts/route.ts';
import * as pFeatures from './prompts/features.ts';
import * as pTheme from './prompts/theme.ts';
import * as pExplain from './prompts/explain.ts';
import * as pChat from './prompts/chat.ts';
import * as pFormulation from './prompts/formulation.ts';
import * as pExperiment from './prompts/experiment.ts';
import * as pReflection from './prompts/reflection.ts';
import * as pOs from './prompts/os-update.ts';

export type Result<T> = {output: T; meta: AiMeta};

async function run<S extends z.ZodType>(fn: string, system: string, user: UserContent, schema: S, fallback: () => z.infer<S>, effort: 'low' | 'medium' | 'high' = 'low'): Promise<Result<z.infer<S>>> {
  if (!aiAvailable()) return {output: fallback(), meta: {provider: 'fallback', ms: 0, error: 'ANTHROPIC_API_KEY not configured'}};
  try {
    return await callStructured(fn, system, user, schema, effort);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[reckon ai] ${fn} failed: ${message}`);
    return {output: fallback(), meta: {provider: 'fallback', ms: 0, error: message}};
  }
}

export const distil = (source: Source) => {
  const user: UserContent = source.imageDataUrl
    ? [{type: 'image', source: {type: 'base64', media_type: imageMedia(source.imageDataUrl), data: source.imageDataUrl.split(',')[1] ?? ''}}, {type: 'text', text: pDistil.build(source) + '\n\nThe person uploaded this image. Read any text in it; describe only what is visibly there.'}]
    : pDistil.build(source);
  return run('distil', pDistil.system, user, S.distilOutput, () => F.distil(source));
};

export const takeaway = (input: {userWords: string; source?: Source}) =>
  run('takeaway', pTakeaway.system, pTakeaway.build(input), S.distilOutput, () => F.takeaway(input));

export const route = (input: {takeaway: string; userNote?: string}) =>
  run('route', pRoute.system, pRoute.build(input), S.routeOutput, () => F.route(input));

export const features = (input: {takeaway: string; userNote?: string; route?: string}) =>
  run('features', pFeatures.system, pFeatures.build(input), S.featuresOutput, () => F.features(input));

export const theme = (input: {items: ReckonItem[]; sharedFacets: string[]}) =>
  run('theme', pTheme.system, pTheme.build(input), S.themeOutput, () => F.theme(input), 'medium');

export const explain = (input: {statement: string; section?: string; status: string; confidence: string; evidence: string[]}) =>
  run('explain', pExplain.system, pExplain.build(input), S.explainOutput, () => F.explain(input));

export const chat = (input: {conversation: Conversation; context: SelectedContext; userMessage: string}) =>
  run('chat', pChat.system, pChat.build(input), S.chatOutput, () => F.chat(input), 'medium');

export const formulation = (input: {conversation: Conversation}) =>
  run('formulation', pFormulation.system, pFormulation.build(input), S.formulationOutput, () => F.formulation(input));

export const experiment = (input: {conversation: Conversation; items: ReckonItem[]; themes: Theme[]}) =>
  run('experiment', pExperiment.system, pExperiment.build(input), S.experimentProposal, () => F.experiment(input), 'medium');

export const reflection = (input: {experiment: Experiment; reflection: Reflection; summary: ExperimentSummary}) =>
  run('reflection', pReflection.system, pReflection.build(input), S.reflectionOutput, () => F.reflection(input));

export const osUpdate = (input: {conversation?: Conversation; experiment?: Experiment; itemIds: string[]}) =>
  run('osUpdate', pOs.system, pOs.build(input), S.osUpdateOutput, () => F.osUpdate());

function imageMedia(dataUrl: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|gif|webp))/);
  return (m?.[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp') ?? 'image/jpeg';
}
