import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, addSource, addItem, setDistilled, confirmTakeaway, setRoute, proposeTheme, respondToTheme, confirmedThemes, createExperiment, recordReflection, deleteItem, proposeFact, respondToFact, visibleFacts, manualRecord, startConversation, appendMessage, setExperimentStatus, enqueueUrls} from '../lib/reckon/model.ts';
import {deriveOsProposals} from '../lib/reckon/os.ts';
import {seedState, SEED_CLUSTER_A, SEED_CLUSTER_B, SEED_NOISE, GOVIND_TEST_BATCH} from '../lib/reckon/seed.ts';
import {findCandidateClusters, novelClusters} from '../lib/reckon/threads.ts';
import {selectContext} from '../lib/reckon/retrieval.ts';
import {nextStep, classify, barriersFor} from '../lib/reckon/reflection.ts';
import {summariseExperiment} from '../lib/reckon/learning.ts';
import {needsSafeResponse} from '../lib/reckon/safety.ts';
import * as fallback from '../lib/reckon/ai/fallback.ts';

function withItem(state = emptyState(), caption = 'Start before you feel ready.') {
  const s = addSource(state, {platform: 'instagram', type: 'reel', url: 'https://www.instagram.com/p/x/', retrieval: {...manualRecord('manual'), status: 'retrieved', method: 'embed_page'}, caption});
  const it = addItem(s.state, s.source.id, 'reckoned');
  return {state: it.state, item: it.item, source: s.source};
}

test('AI inference and user-confirmed meaning are stored separately with provenance', () => {
  let {state, item} = withItem();
  state = setDistilled(state, item.id, {text: 'Begin before readiness arrives.', basis: 'source_content', confidence: 'medium', provenance: {kind: 'ai', at: 'now', detail: 'model'}});
  let i = state.items[0];
  assert.equal(i.takeaway, undefined, 'distilling does not create a takeaway');
  assert.equal(i.distilled.provenance.kind, 'ai');
  state = confirmTakeaway(state, item.id, 'Start before I feel ready, especially with writing.', 'Begin before readiness arrives.');
  i = state.items[0];
  assert.equal(i.takeaway.status, 'user_modified');
  assert.equal(i.takeaway.originalProposal, 'Begin before readiness arrives.');
  assert.equal(i.distilled.text, 'Begin before readiness arrives.', 'the AI reading is preserved unchanged');
  state = confirmTakeaway(state, item.id, 'Begin before readiness arrives.', 'Begin before readiness arrives.');
  assert.equal(state.items[0].takeaway.status, 'user_confirmed');
  state = setRoute(state, item.id, 'DO', 'ai', ['THINK']);
  assert.equal(state.items[0].route.status, 'proposed');
  state = setRoute(state, item.id, 'BECOME', 'user');
  assert.equal(state.items[0].route.status, 'user_confirmed');
  assert.equal(state.items[0].route.provenance.kind, 'user');
});

test('seed clusters are found by structured clustering and noise is left out', () => {
  const state = seedState(emptyState());
  assert.equal(state.items.length, SEED_CLUSTER_A.length + SEED_CLUSTER_B.length + SEED_NOISE.length);
  const clusters = findCandidateClusters(state.items);
  const byText = id => state.items.find(i => i.id === id).takeaway.text;
  const a = clusters.find(c => c.sharedFacets.includes('starting_threshold'));
  const b = clusters.find(c => c.sharedFacets.includes('approval') || c.sharedFacets.includes('boundaries'));
  assert.ok(a, 'cluster A found'); assert.ok(b, 'cluster B found');
  assert.ok(a.itemIds.length >= 4, 'cluster A has most of its five: ' + a.itemIds.map(byText));
  assert.ok(b.itemIds.length >= 4, 'cluster B has most of its five: ' + b.itemIds.map(byText));
  const noise = state.items.filter(i => SEED_NOISE.some(n => n.takeaway === i.takeaway.text)).map(i => i.id);
  for (const n of noise) { assert.ok(!a.itemIds.includes(n) && !b.itemIds.includes(n), 'noise excluded: ' + byText(n)); }
  const themeA = fallback.theme({items: state.items.filter(i => a.itemIds.includes(i.id)), sharedFacets: a.sharedFacets});
  assert.ok(themeA.isMeaningful);
  assert.match(themeA.description, /Does this actually show up in your life\?/);
  assert.match(themeA.description, /I might be reading too much into it/);
});

