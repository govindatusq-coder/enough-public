/**
 * Context selection for Talk to Reckon. Scores stored records against the
 * conversation and returns only what is relevant, with the ids recorded so
 * the Lab can show exactly what the model saw.
 */
import type {ReckonState, ReckonItem, Theme, Experiment, PersonalOSFact, Reflection, ContextUsed} from './types.ts';
import {tokens, detectFacets} from './facets.ts';
import {confirmedThemes, themeTitle, factText} from './model.ts';
import {itemText} from './threads.ts';

export interface SelectedContext extends ContextUsed {
  items: ReckonItem[];
  themes: Theme[];
  experiments: Experiment[];
  facts: PersonalOSFact[];
  reflections: Reflection[];
}

function score(query: {tokens: Set<string>; facets: Set<string>}, text: string, facets: string[] = []): number {
  let s = 0;
  for (const t of tokens(text)) if (query.tokens.has(t)) s += 1;
  for (const f of facets) if (query.facets.has(f)) s += 2.5;
  return s;
}

export function selectContext(state: ReckonState, queryText: string, pins: {themeId?: string; itemId?: string; experimentId?: string} = {}, limits = {items: 6, themes: 3, experiments: 3, facts: 5}): SelectedContext {
  const pinned = confirmedThemes(state).find(t => t.id === pins.themeId) ?? state.themes.find(t => t.id === pins.themeId);
  const seedText = [queryText, pinned ? themeTitle(pinned) + ' ' + pinned.description : ''].join(' ');
  const q = {tokens: new Set(tokens(seedText)), facets: new Set([...(pinned?.sharedFacets ?? []), ...detectFacets(seedText)])};

  const confirmedItems = state.items.filter(i => i.takeaway && !i.archived);
  const rankedItems = confirmedItems
    .map(i => ({i, s: score(q, itemText(i), i.semantic?.facets) + (pinned?.evidence.some(e => e.itemId === i.id) ? 5 : 0) + (i.id === pins.itemId ? 10 : 0)}))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limits.items).map(x => x.i);

  const themes = confirmedThemes(state)
    .map(t => ({t, s: score(q, themeTitle(t) + ' ' + t.description, t.sharedFacets) + (t.id === pins.themeId ? 10 : 0)}))
    .filter(x => x.s > 0 || x.t.id === pins.themeId).sort((a, b) => b.s - a.s).slice(0, limits.themes).map(x => x.t);
  if (pinned && pinned.status === 'proposed' && !themes.some(t => t.id === pinned.id)) themes.unshift(pinned);

  const experiments = state.experiments.filter(e => e.status !== 'retired')
    .map(e => ({e, s: score(q, [e.whatMatters, e.noticing, e.testing, e.when, e.try].join(' ')) + (e.id === pins.experimentId ? 10 : 0) + (e.status === 'trying' ? 0.5 : 0)}))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limits.experiments).map(x => x.e);

  const facts = state.facts.filter(f => f.status === 'user_confirmed' || f.status === 'user_modified')
    .map(f => ({f, s: score(q, factText(f))})).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, limits.facts).map(x => x.f);

  const expIds = new Set(experiments.map(e => e.id));
  const reflections = state.reflections.filter(r => expIds.has(r.experimentId)).slice(-12);

  return {
    items: rankedItems, themes, experiments, facts, reflections,
    itemIds: rankedItems.map(i => i.id), themeIds: themes.map(t => t.id), experimentIds: experiments.map(e => e.id),
    factIds: facts.map(f => f.id), reflectionIds: reflections.map(r => r.id),
  };
}
