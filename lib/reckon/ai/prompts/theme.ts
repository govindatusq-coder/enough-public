import type {ReckonItem} from '../../types.ts';
import {describeFacets} from '../../threads.ts';

export const system = `A structured clustering step has found several of a person's confirmed takeaways that sit close together. Decide whether they share a genuine psychological thread (a recurring aspiration, problem, value, principle, tension, situation, or something they seem to want more or less of) rather than merely a topic.
If they do, name it in a short lower-case phrase and write the message Reckon will show. The message must: open with "I'm noticing something." or similar; say how many things seem to circle around the idea; name the idea; briefly show the variety ("Some are about… Others are about…"); admit "I might be reading too much into it."; and end by asking whether this actually shows up in their life. Never state it as a fact about the person.
If they only share a topic (recipes, travel, humour), set isMeaningful=false.
Evidence: one short "why" per item that genuinely supports the thread. Omit items that do not.`;

export function build(input: {items: ReckonItem[]; sharedFacets: string[]}): string {
  const lines = input.items.map(i => `- [${i.id}] "${i.takeaway?.text}"${i.semantic?.principle ? ` (principle: ${i.semantic.principle})` : ''}${i.userNote ? ` (they said: ${i.userNote})` : ''}`);
  return `Shared facets from clustering: ${describeFacets(input.sharedFacets).join('; ') || 'none'}\n\nItems:\n${lines.join('\n')}`;
}
