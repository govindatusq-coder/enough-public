/**
 * A small controlled vocabulary of psychological facets.
 *
 * Both the AI feature-extraction prompt and the no-AI fallback map content
 * onto these facets, which gives Find the Thread something structured to
 * compare across Reckons instead of raw topic words.
 */
export interface Facet {
  id: string;
  label: string;          // human phrasing for a candidate theme
  kind: 'behavioural' | 'cognitive' | 'emotional' | 'interpersonal' | 'identity' | 'topic';
  keywords: string[];
}

export const FACETS: Facet[] = [
  {id: 'starting_threshold', label: 'starting before you feel ready', kind: 'behavioural', keywords: ['start', 'starting', 'begin', 'first step', 'two-minute', 'two minute', '2-minute', 'small step', 'ridiculously small', 'ready', 'before you', 'motivation follows', 'action first', 'just begin', 'lower the bar', 'threshold', 'get going', 'tiny']},
  {id: 'motivation', label: 'waiting to feel motivated', kind: 'behavioural', keywords: ['motivation', 'motivated', 'discipline', 'willpower', 'feel like it', 'momentum']},
  {id: 'perfectionism', label: 'perfectionism and good enough', kind: 'cognitive', keywords: ['perfect', 'perfectionism', 'good enough', 'done is better', 'flawless', 'high standards']},
  {id: 'avoidance', label: 'putting things off', kind: 'behavioural', keywords: ['procrastinat', 'avoid', 'put off', 'putting off', 'delay', 'later', 'easier work', 'distract']},
  {id: 'approval', label: 'how you respond to disagreement or disapproval', kind: 'interpersonal', keywords: ['agree', 'disagree', 'approval', 'disapprov', 'criticism', 'critic', 'rejection', 'judge', 'judged', 'opinion', 'everyone to like', 'liked', 'validation', 'feedback']},
  {id: 'boundaries', label: 'saying no and holding boundaries', kind: 'interpersonal', keywords: ['boundar', 'say no', 'saying no', 'over-explain', 'over explain', 'overexplain', 'explain yourself', 'people-pleas', 'people pleas', 'justify', 'request']},
  {id: 'others_feelings', label: 'carrying other people\'s feelings', kind: 'interpersonal', keywords: ['disappoint', 'upset', 'their feelings', 'not yours to fix', 'not your responsibility', 'let them', 'their reaction']},
  {id: 'rest', label: 'rest and recovery', kind: 'emotional', keywords: ['rest', 'sleep', 'recover', 'burnout', 'burn out', 'tired', 'earn rest', 'exhaust', 'slow down', 'pause']},
  {id: 'attention', label: 'where your attention goes', kind: 'behavioural', keywords: ['focus', 'distraction', 'phone', 'attention', 'deep work', 'scroll', 'notification', 'email']},
  {id: 'self_compassion', label: 'how you speak to yourself', kind: 'emotional', keywords: ['kind to yourself', 'self-compassion', 'self compassion', 'forgive yourself', 'harsh', 'inner critic', 'beat yourself', 'gentle with']},
  {id: 'identity', label: 'who you want to be', kind: 'identity', keywords: ['who you are', 'become', 'identity', 'values', 'kind of person', 'live by', 'way of living', 'character']},
  {id: 'listening', label: 'understanding before solving', kind: 'interpersonal', keywords: ['listen', 'understand before', 'before solving', 'empathy', 'hear them', 'be heard', 'fix it', 'advice']},
  {id: 'relationships', label: 'closeness with the people you care about', kind: 'interpersonal', keywords: ['relationship', 'partner', 'friend', 'marriage', 'kids', 'children', 'family', 'parent', 'love']},
  {id: 'curiosity', label: 'curiosity before certainty', kind: 'cognitive', keywords: ['curious', 'curiosity', 'learn', 'question', 'wonder', 'beginner']},
  {id: 'uncertainty', label: 'tolerating not knowing', kind: 'cognitive', keywords: ['uncertain', 'certainty', 'unknown', 'control', 'not knowing', 'ambiguity', 'risk']},
  {id: 'worry', label: 'worry and overthinking', kind: 'emotional', keywords: ['anxious', 'anxiety', 'worry', 'overthink', 'rumina', 'spiral', 'calm', 'nervous']},
  {id: 'habits', label: 'building routines', kind: 'behavioural', keywords: ['habit', 'routine', 'consisten', 'daily', 'every day', 'streak', 'ritual']},
  {id: 'creating', label: 'making things', kind: 'behavioural', keywords: ['create', 'creative', 'make', 'making', 'write', 'writing', 'art', 'project', 'build', 'draft', 'paper', 'manuscript']},
  {id: 'meaning', label: 'what makes a day feel worthwhile', kind: 'identity', keywords: ['meaning', 'meaningful', 'purpose', 'matter', 'enough', 'presence', 'present', 'grateful', 'gratitude']},
  {id: 'courage', label: 'doing hard things anyway', kind: 'emotional', keywords: ['courage', 'brave', 'fear', 'afraid', 'scared', 'risk', 'bold']},
  {id: 'comparison', label: 'comparing yourself with others', kind: 'cognitive', keywords: ['compar', 'enough', 'behind', 'everyone else', 'jealous', 'envy']},
  /* topic facets so unrelated content does not get forced into a psychological cluster */
  {id: 'food', label: 'food and cooking', kind: 'topic', keywords: ['recipe', 'cook', 'bake', 'pasta', 'dinner', 'meal', 'ingredient', 'oven', 'sauce']},
  {id: 'fitness', label: 'training and movement', kind: 'topic', keywords: ['workout', 'gym', 'run', 'running', 'lift', 'stretch', 'mobility', 'exercise', 'squat', 'reps']},
  {id: 'travel', label: 'places to go', kind: 'topic', keywords: ['travel', 'trip', 'beach', 'hike', 'itinerary', 'hotel', 'flight', 'coast', 'island']},
  {id: 'money', label: 'money', kind: 'topic', keywords: ['money', 'budget', 'invest', 'saving', 'salary', 'mortgage', 'spend']},
  {id: 'home', label: 'home and objects', kind: 'topic', keywords: ['kitchen', 'garden', 'plant', 'furniture', 'house', 'renovat', 'declutter', 'tidy', 'organis']},
  {id: 'humour', label: 'things that made you laugh', kind: 'topic', keywords: ['lol', 'funny', 'hilarious', 'meme', 'joke', 'haha', 'comedy']},
];

