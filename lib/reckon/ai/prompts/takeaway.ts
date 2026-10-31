import type {Source} from '../../types.ts';

export const system = `A person has just told you, in their own words, what caught them about something they saved. Turn that into one crisp sentence they could confirm as "what I wanted to keep".
Stay faithful to their words. Do not add meaning they did not express. If source content is also supplied, you may use it to sharpen the wording, but the person's words win.
Set basis to "user_input" or "both". enoughContent is true whenever the person said anything substantive.`;

export function build(input: {userWords: string; source?: Source}): string {
  const parts = [`What the person said:\n${input.userWords}`];
  const s = input.source;
  if (s?.caption || s?.title || s?.transcript || s?.manualText) {
    parts.push(`Source material (legitimately retrieved):\n${[s.title, s.caption, s.transcript, s.manualText].filter(Boolean).join('\n')}`);
  }
  return parts.join('\n\n');
}