test('theme confirmation, rejection and modification; rejected themes never reach the Personal OS', () => {
  let state = seedState(emptyState());
  const clusters = findCandidateClusters(state.items);
  const a = clusters.find(c => c.sharedFacets.includes('starting_threshold'));
  const b = clusters.find(c => c.sharedFacets.includes('approval') || c.sharedFacets.includes('boundaries'));
  const prov = {kind: 'ai', at: 'now'};
  const pa = proposeTheme(state, {title: 'starting before you feel ready', description: 'I am noticing…', confidence: 'medium', evidence: a.itemIds.map(itemId => ({itemId, weight: 1})), sharedFacets: a.sharedFacets, provenance: prov});
  state = pa.state;
  const pb = proposeTheme(state, {title: 'how I respond to disapproval', description: '…', confidence: 'medium', evidence: b.itemIds.map(itemId => ({itemId, weight: 1})), sharedFacets: b.sharedFacets, provenance: prov});
  state = pb.state;
  assert.equal(state.themes.length, 2);
  assert.ok(state.themes.every(t => t.status === 'proposed'));
  assert.equal(confirmedThemes(state).length, 0, 'proposed themes are not confirmed');
  assert.equal(proposeTheme(state, {...pa.theme}).state.themes.length, 2, 'same cluster is not proposed twice');

  state = respondToTheme(state, pa.theme.id, 'yes');
  state = respondToTheme(state, pb.theme.id, 'not_really');
  assert.equal(state.themes.find(t => t.id === pa.theme.id).status, 'user_confirmed');
  assert.equal(state.themes.find(t => t.id === pb.theme.id).status, 'rejected');
  assert.ok(state.items.filter(i => a.itemIds.includes(i.id)).every(i => i.themeIds.includes(pa.theme.id)));
  assert.ok(state.items.every(i => !i.themeIds.includes(pb.theme.id)), 'rejected theme is not linked to items');

  state = deriveOsProposals(state);
  const returning = visibleFacts(state, 'returning');
  assert.equal(returning.length, 1);
  assert.equal(returning[0].text, 'starting before you feel ready');
  assert.ok(!state.facts.some(f => f.evidence.some(e => e.kind === 'theme' && e.id === pb.theme.id)), 'rejected theme produced no OS fact');
  assert.equal(novelClusters(clusters, state.themes).length, clusters.length - 2, 'both existing clusters (confirmed and rejected) are not re-proposed');

  const ctx = selectContext(state, 'writing papers', {themeId: pa.theme.id});
  assert.equal(ctx.themes.length, 1);
  assert.ok(!ctx.themeIds.includes(pb.theme.id));

  const modified = respondToTheme(state, pa.theme.id, 'a_little', 'I put off uncertain work');
  const t = modified.themes.find(x => x.id === pa.theme.id);
  assert.equal(t.status, 'user_modified'); assert.equal(t.userWording, 'I put off uncertain work'); assert.equal(t.confidence, 'low');
});