export const FACET_IDS = FACETS.map(f => f.id);

export function facetById(id: string): Facet | undefined {
  return FACETS.find(f => f.id === id);
}

/** Keyword-based facet detection for the no-AI fallback. */
export function detectFacets(text: string, max = 4): string[] {
  const lower = ' ' + text.toLowerCase().replace(/[^\p{L}\p{N}'-]+/gu, ' ') + ' ';
  const scored = FACETS.map(f => {
    let score = 0;
    for (const k of f.keywords) {
      if (lower.includes(k.toLowerCase())) score += k.includes(' ') ? 2 : 1;
    }
    return {id: f.id, score};
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map(s => s.id);
}

const STOP = new Set('a an the and or but if so of to in on at for from by with about as into like through after over between out against during without before under around among is are was were be been being have has had do does did can could will would should may might must this that these those it its i me my we our you your they them their he she his her not no yes very just also than then there here when where which who whom what how why all any each few more most other some such only own same too s t don dont doesn isn ll ve re'.split(' '));

/** Lightweight tokeniser used by clustering and retrieval. */
export function tokens(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^'+|'+$/g, ''))
    .filter(w => w.length > 2 && !STOP.has(w))
    .map(stem);
}

function stem(w: string): string {
  return w
    .replace(/(ing|edly|ed|ly|ies|es|s)$/u, (m, _g, offset) => (offset >= 4 ? '' : m))
    .replace(/(ation|ness|ment|ful)$/u, '');
}
