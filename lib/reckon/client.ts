/**
 * Browser-side wrappers for the Reckon API. Keys never reach the client.
 */
import type {z} from 'zod/v4';
import type {Source, ReckonItem, ReckonState, Theme, ContextUsed, IngestionRecord} from './types.ts';
import type {DetectedSource} from './platform.ts';
import type {RetrievedContent} from './ingest/retrieve.ts';
import type * as S from './ai/schemas.ts';

export interface AiMeta { provider: 'anthropic' | 'fallback'; model?: string; ms: number; inputTokens?: number; outputTokens?: number; error?: string }
export type AiResult<T> = {output: T; meta: AiMeta};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const json = await res.json().catch(() => ({error: 'Bad response'}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

export const api = {
  status: () => fetch('/api/reckon/status', {cache: 'no-store'}).then(r => r.json()) as Promise<{ai: boolean; model: string | null; instagramOembed: boolean; devTools: boolean}>,
  ingest: (url: string) => post<{detected: DetectedSource; record: IngestionRecord; content: RetrievedContent}>('/api/reckon/ingest', {url}),
  distil: (source: Source) => post<AiResult<z.infer<typeof S.distilOutput>>>('/api/reckon/ai/distil', {source}),
  takeaway: (userWords: string, source?: Source) => post<AiResult<z.infer<typeof S.distilOutput>>>('/api/reckon/ai/takeaway', {userWords, source}),
  route: (takeaway: string, userNote?: string) => post<AiResult<z.infer<typeof S.routeOutput>>>('/api/reckon/ai/route', {takeaway, userNote}),
  features: (takeaway: string, userNote?: string, route?: string) => post<AiResult<z.infer<typeof S.featuresOutput>>>('/api/reckon/ai/features', {takeaway, userNote, route}),
  theme: (items: ReckonItem[], sharedFacets: string[]) => post<AiResult<z.infer<typeof S.themeOutput>>>('/api/reckon/ai/theme', {items, sharedFacets}),
  explain: (input: {statement: string; section?: string; status: string; confidence: string; evidence: string[]}) => post<AiResult<z.infer<typeof S.explainOutput>>>('/api/reckon/ai/explain', input),
  chat: (state: ReckonState, conversationId: string, userMessage: string) => post<AiResult<z.infer<typeof S.chatOutput>> & {context: ContextUsed; safety?: boolean}>('/api/reckon/ai/chat', {state, conversationId, userMessage}),
  experiment: (conversation: ReckonState['conversations'][number], items: ReckonItem[], themes: Theme[]) => post<AiResult<z.infer<typeof S.experimentProposal>>>('/api/reckon/ai/experiment', {conversation, items, themes}),
  reflection: (state: ReckonState, experimentId: string, reflectionId: string) => post<AiResult<z.infer<typeof S.reflectionOutput>>>('/api/reckon/ai/reflection', {state, experimentId, reflectionId}),
  osUpdate: (input: {conversation?: ReckonState['conversations'][number]; experiment?: ReckonState['experiments'][number]; itemIds: string[]}) => post<AiResult<z.infer<typeof S.osUpdateOutput>>>('/api/reckon/ai/osUpdate', input),
};