test('conversation to experiment keeps provenance and links', () => {
  let state = seedState(emptyState());
  const c = startConversation(state, {title: 'Starting'});
  state = appendMessage(c.state, c.conversation.id, {role: 'user', content: 'Writing papers.', provenance: {kind: 'user', at: 'now'}}, 'mechanism');
  const items = state.items.slice(0, 2);
  const proposal = {kind: 'behaviour', whatMatters: 'Make progress on meaningful writing.', noticing: 'I switch to easier work when starting feels uncertain.', testing: 'Reducing the starting threshold makes beginning easier.', when: 'I first sit down for a planned writing session.', try: 'Open the manuscript before email and work for two minutes.', successMeans: 'I started.'};
  const x = createExperiment(state, proposal, {itemIds: items.map(i => i.id), conversationId: c.conversation.id, provenance: {kind: 'ai', at: 'now', detail: 'proposed in chat, accepted by user'}});
  state = x.state;
  assert.equal(state.experiments.length, 1);
  assert.equal(x.experiment.status, 'trying');
  assert.equal(x.experiment.userConfirmed, true);
  assert.equal(x.experiment.conversationId, c.conversation.id);
  assert.ok(x.experiment.nextCheckIn);
  assert.equal(state.goals.length, 1);
  assert.equal(state.goals[0].provenance.kind, 'user');
  assert.ok(items.every(i => state.items.find(j => j.id === i.id).status === 'TRYING'));
  state = deriveOsProposals(state);
  assert.equal(visibleFacts(state, 'matters')[0].text, 'Make progress on meaningful writing.');
  const pattern = visibleFacts(state, 'patterns')[0];
  assert.equal(pattern.status, 'proposed');
  assert.ok(pattern.evidence.some(e => e.kind === 'experiment' && e.id === x.experiment.id));
  assert.ok(pattern.evidence.some(e => e.kind === 'conversation' && e.id === c.conversation.id));
});

test('reflection pathway distinguishes opportunity, retrieval, transfer and consequence', () => {
  assert.equal(nextStep({}), 'opportunity');
  assert.equal(nextStep({opportunity: false}), 'done');
  assert.equal(nextStep({opportunity: true}), 'remembered');
  assert.equal(nextStep({opportunity: true, remembered: false}), 'barrier');
  assert.equal(nextStep({opportunity: true, remembered: false, barrier: 'forgot'}), 'done');
  assert.equal(nextStep({opportunity: true, remembered: true}), 'tried');
  assert.equal(nextStep({opportunity: true, remembered: true, tried: false}), 'barrier');
  assert.equal(nextStep({opportunity: true, remembered: true, tried: true}), 'helped');
  assert.equal(nextStep({opportunity: true, remembered: true, tried: true, helped: 'no'}), 'barrier');
  assert.equal(nextStep({opportunity: true, remembered: true, tried: true, helped: 'yes'}), 'done');
  assert.equal(classify({opportunity: false}), 'no_opportunity');
  assert.equal(classify({opportunity: true, remembered: false}), 'retrieval');
  assert.equal(classify({opportunity: true, remembered: true, tried: false}), 'transfer');
  assert.equal(classify({opportunity: true, remembered: true, tried: true, helped: 'somewhat'}), 'somewhat');
  assert.ok(barriersFor('tried').includes('old_habit'));
  assert.ok(barriersFor('helped').includes('didnt_help'));
});

