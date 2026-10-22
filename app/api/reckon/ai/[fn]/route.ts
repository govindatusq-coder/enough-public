import * as ai from '@/lib/reckon/ai/functions';
import {selectContext} from '@/lib/reckon/retrieval';
import {summariseExperiment} from '@/lib/reckon/learning';
import {needsSafeResponse, SAFE_RESPONSE} from '@/lib/reckon/safety';
import type {ReckonState} from '@/lib/reckon/types';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

type Handler = (body: Record<string, unknown>) => Promise<unknown>;

/**
 * State lives in the browser; each call carries only what the function needs.
 * The server is stateless and keeps nothing after responding.
 */
const handlers: Record<string, Handler> = {
  distil: b => ai.distil(b.source as never),
  takeaway: b => ai.takeaway({userWords: String(b.userWords ?? ''), source: b.source as never}),
  route: b => ai.route({takeaway: String(b.takeaway ?? ''), userNote: b.userNote as string | undefined}),
  features: b => ai.features({takeaway: String(b.takeaway ?? ''), userNote: b.userNote as string | undefined, route: b.route as string | undefined}),
  theme: b => ai.theme({items: b.items as never, sharedFacets: (b.sharedFacets as string[]) ?? []}),
  explain: b => ai.explain(b as never),
  formulation: b => ai.formulation({conversation: b.conversation as never}),
  experiment: b => ai.experiment({conversation: b.conversation as never, items: (b.items as never) ?? [], themes: (b.themes as never) ?? []}),
  osUpdate: b => ai.osUpdate({conversation: b.conversation as never, experiment: b.experiment as never, itemIds: (b.itemIds as string[]) ?? []}),
  reflection: async b => {
    const state = b.state as ReckonState;
    const experiment = state.experiments.find(e => e.id === b.experimentId)!;
    const reflection = state.reflections.find(r => r.id === b.reflectionId)!;
    return ai.reflection({experiment, reflection, summary: summariseExperiment(experiment, state.reflections)});
  },
  chat: async b => {
    const state = b.state as ReckonState;
    const conversation = state.conversations.find(c => c.id === b.conversationId)!;
    const userMessage = String(b.userMessage ?? '');
    if (needsSafeResponse(userMessage)) {
      return {output: {reply: SAFE_RESPONSE, stage: 'done'}, meta: {provider: 'fallback', ms: 0, error: 'safe-response pathway'}, context: {itemIds: [], themeIds: [], experimentIds: [], factIds: [], reflectionIds: []}, safety: true};
    }
    const context = selectContext(state, [userMessage, ...conversation.messages.slice(-3).map(m => m.content)].join(' '), {themeId: conversation.themeId, itemId: conversation.itemId, experimentId: conversation.experimentId});
    const result = await ai.chat({conversation, context, userMessage});
    const used = {itemIds: context.itemIds, themeIds: context.themeIds, experimentIds: context.experimentIds, factIds: context.factIds, reflectionIds: context.reflectionIds};
    return {...result, context: used};
  },
};

export async function POST(req: Request, {params}: {params: Promise<{fn: string}>}) {
  const {fn} = await params;
  const handler = handlers[fn];
  if (!handler) return Response.json({error: 'Unknown function'}, {status: 404});
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return Response.json({error: 'Invalid JSON'}, {status: 400}); }
  try {
    const result = await handler(body);
    return Response.json(result, {headers: {'Cache-Control': 'no-store'}});
  } catch (err) {
    console.error(`[reckon api] ${fn}:`, err instanceof Error ? err.message : err);
    return Response.json({error: 'Reckon could not complete that just now.'}, {status: 500});
  }
}
