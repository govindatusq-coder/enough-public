/**
 * Pure state transitions for Reckon. No React, no network, no storage.
 * Every function returns a new state; the store persists it.
 */
import type {
  ReckonState, Source, ReckonItem, Insight, Route, RouteFunction, SemanticFeatures, Theme,
  ThemeResponse, Experiment, ExperimentProposal, Reflection, Conversation, ConversationMessage,
  PersonalOSFact, OSSection, EvidenceRef, Confidence, Provenance, IngestionRecord, CaptureMode,
  Goal, QueuedUrl, AiCallLog, ExperimentStatus, Barrier, Helped, ItemStatus,
} from './types.ts';
import {newId, now} from './ids.ts';

export const LOCAL_USER = 'local';

export function emptyState(at = now()): ReckonState {
  return {
    version: 1,
    user: {id: LOCAL_USER, userId: LOCAL_USER, createdAt: at, updatedAt: at},
    sources: [], items: [], themes: [], goals: [], experiments: [], reflections: [],
    conversations: [], facts: [], queue: [], aiLog: [],
  };
}

const base = (prefix: string, at = now()) => ({id: newId(prefix), userId: LOCAL_USER, createdAt: at, updatedAt: at});
const touch = <T extends {updatedAt: string}>(e: T, at = now()): T => ({...e, updatedAt: at});
const userProv = (detail?: string): Provenance => ({kind: 'user', at: now(), detail});

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export function enqueueUrls(state: ReckonState, urls: string[], label?: string): ReckonState {
  const existing = new Set(state.queue.map(q => q.url));
  const added: QueuedUrl[] = urls.filter(u => !existing.has(u)).map(url => ({id: newId('q'), url, addedAt: now(), label}));
  return {...state, queue: [...state.queue, ...added]};
}
export function dequeueUrl(state: ReckonState, id: string): ReckonState {
  return {...state, queue: state.queue.filter(q => q.id !== id)};
}

/* ------------------------------------------------------------------ */
/* Sources and items                                                   */
/* ------------------------------------------------------------------ */

export function manualRecord(method: 'manual' | 'upload'): IngestionRecord {
  const at = now();
  return {status: 'not_attempted', method, attempts: [], startedAt: at, finishedAt: at,
    fieldsRetrieved: method === 'manual' ? ['manualText'] : ['imageDataUrl'], transcriptAvailable: false,
    contentAvailableToAi: true, notes: [method === 'manual' ? 'Entered by the user; nothing to retrieve.' : 'Uploaded by the user.']};
}

/** A record for a retrieval that could not even be attempted properly (server error, unreachable API). */
export function failedRecord(error: string, at = now()): IngestionRecord {
  return {status: 'failed', method: 'none', attempts: [], startedAt: at, finishedAt: at, fieldsRetrieved: [], transcriptAvailable: false, contentAvailableToAi: false, error, notes: ['Retrieval did not complete; the user supplies the meaning.']};
}

export function addSource(state: ReckonState, source: Omit<Source, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): {state: ReckonState; source: Source} {
  const full: Source = {...base('src'), ...source};
  return {state: {...state, sources: [...state.sources, full]}, source: full};
}

export function addItem(state: ReckonState, sourceId: string, captureMode: CaptureMode, extra: Partial<ReckonItem> = {}): {state: ReckonState; item: ReckonItem} {
  const item: ReckonItem = {...base('rk'), sourceId, status: 'KEPT', captureMode, embeddingStatus: 'not_available', themeIds: [], ...extra};
  return {state: {...state, items: [...state.items, item]}, item};
}

export function updateItem(state: ReckonState, id: string, patch: Partial<ReckonItem>): ReckonState {
  return {...state, items: state.items.map(i => i.id === id ? touch({...i, ...patch}) : i)};
}
export function updateSource(state: ReckonState, id: string, patch: Partial<Source>): ReckonState {
  return {...state, sources: state.sources.map(s => s.id === id ? touch({...s, ...patch}) : s)};
}

