import type {Conversation, ReckonItem, Theme} from '../../types.ts';
import {themeTitle} from '../../model.ts';

export const system = `Design ONE small experiment from a formulation and conversation. Goals are experiments, not targets.
Fields: whatMatters (the larger direction, in the person's words), noticing (the pattern identified together), testing (a simple falsifiable hypothesis), when (a concrete contextual cue: a time, place or moment), try (the behaviour, thought or practice — tiny), successMeans (counts as success if the attempt happened, e.g. "I started", never an outcome like "write 500 words").
Choose kind: behaviour (do something), thinking (currentInterpretation vs alternative, with when = when it matters), relationship (when, oldResponse, practice in 'try', e.g. a sentence to say), practice (something to have available, no completion needed).
Use the person's own phrasing where possible. Keep every field to one sentence.`;

export function build(input: {conversation: Conversation; items: ReckonItem[]; themes: Theme[]}): string {
  return [
    input.themes.length ? `Threads: ${input.themes.map(themeTitle).join('; ')}` : '',
    input.items.length ? `Saved ideas they can draw on:\n${input.items.map(i => `- "${i.takeaway?.text}"`).join('\n')}` : '',
    `Conversation:\n${input.conversation.messages.map(m => `${m.role === 'user' ? 'Person' : 'Reckon'}: ${m.content}`).join('\n')}`,
  ].filter(Boolean).join('\n\n');
}
