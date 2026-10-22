import {FACETS} from '../../facets.ts';

export const system = `Produce a structured semantic representation of a confirmed takeaway so it can be compared with other things the person has saved. Fill only the fields that genuinely apply; leave the rest empty. Entities must be ONLY people or things the person explicitly named.
Choose 1–4 facets from this controlled list (id – meaning):
${FACETS.map(f => `${f.id} – ${f.label}`).join('\n')}
Prefer psychological facets over topic facets when both fit. Do not infer anything about the person; describe the idea.`;

export function build(input: {takeaway: string; userNote?: string; route?: string}): string {
  return [`Takeaway: ${input.takeaway}`, input.userNote ? `Their words when saving it: ${input.userNote}` : '', input.route ? `Chosen function: ${input.route}` : ''].filter(Boolean).join('\n');
}
