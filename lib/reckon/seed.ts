/**
 * Synthetic seed Reckons for development. Clearly marked `isSeed`.
 * They let Find the Thread be exercised before real data exists.
 */
import type {ReckonState, SemanticFeatures} from './types.ts';
import {addSource, addItem, confirmTakeaway, setRoute, setSemantic, manualRecord} from './model.ts';

interface SeedSpec {
  takeaway: string;
  source: string;
  route: 'KNOW' | 'THINK' | 'DO' | 'FEEL' | 'RELATE' | 'BECOME' | 'CREATE' | 'REMEMBER';
  semantic: Omit<SemanticFeatures, 'provenance' | 'confidence' | 'entities'>;
}

const seedProv = (detail: string) => ({kind: 'seed' as const, at: new Date().toISOString(), detail});

export const SEED_CLUSTER_A: SeedSpec[] = [
  {takeaway: 'Motivation follows action, not the other way round.', source: 'A creator talking about why waiting to feel like it never works.', route: 'DO',
    semantic: {topic: 'motivation', principle: 'act first; the feeling follows', desiredChange: 'stop waiting to feel motivated before starting', behavioural: 'begin without the feeling', cognitive: 'motivation is a result, not a prerequisite', contexts: ['work', 'creative projects'], facets: ['starting_threshold', 'motivation']}},
  {takeaway: 'Make the first step ridiculously small.', source: 'A Reel about shrinking tasks until starting is trivial.', route: 'DO',
    semantic: {topic: 'getting started', principle: 'lower the threshold for the first step', desiredChange: 'start more easily', behavioural: 'shrink the first action', contexts: ['work'], facets: ['starting_threshold', 'avoidance']}},
  {takeaway: 'Perfectionism can be a form of avoidance.', source: 'A psychologist on how high standards delay starting.', route: 'THINK',
    semantic: {topic: 'perfectionism', principle: 'high standards can protect you from beginning', desiredChange: 'notice when polishing is avoiding', cognitive: 'perfectionism as avoidance', emotional: 'fear of not being good enough', contexts: ['writing'], facets: ['perfectionism', 'avoidance', 'starting_threshold']}},
  {takeaway: "Don't wait until you're ready. You won't be.", source: 'A short clip about readiness being a feeling that arrives late.', route: 'BECOME',
    semantic: {topic: 'readiness', principle: 'readiness arrives after you start', desiredChange: 'begin before feeling ready', behavioural: 'start anyway', cognitive: 'readiness is not a prerequisite', contexts: ['new projects', 'decisions'], facets: ['starting_threshold', 'uncertainty', 'courage']}},
  {takeaway: 'If it takes less than two minutes, start it now.', source: 'The two-minute rule, explained.', route: 'DO',
    semantic: {topic: 'two-minute rule', principle: 'tiny starts are easy to say yes to', desiredChange: 'start more things', behavioural: 'do a two-minute version', contexts: ['daily tasks'], facets: ['starting_threshold', 'habits']}},
];

export const SEED_CLUSTER_B: SeedSpec[] = [
  {takeaway: "You don't need everyone to agree with you.", source: 'A clip on holding your position without consensus.', route: 'FEEL',
    semantic: {topic: 'disagreement', principle: 'agreement is not required to be okay', desiredChange: 'feel steadier when people disagree', emotional: 'discomfort with disagreement', interpersonal: 'tolerating differing views', contexts: ['work', 'family'], facets: ['approval', 'boundaries']}},
  {takeaway: "Criticism isn't rejection.", source: 'A therapist on separating feedback from belonging.', route: 'THINK',
    semantic: {topic: 'criticism', principle: 'feedback about the work is not rejection of the person', desiredChange: 'take criticism less personally', cognitive: 'separate feedback from belonging', emotional: 'fear of rejection', contexts: ['work'], facets: ['approval', 'self_compassion']}},
  {takeaway: 'Stop over-explaining.', source: 'A Reel on saying no in one sentence.', route: 'DO',
    semantic: {topic: 'over-explaining', principle: 'a decision does not need a defence', desiredChange: 'explain less when saying no', behavioural: 'say no briefly', interpersonal: 'boundaries', contexts: ['requests at work'], facets: ['boundaries', 'approval']}},
  {takeaway: "Other people's disappointment isn't always yours to fix.", source: 'A clip about letting people have their reaction.', route: 'FEEL',
    semantic: {topic: "others' disappointment", principle: 'you can allow disappointment without fixing it', desiredChange: 'tolerate others being disappointed', emotional: 'guilt when others are let down', interpersonal: 'not managing others\' feelings', contexts: ['family', 'friends'], facets: ['others_feelings', 'boundaries', 'approval']}},
  {takeaway: 'Boundaries can disappoint people, and still be right.', source: 'A short talk on boundaries and disappointment.', route: 'BECOME',
    semantic: {topic: 'boundaries', principle: 'a good boundary can still disappoint someone', desiredChange: 'hold boundaries despite disappointment', interpersonal: 'boundaries', emotional: 'guilt', contexts: ['family', 'work'], facets: ['boundaries', 'others_feelings']}},
];

