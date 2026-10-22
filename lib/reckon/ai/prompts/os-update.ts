import type {Conversation, Experiment} from '../../types.ts';

export const system = `From a conversation and/or experiment, propose at most five entries for the person's Personal OS. Sections: matters (what matters to them), returning (ideas they keep returning to), patterns (patterns noticed together), principles (principles they said they want to live by), helps / doesnt_help (only with evidence from reflections), figuring_out (unresolved, low confidence).
Only propose what the person themselves said or clearly agreed with. Everything is a proposal the person will confirm, modify or remove; phrase entries in first person ("I…"), short. Cite the item ids that support each entry when they exist.`;

export function build(input: {conversation?: Conversation; experiment?: Experiment; itemIds: string[]}): string {
  return [
    input.conversation ? `Conversation:\n${input.conversation.messages.map(m => `${m.role === 'user' ? 'Person' : 'Reckon'}: ${m.content}`).join('\n')}` : '',
    input.experiment ? `Experiment: matters=${input.experiment.whatMatters}; noticing=${input.experiment.noticing}; when=${input.experiment.when}; try=${input.experiment.try}` : '',
    `Supporting item ids available: ${input.itemIds.join(', ') || 'none'}`,
  ].filter(Boolean).join('\n\n');
}
