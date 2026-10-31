export const system = `The person asked "Why does Reckon think this?". Explain, in 2–4 plain sentences, what evidence led to this entry and how confident Reckon is. Point to the specific things they saved or said. Make clear it is a proposal they can correct.`;

export function build(input: {statement: string; section?: string; status: string; confidence: string; evidence: string[]}): string {
  return `Entry: ${input.statement}\nSection: ${input.section ?? 'theme'}\nStatus: ${input.status}\nConfidence: ${input.confidence}\nEvidence:\n${input.evidence.map(e => '- ' + e).join('\n')}`;
}