test('learning stays cautious and can conclude an idea is not useful', () => {
  let state = emptyState();
  const x = createExperiment(state, {kind: 'behaviour', whatMatters: 'Writing', noticing: 'n', testing: 't', when: 'w', try: 'Open the manuscript first', successMeans: 'I started.'}, {provenance: {kind: 'user', at: 'now'}});
  state = x.state;
  assert.equal(summariseExperiment(x.experiment, state.reflections).verdict, 'too_early');
  for (let i = 0; i < 6; i++) state = recordReflection(state, {experimentId: x.experiment.id, opportunity: true, remembered: i !== 1, tried: i !== 1 && i !== 2, helped: i === 1 || i === 2 ? undefined : 'yes', barrier: i === 1 ? 'forgot' : i === 2 ? 'old_habit' : undefined}).state;
  const s = summariseExperiment(x.experiment, state.reflections);
  assert.deepEqual([s.opportunities, s.remembered, s.tried, s.helped], [6, 5, 4, 4]);
  assert.equal(s.verdict, 'promising');
  assert.match(s.text, /so far|seems|may/i);
  assert.equal(s.consolidationReady, false, 'four of the last five must have helped');
  const more = recordReflection(state, {experimentId: x.experiment.id, opportunity: true, remembered: true, tried: true, helped: 'yes'}).state;
  assert.ok(summariseExperiment(x.experiment, more.reflections).consolidationReady);
  state = deriveOsProposals(state);
  const helps = visibleFacts(state, 'helps');
  assert.equal(helps.length, 1); assert.equal(helps[0].status, 'proposed');
  assert.ok(helps[0].evidence.filter(e => e.kind === 'reflection').length === 6);

  let bad = emptyState();
  const y = createExperiment(bad, {kind: 'thinking', whatMatters: 'w', noticing: 'n', testing: 't', when: 'w', try: 'Generic motivational reminder', successMeans: 's'}, {provenance: {kind: 'user', at: 'now'}});
  bad = y.state;
  for (let i = 0; i < 4; i++) bad = recordReflection(bad, {experimentId: y.experiment.id, opportunity: true, remembered: true, tried: true, helped: 'no', barrier: 'didnt_help'}).state;
  const sb = summariseExperiment(y.experiment, bad.reflections);
  assert.equal(sb.verdict, 'not_useful');
  assert.match(sb.text, /may not be particularly useful/);
  bad = deriveOsProposals(bad);
  assert.equal(visibleFacts(bad, 'doesnt_help').length, 1);
  const integrated = setExperimentStatus(bad, y.experiment.id, 'integrated');
  assert.equal(integrated.experiments[0].nextCheckIn, undefined, 'integrated ideas stop asking');
});

test('Personal OS facts carry evidence, can be corrected, and removed facts stay removed', () => {
  let state = emptyState();
  const p = proposeFact(state, {section: 'principles', text: 'Start before certainty.', confidence: 'medium', evidence: [{kind: 'item', id: 'rk_1'}, {kind: 'item', id: 'rk_2'}], provenance: {kind: 'ai', at: 'now', detail: 'model'}, fingerprint: 'principle:test'});
  state = p.state;
  assert.equal(p.fact.status, 'proposed');
  state = respondToFact(state, p.fact.id, 'not_quite', 'Start before I feel certain.');
  assert.equal(state.facts[0].status, 'user_modified'); assert.equal(state.facts[0].userWording, 'Start before I feel certain.');
  state = respondToFact(state, p.fact.id, 'right');
  assert.equal(state.facts[0].status, 'user_confirmed'); assert.equal(state.facts[0].confidence, 'high');
  state = respondToFact(state, p.fact.id, 'remove');
  assert.equal(visibleFacts(state, 'principles').length, 0);
  const again = proposeFact(state, {section: 'principles', text: 'Start before certainty.', confidence: 'high', evidence: [{kind: 'item', id: 'rk_3'}], provenance: {kind: 'ai', at: 'now'}, fingerprint: 'principle:test'});
  assert.equal(again.fact, undefined, 'a removed fact is not re-proposed');
  assert.equal(visibleFacts(again.state, 'principles').length, 0);
});

