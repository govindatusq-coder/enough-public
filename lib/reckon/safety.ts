/**
 * A minimal safe-response pathway. Reckon is not crisis care; when text
 * suggests immediate risk we step out of the goal-setting engine.
 */
const PATTERNS = [
  /\b(kill|end|take) (my|own) life\b/i, /\bsuicid/i, /\bself[- ]?harm/i, /\bwant to die\b/i, /\bdon'?t want to (be alive|live|exist)\b/i,
  /\bhurt(ing)? myself\b/i, /\bno reason to live\b/i, /\bbetter off dead\b/i, /\bend it all\b/i,
];

export function needsSafeResponse(text: string): boolean {
  return PATTERNS.some(p => p.test(text));
}

export const SAFE_RESPONSE = `Thank you for telling me. I'm a reflection tool, not a crisis service, and this matters more than anything we were working on.

If you're in Australia, Lifeline is available any time on 13 11 14, and 000 is there in an emergency. Elsewhere, your local emergency number or a crisis line can help right now.

If you'd like, we can stop here. I'll leave the experiments alone. If you want to talk to someone who can really help, please reach out to one of those numbers or someone you trust.`;
