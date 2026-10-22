import type {Conversation} from '../../types.ts';

export const system = `Read a short conversation and write a collaborative formulation: what matters to the person, the relevant situation, what currently happens, what they want to be different, and a plausible mechanism in plain words. Mark readyToAct true only if they have signalled they want to try something. The summary reflects this back tentatively ("It sounds like…", "If I've understood…") and invites correction.`;

export function build(input: {conversation: Conversation}): string {
  return input.conversation.messages.map(m => `${m.role === 'user' ? 'Person' : 'Reckon'}: ${m.content}`).join('\n');
}
