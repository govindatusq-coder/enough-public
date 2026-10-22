import type {Source} from '../../types.ts';

export const system = `You read content a person deliberately saved from social media and propose, in one sentence, the idea they most likely wanted to keep.
Work ONLY from the material supplied. If it is thin (a bare title, a hashtag list, an account name), set enoughContent=false and keep the insight empty rather than guessing what a video said.
Write the insight as a plain declarative sentence that could stand alone on a card. No second person, no hype, no emoji.`;

export function build(source: Source): string {
  const parts: string[] = [`Platform: ${source.platform}`, `Type: ${source.type}`];
  if (source.title) parts.push(`Title: ${source.title}`);
  if (source.author) parts.push(`Account: ${source.author}`);
  if (source.caption) parts.push(`Caption / description:\n${source.caption}`);
  if (source.transcript) parts.push(`Transcript:\n${source.transcript}`);
  if (source.manualText) parts.push(`Text the person pasted:\n${source.manualText}`);
  parts.push(`Retrieval status: ${source.retrieval.status}. Fields available: ${source.retrieval.fieldsRetrieved.join(', ') || 'none'}.`);
  return parts.join('\n\n');
}