export const SEED_NOISE: SeedSpec[] = [
  {takeaway: 'Brown the butter before adding it to the pasta.', source: 'A 40-second pasta recipe.', route: 'REMEMBER',
    semantic: {topic: 'cooking', principle: 'browned butter adds depth', contexts: ['kitchen'], facets: ['food']}},
  {takeaway: 'The coastal walk from Bondi to Coogee is best at golden hour.', source: 'A travel Reel.', route: 'REMEMBER',
    semantic: {topic: 'travel', principle: 'light changes a place', contexts: ['weekends'], facets: ['travel']}},
  {takeaway: 'Hip mobility: 90/90 stretch for two minutes each side.', source: 'A mobility coach.', route: 'DO',
    semantic: {topic: 'mobility', principle: 'regular short stretching', behavioural: 'stretch daily', contexts: ['morning'], facets: ['fitness', 'habits']}},
  {takeaway: 'A dog trying to carry a stick through a doorway.', source: 'A clip that made me laugh.', route: 'REMEMBER',
    semantic: {topic: 'humour', principle: '', contexts: [], facets: ['humour']}},
];

export function seedState(state: ReckonState, specs: SeedSpec[] = [...SEED_CLUSTER_A, ...SEED_CLUSTER_B, ...SEED_NOISE]): ReckonState {
  let next = state;
  for (const spec of specs) {
    if (next.items.some(i => i.isSeed && i.takeaway?.text === spec.takeaway)) continue;
    const src = addSource(next, {platform: 'manual', type: 'text', manualText: spec.source, retrieval: manualRecord('manual'), title: spec.source});
    next = src.state;
    const it = addItem(next, src.source.id, 'written', {isSeed: true});
    next = it.state;
    next = confirmTakeaway(next, it.item.id, spec.takeaway);
    next = setRoute(next, it.item.id, spec.route, 'user', [], 'seed');
    next = setSemantic(next, it.item.id, {...spec.semantic, entities: [], confidence: 'medium', provenance: seedProv('synthetic seed')});
  }
  return next;
}

export function removeSeeds(state: ReckonState): ReckonState {
  const seedIds = new Set(state.items.filter(i => i.isSeed).map(i => i.id));
  const seedSources = new Set(state.items.filter(i => i.isSeed).map(i => i.sourceId));
  return {
    ...state,
    items: state.items.filter(i => !seedIds.has(i.id)),
    sources: state.sources.filter(s => !seedSources.has(s.id)),
    themes: state.themes.map(t => ({...t, evidence: t.evidence.filter(e => !seedIds.has(e.itemId))})).filter(t => t.evidence.length >= 2),
  };
}

export const GOVIND_TEST_BATCH = [
  'https://www.instagram.com/p/DcqQ7sMgBjE/',
  'https://www.instagram.com/p/DaZvB19N3U9/',
  'https://www.instagram.com/p/DesL5HSpWrW/',
  'https://www.instagram.com/p/DeSD_e6IAdH/',
  'https://www.instagram.com/p/Deom1cklqvC/',
];
