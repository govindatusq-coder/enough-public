/**
 * Deterministic heuristics used when no AI key is configured (or the model
 * call fails). They never invent source content: with no retrieved material
 * and no user words, they say so.
 */
import type {z} from 'zod/v4';
import type {Source, ReckonItem, Conversation, Experiment, Reflection, ExperimentProposal, RouteFunction} from '../types.ts';
import type {SelectedContext} from '../retrieval.ts';
import type {ExperimentSummary} from '../learning.ts';
import {detectFacets, facetById} from '../facets.ts';
import {describeFacets} from '../threads.ts';
import {classify, barrierById} from '../reflection.ts';
import {themeTitle} from '../model.ts';
import type * as S from './schemas.ts';

const firstSentence = (text: string, max = 160): string => {
  const clean = text.replace(/\s+/g, ' ').replace(/#[\w]+/g, '').replace(/@[\w.]+/g, '').trim();
  const sentences = clean.split(/(?<=[.!?])\s+/);
  // Prefer the first real sentence over a short title-like fragment such as "Episode 4 / Side quest".
  const s = sentences.find(x => x.length >= 40 && !/[\/|]/.test(x.slice(0, 40))) ?? sentences[0] ?? clean;
  return s.length > max ? s.slice(0, max - 1).replace(/\s\S*$/, '') + '…' : s;
};

export function distil(source: Source): z.infer<typeof S.distilOutput> {
  const material = source.transcript || source.caption || source.manualText || '';
  if (material.trim().length < 40 && !source.manualText) return {insight: '', basis: 'source_content', confidence: 'low', enoughContent: false};
  return {insight: firstSentence(material), basis: source.manualText ? 'user_input' : 'source_content', confidence: 'low', enoughContent: true};
}

export function takeaway(input: {userWords: string; source?: Source}): z.infer<typeof S.distilOutput> {
  const words = input.userWords.trim();
  if (!words) return {insight: '', basis: 'user_input', confidence: 'low', enoughContent: false};
  let s = firstSentence(words, 180);
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (!/[.!?…]$/.test(s)) s += '.';
  return {insight: s, basis: input.source?.caption ? 'both' : 'user_input', confidence: 'medium', enoughContent: true};
}

const ROUTE_HINTS: [RegExp, RouteFunction][] = [
  [/\b(remember|keep|save|quote|beautiful|lovely)\b/i, 'REMEMBER'],
  [/\b(partner|friend|kids|children|family|listen|conversation|relationship|people|someone)\b/i, 'RELATE'],
  [/\b(be|become|live by|kind of person|values|identity|who i)\b/i, 'BECOME'],
  [/\b(make|create|write|build|draft|project|idea for)\b/i, 'CREATE'],
  [/\b(rest|calm|anxious|okay|enough|reassur|gentle|allowed|permission)\b/i, 'FEEL'],
  [/\b(try|start|do|practice|practise|habit|routine|rule|step|every|each)\b/i, 'DO'],
  [/\b(think|reframe|instead|isn't|is not|doesn't mean|perspective)\b/i, 'THINK'],
  [/\b(why|how|understand|learn|explains|because)\b/i, 'KNOW'],
];

export function route(input: {takeaway: string; userNote?: string}): z.infer<typeof S.routeOutput> {
  const text = input.takeaway + ' ' + (input.userNote ?? '');
  const hits = ROUTE_HINTS.filter(([re]) => re.test(text)).map(([, fn]) => fn);
  const primary = hits[0] ?? 'DO';
  const alternatives = [...new Set(hits.slice(1))].filter(f => f !== primary).slice(0, 2);
  if (!alternatives.length) alternatives.push(primary === 'DO' ? 'THINK' : 'DO');
  return {primary, alternatives, reason: 'Suggested from the wording (no AI key configured).'};
}

export function features(input: {takeaway: string; userNote?: string; route?: string}): z.infer<typeof S.featuresOutput> {
  const text = `${input.takeaway} ${input.userNote ?? ''}`;
  const facets = detectFacets(text);
  const primary = facets[0] ? facetById(facets[0]) : undefined;
  return {
    topic: primary?.label ?? firstSentence(input.takeaway, 60),
    principle: input.takeaway.replace(/\.$/, ''),
    desiredChange: input.route === 'DO' ? 'act on this more often' : undefined,
    behavioural: primary?.kind === 'behavioural' ? primary.label : undefined,
    cognitive: primary?.kind === 'cognitive' ? primary.label : undefined,
    emotional: primary?.kind === 'emotional' ? primary.label : undefined,
    interpersonal: primary?.kind === 'interpersonal' ? primary.label : undefined,
    contexts: [],
    entities: [],
    facets: facets.length ? facets : ['meaning'],
    confidence: 'low',
  };
}

export function theme(input: {items: ReckonItem[]; sharedFacets: string[]}): z.infer<typeof S.themeOutput> {
  const psychological = input.sharedFacets.filter(f => facetById(f)?.kind !== 'topic');
  const label = describeFacets(psychological.slice(0, 1))[0] ?? describeFacets(input.sharedFacets.slice(0, 1))[0] ?? 'a similar idea';
  const n = input.items.length;
  const variety = describeFacets(input.sharedFacets.slice(1, 3));
  const description = [`I'm noticing something.`, `${n === 2 ? 'Two' : n === 3 ? 'Three' : n === 4 ? 'Four' : n === 5 ? 'Five' : n} things you've saved seem to circle around a similar idea: ${label}.`,
    variety.length ? `Some touch on ${variety[0]}${variety[1] ? `, others on ${variety[1]}` : ''}.` : '', `I might be reading too much into it.`, `Does this actually show up in your life?`].filter(Boolean).join(' ');
  return {isMeaningful: psychological.length > 0, title: label, description, confidence: n >= 4 ? 'medium' : 'low', evidence: input.items.map(i => ({itemId: i.id, why: `"${i.takeaway?.text ?? ''}"`}))};
}

export function explain(input: {statement: string; status: string; confidence: string; evidence: string[]}): z.infer<typeof S.explainOutput> {
  return {explanation: `This entry (${input.status.replace('_', ' ')}, ${input.confidence} confidence) comes from ${input.evidence.length} piece${input.evidence.length === 1 ? '' : 's'} of evidence: ${input.evidence.slice(0, 4).join('; ')}${input.evidence.length > 4 ? '; and more' : ''}. It is a proposal, not a conclusion. You can mark it right, not quite, or remove it.`};
}

/* ------------------------------------------------------------------ */
/* Scripted conversation                                               */
/* ------------------------------------------------------------------ */

/** Lower-case only the first letter, keeping the pronoun "I" intact. */
const lc = (t: string) => t.replace(/^\s*[A-Z]/, m => m.toLowerCase()).replace(/\bi\b/g, 'I');

const yes = (t: string) => /\b(yes|yeah|yep|sure|ok|okay|let's|lets|try|go on|why not|absolutely|please)\b/i.test(t) && !/\b(no|not|don't|dont)\b/i.test(t);

export function chat(input: {conversation: Conversation; context: SelectedContext; userMessage: string}): z.infer<typeof S.chatOutput> {
  const {conversation, context, userMessage} = input;
  const theme = context.themes[0];
  const stage = conversation.stage;
  const users = conversation.messages.filter(m => m.role === 'user').map(m => m.content);
  const t = theme ? themeTitle(theme) : undefined;
  const ideas = context.items.slice(0, 3).map(i => `"${i.takeaway?.text}"`);

  if (stage === 'opening' || (!userMessage && conversation.messages.length === 0)) {
    if (!userMessage) {
      return {stage: 'situation', reply: t
        ? `You've saved several different ideas that seem to point toward the same thing: ${t}. Does that connect with anything you're dealing with at the moment?`
        : context.items.length ? `You've kept ${ideas[0]}. Is there somewhere in your life right now where that idea would matter?` : `What's on your mind? It can be something you saved, or something you're trying to work out.`};
    }
  }
  if (stage === 'opening' || stage === 'situation') {
    const sit = userMessage.trim();
    return {stage: 'mechanism', reply: `${sit.length < 40 ? `${sit.replace(/\.$/, '')}.` : 'That sounds real.'} What tends to happen at the moment you intend to start, or right when it comes up?`};
  }
  if (stage === 'mechanism') {
    const situation = users[0] ?? 'that situation';
    const happens = userMessage.trim().replace(/\.$/, '');
    const hint = theme?.sharedFacets.map(f => FACET_HYPOTHESIS[f]).find(Boolean) ?? 'making the first step smaller rather than trying to feel more ready';
    return {stage: 'offer', reply: `So perhaps knowing what to do isn't the problem. The difficult point may be the moment itself, when ${lc(happens)}. A few things you've saved${ideas.length ? ` (${ideas.slice(0, 2).join(', ')})` : ''} suggest ${hint}, rather than waiting for the feeling to change. Want to test that, around ${lc(situation).replace(/\.$/, '')}?`};
  }
  if (stage === 'offer') {
    if (yes(userMessage)) {
      return {stage: 'experiment', reply: `Here's a small version. Change anything that doesn't fit; the only thing that counts as success is the attempt.`, proposal: experiment({conversation, items: context.items, themes: context.themes})};
    }
    return {stage: 'done', reply: `That's fine. Nothing needs to turn into a task. I'll keep ${t ? `"${t}"` : 'this'} in mind, and you can come back to it whenever it's useful.`};
  }
  if (stage === 'experiment') {
    return {stage: 'done', reply: `It's on your Things I'm trying. I'll ask how it went after the next real opportunity, and nothing else until then.`};
  }
  return {stage: 'done', reply: `Noted. Is there anything else you'd like to think through?`};
}

const FACET_HYPOTHESIS: Record<string, string> = {
  starting_threshold: 'making the threshold for starting smaller',
  motivation: 'acting first and letting motivation follow',
  perfectionism: 'letting the first version be rough',
  avoidance: 'making the next step tiny and obvious',
  approval: 'letting someone disagree without treating it as a verdict on you',
  boundaries: 'saying no in one sentence and leaving it there',
  others_feelings: "letting people have their reaction without fixing it",
  listening: 'understanding before solving',
  rest: 'resting before you have earned it',
  attention: 'opening the real work before anything easier',
  self_compassion: 'speaking to yourself the way you would to a friend',
  worry: 'noticing the worry and doing the next small thing anyway',
};

const FACET_TRY: Record<string, {testing: string; try: string; success: string; kind: ExperimentProposal['kind']}> = {
  starting_threshold: {testing: 'Reducing the starting threshold makes beginning easier.', try: 'Open the real thing first and work on it for two minutes before anything easier.', success: 'I started.', kind: 'behaviour'},
  motivation: {testing: 'Acting before I feel motivated produces the motivation.', try: 'Do the first two minutes without checking how I feel about it.', success: 'I began.', kind: 'behaviour'},
  perfectionism: {testing: 'A deliberately rough first version makes starting easier.', try: 'Write the worst possible first line and keep going.', success: 'A rough version exists.', kind: 'behaviour'},
  avoidance: {testing: 'A tiny, obvious next step reduces switching to easier work.', try: 'Write the single next step on a sticky note and do only that.', success: 'I did the step.', kind: 'behaviour'},
  approval: {testing: 'Someone can dislike my decision without the decision being wrong.', try: 'Notice the urge to re-justify, and let the disagreement sit for a minute instead.', success: 'I noticed and paused.', kind: 'thinking'},
  boundaries: {testing: 'A short no is received fine more often than I expect.', try: 'Say no in one sentence, then stop talking.', success: 'I stopped after one sentence.', kind: 'behaviour'},
  others_feelings: {testing: "Other people's disappointment can pass without me fixing it.", try: 'Say "I can see this is disappointing" and leave it there.', success: 'I left it there.', kind: 'relationship'},
  listening: {testing: 'Asking before solving leads to better conversations.', try: 'Ask "Do you want me to listen, or help you think it through?"', success: 'I asked.', kind: 'relationship'},
  rest: {testing: "Resting before it's earned doesn't cost what I fear.", try: 'Take the break at the planned time, finished or not.', success: 'I took the break.', kind: 'behaviour'},
  attention: {testing: 'Opening the real work before email changes how the hour goes.', try: 'Open the current manuscript before email and work for two minutes.', success: 'I started.', kind: 'behaviour'},
};

export function experiment(input: {conversation: Conversation; items: ReckonItem[]; themes: Pick<import('../types.ts').Theme, 'sharedFacets' | 'title' | 'userWording'>[]}): ExperimentProposal {
  const users = input.conversation.messages.filter(m => m.role === 'user').map(m => m.content.trim().replace(/\.$/, ''));
  const facet = input.themes.flatMap(t => t.sharedFacets).find(f => FACET_TRY[f]) ?? input.items.flatMap(i => i.semantic?.facets ?? []).find(f => FACET_TRY[f]);
  const tpl = facet ? FACET_TRY[facet] : {testing: 'A smaller, concrete version of this idea is easier to use in the moment.', try: 'Do the smallest version of the idea for two minutes.', success: 'I tried it once.', kind: 'behaviour' as const};
  const situation = users[0] ?? 'the situation we talked about';
  const happens = users[1] ?? 'I drift toward something easier';
  const base: ExperimentProposal = {
    kind: tpl.kind,
    whatMatters: `Make progress on ${lc(situation)}.`,
    noticing: `When it's time for ${lc(situation)}, ${lc(happens)}.`,
    testing: tpl.testing,
    when: `When I first sit down for ${lc(situation)}.`,
    try: tpl.try,
    successMeans: tpl.success,
  };
  if (tpl.kind === 'thinking') return {...base, currentInterpretation: `If someone is unhappy with my decision, I probably got it wrong.`, alternative: tpl.testing, when: `When ${lc(situation)} comes up.`};
  if (tpl.kind === 'relationship') return {...base, oldResponse: 'Try to solve or explain.', when: `When ${lc(situation)}.`};
  return base;
}

export function formulation(input: {conversation: Conversation}): z.infer<typeof S.formulationOutput> {
  const users = input.conversation.messages.filter(m => m.role === 'user').map(m => m.content.trim());
  const [situation = '', happens = '', more = ''] = users;
  return {whatMatters: situation, situation, whatHappens: happens, wantDifferent: 'to start more easily', mechanism: 'the threshold at the moment of starting', readyToAct: users.length >= 3 && yes(more),
    summary: `If I've understood: ${lc(situation).replace(/\.$/, '')} matters, and at the key moment ${lc(happens).replace(/\.$/, '')}. Tell me if that's not quite it.`};
}

export function reflection(input: {experiment: Experiment; reflection: Reflection; summary: ExperimentSummary}): z.infer<typeof S.reflectionOutput> {
  const o = classify(input.reflection);
  const b = input.reflection.barrier ? barrierById(input.reflection.barrier) : undefined;
  if (o === 'no_opportunity') return {message: `No worries. If the situation didn't come up, there was nothing to try. I'll ask again after the next one.`, suggestion: 'none'};
  if (o === 'retrieval') return {message: `That's a cue problem, not a you problem. ${b?.meaning ?? ''} We could tie it to something that already happens at that moment.`, suggestion: 'adjust_cue'};
  if (o === 'transfer') return {message: `You remembered it, which is the hard part. ${b?.meaning ?? 'Something between remembering and doing got in the way.'} ${input.reflection.barrier === 'too_hard' || input.reflection.barrier === 'too_vague' ? 'Smaller or more concrete is allowed.' : ''}`.trim(), suggestion: input.reflection.barrier === 'too_vague' ? 'translate' : input.reflection.barrier === 'too_hard' ? 'smaller_step' : input.reflection.barrier === 'didnt_want_to' ? 'retire' : 'adjust_cue'};
  if (o === 'helped') return {message: input.summary.consolidationReady ? `That keeps working. ${input.summary.text} Does this feel like something you naturally do now?` : `Good. ${input.summary.text}`, suggestion: input.summary.consolidationReady ? 'consolidate' : 'continue'};
  if (o === 'somewhat') return {message: `Somewhat is still information. ${input.summary.text}`, suggestion: 'continue'};
  return {message: `Thanks for actually trying it. ${input.summary.verdict === 'not_useful' ? input.summary.text : 'One try that didn\'t help doesn\'t settle it, but it counts. Internet advice isn\'t assumed to be right for you.'}`, suggestion: input.summary.verdict === 'not_useful' ? 'retire' : 'continue'};
}

export function osUpdate(): z.infer<typeof S.osUpdateOutput> {
  // Without a model, Personal OS proposals come purely from the deterministic
  // derivation in ../os.ts, which runs client-side on every change.
  return {facts: []};
}
