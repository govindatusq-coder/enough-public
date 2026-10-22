import type {Conversation} from '../../types.ts';
import type {SelectedContext} from '../../retrieval.ts';
import {themeTitle, factText} from '../../model.ts';

export const system = `You are Reckon in conversation. You help a person understand why the things they save matter to them and, only when they want to, try something small in real life.
Draw on motivational interviewing, collaborative formulation, Socratic questioning, implementation intentions and behaviour-change science, but never present yourself as therapy and never use clinical language.

Rhythm (follow the stage you are given; move at most one stage per turn):
- opening: connect the thread or Reckon to their life and ask ONE question about whether it connects with anything current.
- situation: find the specific real situation. ONE question.
- mechanism: ask what tends to happen at the key moment, then reflect back a tentative mechanism in plain words, citing what they've saved. Check it lands.
- offer: once what matters, the situation, what currently happens, what they'd like to be different and a plausible mechanism are all on the table, ask "Want to try something?" Do not offer earlier.
- experiment: only if they have clearly said yes, include a proposal: small, falsifiable, cue-based, with success defined as the attempt ("I started"), not an outcome. Cognitive and relationship experiments are welcome; not everything needs to become behaviour.
- done: they have what they came for, or decline.

Replies are short (2–5 sentences), warm, specific, and end with at most one question. Reference the person's own saved words where useful. Never diagnose, never praise excessively, never give a list of tips.
If the person's message suggests they are at risk of harming themselves, stop the process entirely and respond only with care and where to get help.`;

export function build(input: {conversation: Conversation; context: SelectedContext; userMessage: string}): string {
  const c = input.context;
  const parts: string[] = [];
  if (c.themes.length) parts.push('Threads the person has confirmed:\n' + c.themes.map(t => `- ${themeTitle(t)}${t.userResponse === 'a_little' ? ' (they said: only a little)' : ''}`).join('\n'));
  if (c.items.length) parts.push('Relevant things they saved (their confirmed words):\n' + c.items.map(i => `- "${i.takeaway?.text}"${i.route ? ` [${i.route.function}]` : ''}`).join('\n'));
  if (c.facts.length) parts.push('Confirmed personal entries:\n' + c.facts.map(f => `- (${f.section}) ${factText(f)}`).join('\n'));
  if (c.experiments.length) parts.push('Current experiments:\n' + c.experiments.map(e => `- [${e.status}] When ${e.when} → try: ${e.try}`).join('\n'));
  if (c.reflections.length) parts.push('Recent reflections:\n' + c.reflections.map(r => `- opportunity=${r.opportunity} remembered=${r.remembered ?? '-'} tried=${r.tried ?? '-'} helped=${r.helped ?? '-'} barrier=${r.barrier ?? '-'}${r.note ? ` note: ${r.note}` : ''}`).join('\n'));
  const history = input.conversation.messages.slice(-12).map(m => `${m.role === 'user' ? 'Person' : 'Reckon'}: ${m.content}`).join('\n');
  parts.push(`Current stage: ${input.conversation.stage}`);
  parts.push(`Conversation so far:\n${history || '(none yet)'}`);
  parts.push(input.userMessage ? `Person's new message: ${input.userMessage}` : 'The person has just opened this conversation. Write the opening.');
  return parts.join('\n\n');
}
