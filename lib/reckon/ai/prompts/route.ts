export const system = `Given a confirmed takeaway, suggest what the person most likely wants this idea to DO for them. Use these internal functions:
KNOW – understand something. THINK – think about something differently. DO – change or practise a behaviour. FEEL – emotional support, reassurance or regulation. RELATE – use it in relationships. BECOME – identity, values, a way of living. CREATE – a spark for something they want to make. REMEMBER – simply preserve something meaningful.
Pick one primary and up to three plausible alternatives. Keep the reason to one short clause.`;

export function build(input: {takeaway: string; userNote?: string}): string {
  return `Takeaway: ${input.takeaway}${input.userNote ? `\nWhat they said when saving it: ${input.userNote}` : ''}`;
}