/** Record the AI's reading. Does not touch the takeaway. */
export function setDistilled(state: ReckonState, itemId: string, insight: Insight): ReckonState {
  return updateItem(state, itemId, {distilled: insight});
}

/** The user confirms (or edits) the meaning. This is the only path to a canonical takeaway. */
export function confirmTakeaway(state: ReckonState, itemId: string, text: string, originalProposal?: string): ReckonState {
  const clean = text.trim();
  const modified = !!originalProposal && originalProposal.trim() !== clean;
  return updateItem(state, itemId, {
    takeaway: {text: clean, status: modified ? 'user_modified' : 'user_confirmed', confirmedAt: now(), originalProposal},
    status: 'KEPT',
  });
}

export function setRoute(state: ReckonState, itemId: string, fn: RouteFunction, by: 'user' | 'ai', alternatives: RouteFunction[] = [], detail?: string): ReckonState {
  const route: Route = {function: fn, status: by === 'user' ? 'user_confirmed' : 'proposed', alternatives, provenance: {kind: by, at: now(), detail}};
  return updateItem(state, itemId, {route});
}

export function setSemantic(state: ReckonState, itemId: string, semantic: SemanticFeatures): ReckonState {
  return updateItem(state, itemId, {semantic, embeddingStatus: 'features_only'});
}

export function setItemStatus(state: ReckonState, itemId: string, status: ItemStatus): ReckonState {
  return updateItem(state, itemId, {status});
}