test('deleting a Reckon removes its source, evidence links and weak themes', () => {
  let state = seedState(emptyState());
  const clusters = findCandidateClusters(state.items);
  const a = clusters.find(c => c.sharedFacets.includes('starting_threshold'));
  const pa = proposeTheme(state, {title: 't', description: 'd', confidence: 'medium', evidence: a.itemIds.map(itemId => ({itemId, weight: 1})), sharedFacets: a.sharedFacets, provenance: {kind: 'ai', at: 'now'}});
  state = respondToTheme(pa.state, pa.theme.id, 'yes');
  state = deriveOsProposals(state);
  const victim = state.items.find(i => a.itemIds.includes(i.id));
  const before = state.sources.length;
  state = deleteItem(state, victim.id);
  assert.equal(state.items.find(i => i.id === victim.id), undefined);
  assert.equal(state.sources.length, before - 1);
  assert.ok(state.themes.every(t => !t.evidence.some(e => e.itemId === victim.id)));
  assert.ok(state.facts.every(f => !f.evidence.some(e => e.kind === 'item' && e.id === victim.id)));
  // Delete the rest of the cluster: the theme must go too.
  for (const id of a.itemIds) state = deleteItem(state, id);
  assert.equal(state.themes.length, 0);
  assert.equal(deleteItem(state, 'missing'), state);
});

test('queue, safety and test batch helpers', () => {
  const state = enqueueUrls(emptyState(), GOVIND_TEST_BATCH, 'Govind');
  assert.equal(state.queue.length, 5);
  assert.equal(enqueueUrls(state, GOVIND_TEST_BATCH).queue.length, 5);
  assert.ok(needsSafeResponse("some days I don't want to be alive"));
  assert.ok(!needsSafeResponse('I want to start my paper earlier'));
});

test('scripted fallback chat follows the staged rhythm and only offers after mechanism', () => {
  let state = seedState(emptyState());
  const clusters = findCandidateClusters(state.items);
  const a = clusters.find(c => c.sharedFacets.includes('starting_threshold'));
  const pa = proposeTheme(state, {title: 'starting before you feel ready', description: 'd', confidence: 'medium', evidence: a.itemIds.map(itemId => ({itemId, weight: 1})), sharedFacets: a.sharedFacets, provenance: {kind: 'ai', at: 'now'}});
  state = respondToTheme(pa.state, pa.theme.id, 'yes');
  const c = startConversation(state, {themeId: pa.theme.id});
  state = c.state;
  const ctx = () => selectContext(state, 'writing', {themeId: pa.theme.id});
  const conv = () => state.conversations[0];
  const r1 = fallback.chat({conversation: conv(), context: ctx(), userMessage: ''});
  assert.match(r1.reply, /starting before you feel ready/); assert.equal(r1.stage, 'situation'); assert.equal(r1.proposal, undefined);
  state = appendMessage(state, conv().id, {role: 'reckon', content: r1.reply, provenance: {kind: 'ai', at: 'now'}}, r1.stage);
  state = appendMessage(state, conv().id, {role: 'user', content: 'Writing papers.', provenance: {kind: 'user', at: 'now'}});
  const r2 = fallback.chat({conversation: conv(), context: ctx(), userMessage: 'Writing papers.'});
  assert.equal(r2.stage, 'mechanism'); assert.match(r2.reply, /What tends to happen/);
  state = appendMessage(state, conv().id, {role: 'reckon', content: r2.reply, provenance: {kind: 'ai', at: 'now'}}, r2.stage);
  state = appendMessage(state, conv().id, {role: 'user', content: 'I check email or do easier work.', provenance: {kind: 'user', at: 'now'}});
  const r3 = fallback.chat({conversation: conv(), context: ctx(), userMessage: 'I check email or do easier work.'});
  assert.equal(r3.stage, 'offer'); assert.match(r3.reply, /Want to test that/); assert.equal(r3.proposal, undefined);
  state = appendMessage(state, conv().id, {role: 'reckon', content: r3.reply, provenance: {kind: 'ai', at: 'now'}}, r3.stage);
  state = appendMessage(state, conv().id, {role: 'user', content: 'Yes', provenance: {kind: 'user', at: 'now'}});
  const r4 = fallback.chat({conversation: conv(), context: ctx(), userMessage: 'Yes'});
  assert.equal(r4.stage, 'experiment'); assert.ok(r4.proposal);
  assert.equal(r4.proposal.successMeans, 'I started.');
  assert.match(r4.proposal.when, /writing papers/i);
});
