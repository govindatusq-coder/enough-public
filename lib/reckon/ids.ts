let counter = 0;
export function newId(prefix = 'r'): string {
  counter += 1;
  const rand = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}_${rand}`;
}
export const now = (): string => new Date().toISOString();