/** Delete a Reckon and everything that only existed because of it. */
export function deleteItem(state: ReckonState, itemId: string): ReckonState {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return state;
  const items = state.items.filter(i => i.id !== itemId);
  const sources = state.sources.filter(s => s.id !== item.sourceId);
  const themes = state.themes
    .map(t => ({...t, evidence: t.evidence.filter(e => e.itemId !== itemId)}))
    .filter(t => t.evidence.length >= 2);
  const keptThemeIds = new Set(themes.map(t => t.id));
  const experiments = state.experiments.map(e => ({...e, itemIds: e.itemIds.filter(i => i !== itemId), themeIds: e.themeIds.filter(t => keptThemeIds.has(t))}));
  const facts = state.facts
    .map(f => ({...f, evidence: f.evidence.filter(e => !(e.kind === 'item' && e.id === itemId) && !(e.kind === 'theme' && !keptThemeIds.has(e.id)))}))
    .filter(f => f.evidence.length > 0 || f.provenance.kind === 'user');
  const conversations = state.conversations.filter(c => c.itemId !== itemId);
  return {...state, items: items.map(i => ({...i, themeIds: i.themeIds.filter(t => keptThemeIds.has(t))})), sources, themes, experiments, facts, conversations};
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

export function fingerprint(itemIds: string[]): string {
  return [...itemIds].sort().join('|');
}

export function proposeTheme(state: ReckonState, theme: Omit<Theme, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'status' | 'clusterFingerprint'>): {state: ReckonState; theme: Theme} {
  const fp = fingerprint(theme.evidence.map(e => e.itemId));
  const existing = state.themes.find(t => t.clusterFingerprint === fp && t.status !== 'rejected');
  if (existing) return {state, theme: existing};
  const full: Theme = {...base('th'), ...theme, status: 'proposed', clusterFingerprint: fp};
  return {state: {...state, themes: [...state.themes, full]}, theme: full};
}

export function respondToTheme(state: ReckonState, themeId: string, response: ThemeResponse, userWording?: string): ReckonState {
  const at = now();
  const themes = state.themes.map(t => {
    if (t.id !== themeId) return t;
    if (response === 'not_really') return touch({...t, status: 'rejected' as const, userResponse: response, decidedAt: at}, at);
    const modified = !!userWording && userWording.trim() && userWording.trim() !== t.title;
    return touch({...t, status: modified ? 'user_modified' as const : 'user_confirmed' as const, userWording: modified ? userWording!.trim() : t.userWording,
      userResponse: response, confidence: response === 'a_little' ? 'low' as const : t.confidence, decidedAt: at}, at);
  });
  const theme = themes.find(t => t.id === themeId)!;
  const items = state.items.map(i => {
    const inTheme = theme.evidence.some(e => e.itemId === i.id);
    if (!inTheme) return i;
    const has = i.themeIds.includes(themeId);
    if (response === 'not_really') return has ? {...i, themeIds: i.themeIds.filter(t => t !== themeId)} : i;
    return has ? i : {...i, themeIds: [...i.themeIds, themeId], status: i.status === 'KEPT' ? 'EXPLORING' as const : i.status};
  });
  return {...state, themes, items};
}

/** Themes that are allowed to inform the Personal OS and chat context. */
export function confirmedThemes(state: ReckonState): Theme[] {
  return state.themes.filter(t => (t.status === 'user_confirmed' || t.status === 'user_modified') && !t.archived);
}
export const themeTitle = (t: Theme) => t.userWording || t.title;

/* ------------------------------------------------------------------ */
/* Conversations                                                       */
/* ------------------------------------------------------------------ */

export function startConversation(state: ReckonState, init: Partial<Pick<Conversation, 'title' | 'themeId' | 'itemId' | 'experimentId'>> = {}): {state: ReckonState; conversation: Conversation} {
  const conversation: Conversation = {...base('cv'), title: init.title ?? 'Talk to Reckon', messages: [], stage: 'opening', ...init};
  return {state: {...state, conversations: [...state.conversations, conversation]}, conversation};
}

export function appendMessage(state: ReckonState, conversationId: string, message: Omit<ConversationMessage, 'id' | 'at'>, stage?: Conversation['stage']): ReckonState {
  const msg: ConversationMessage = {...message, id: newId('msg'), at: now()};
  return {...state, conversations: state.conversations.map(c => c.id === conversationId ? touch({...c, messages: [...c.messages, msg], stage: stage ?? c.stage}) : c)};
}

/* ------------------------------------------------------------------ */
/* Goals and experiments                                               */
/* ------------------------------------------------------------------ */

export function ensureGoal(state: ReckonState, text: string): {state: ReckonState; goal: Goal} {
  const clean = text.trim();
  const found = state.goals.find(g => g.text.toLowerCase() === clean.toLowerCase());
  if (found) return {state, goal: found};
  const goal: Goal = {...base('gl'), text: clean, status: 'active', provenance: userProv('stated in conversation')};
  return {state: {...state, goals: [...state.goals, goal]}, goal};
}

export function createExperiment(state: ReckonState, proposal: ExperimentProposal, links: {themeIds?: string[]; itemIds?: string[]; conversationId?: string; provenance: Provenance; userModified?: boolean; nextCheckIn?: string}): {state: ReckonState; experiment: Experiment} {
  const g = proposal.whatMatters ? ensureGoal(state, proposal.whatMatters) : {state, goal: undefined};
  const experiment: Experiment = {
    ...base('xp'), kind: proposal.kind, status: 'trying', goalId: g.goal?.id,
    whatMatters: proposal.whatMatters, noticing: proposal.noticing, testing: proposal.testing, when: proposal.when,
    try: proposal.try, successMeans: proposal.successMeans, currentInterpretation: proposal.currentInterpretation,
    alternative: proposal.alternative, oldResponse: proposal.oldResponse,
    themeIds: links.themeIds ?? [], itemIds: links.itemIds ?? [], conversationId: links.conversationId,
    nextCheckIn: links.nextCheckIn ?? defaultCheckIn(), provenance: links.provenance, userConfirmed: true, userModified: !!links.userModified,
  };
  let next = {...g.state, experiments: [...g.state.experiments, experiment]};
  for (const id of experiment.itemIds) next = updateItem(next, id, {status: 'TRYING'});
  return {state: next, experiment};
}

export function defaultCheckIn(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

export function updateExperiment(state: ReckonState, id: string, patch: Partial<Experiment>): ReckonState {
  return {...state, experiments: state.experiments.map(e => e.id === id ? touch({...e, ...patch}) : e)};
}

export function setExperimentStatus(state: ReckonState, id: string, status: ExperimentStatus): ReckonState {
  let next = updateExperiment(state, id, {status, nextCheckIn: status === 'integrated' || status === 'retired' ? undefined : state.experiments.find(e => e.id === id)?.nextCheckIn});
  const exp = next.experiments.find(e => e.id === id)!;
  const itemStatus: ItemStatus | null = status === 'working' || status === 'generalising' ? 'WORKING' : status === 'integrated' ? 'INTEGRATED' : status === 'retired' ? 'KEPT' : null;
  if (itemStatus) for (const itemId of exp.itemIds) next = updateItem(next, itemId, {status: itemStatus});
  return next;
}

/* ------------------------------------------------------------------ */
/* Reflections                                                         */
/* ------------------------------------------------------------------ */

export function recordReflection(state: ReckonState, input: {experimentId: string; opportunity: boolean; remembered?: boolean; tried?: boolean; helped?: Helped; barrier?: Barrier; note?: string}): {state: ReckonState; reflection: Reflection} {
  const reflection: Reflection = {...base('rf'), ...input, provenance: userProv('reflection')};
  const next = updateExperiment({...state, reflections: [...state.reflections, reflection]}, input.experimentId, {nextCheckIn: defaultCheckIn()});
  return {state: next, reflection};
}

/* ------------------------------------------------------------------ */
/* Personal OS facts                                                   */
/* ------------------------------------------------------------------ */

export function proposeFact(state: ReckonState, fact: {section: OSSection; text: string; confidence: Confidence; evidence: EvidenceRef[]; provenance: Provenance; fingerprint: string; status?: PersonalOSFact['status']}): {state: ReckonState; fact?: PersonalOSFact} {
  const existing = state.facts.find(f => f.fingerprint === fact.fingerprint);
  if (existing) {
    // Refresh evidence on a live fact; never resurrect a rejected one.
    if (existing.status === 'rejected') return {state};
    const merged = {...existing, evidence: mergeEvidence(existing.evidence, fact.evidence), confidence: existing.status === 'proposed' ? fact.confidence : existing.confidence};
    return {state: {...state, facts: state.facts.map(f => f.id === existing.id ? touch(merged) : f)}, fact: merged};
  }
  const full: PersonalOSFact = {...base('os'), status: fact.status ?? 'proposed', ...fact};
  return {state: {...state, facts: [...state.facts, full]}, fact: full};
}

function mergeEvidence(a: EvidenceRef[], b: EvidenceRef[]): EvidenceRef[] {
  const seen = new Set(a.map(e => e.kind + ':' + e.id));
  return [...a, ...b.filter(e => !seen.has(e.kind + ':' + e.id))];
}

export function respondToFact(state: ReckonState, id: string, response: 'right' | 'not_quite' | 'remove', wording?: string): ReckonState {
  const at = now();
  if (response === 'remove') return {...state, facts: state.facts.map(f => f.id === id ? touch({...f, status: 'rejected' as const, decidedAt: at}, at) : f)};
  return {...state, facts: state.facts.map(f => {
    if (f.id !== id) return f;
    if (response === 'right') return touch({...f, status: 'user_confirmed' as const, decidedAt: at, confidence: 'high' as const}, at);
    const clean = wording?.trim();
    return clean ? touch({...f, status: 'user_modified' as const, userWording: clean, decidedAt: at}, at) : f;
  })};
}

export function visibleFacts(state: ReckonState, section: OSSection): PersonalOSFact[] {
  return state.facts.filter(f => f.section === section && f.status !== 'rejected' && !f.archived);
}
export const factText = (f: PersonalOSFact) => f.userWording || f.text;

/* ------------------------------------------------------------------ */
/* Lab                                                                 */
/* ------------------------------------------------------------------ */

export function logAi(state: ReckonState, entry: Omit<AiCallLog, 'id' | 'at'>): ReckonState {
  const log: AiCallLog = {...entry, id: newId('ai'), at: now()};
  return {...state, aiLog: [log, ...state.aiLog].slice(0, 80)};
}
