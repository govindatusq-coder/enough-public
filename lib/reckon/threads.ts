/**
 * Find the Thread — structured clustering across user-confirmed meanings.
 *
 * Step 1: each confirmed Reckon becomes a sparse vector of facets (weighted)
 *         plus tokens from its principle / desired change / takeaway.
 * Step 2: pairwise cosine similarity.
 * Step 3: average-linkage agglomeration above a threshold.
 * Step 4: candidates are handed to the LLM (or the fallback) to be
 *         interpreted as a cautious, human-readable theme.
 *
 * Rejected themes are remembered by fingerprint and not re-proposed.
 */
import type {ReckonItem, Theme} from './types.ts';
import {detectFacets, facetById, tokens} from './facets.ts';

export interface ItemVector {
  itemId: string;
  facets: string[];
  weights: Map<string, number>;
}

export interface CandidateCluster {
  itemIds: string[];
  sharedFacets: string[];
  score: number;          // mean pairwise similarity
}

export function itemText(item: ReckonItem): string {
  const s = item.semantic;
  return [item.takeaway?.text, s?.principle, s?.desiredChange, s?.value, s?.behavioural, s?.cognitive, s?.interpersonal, s?.emotional].filter(Boolean).join('. ');
}

export function vectorise(item: ReckonItem): ItemVector {
  const weights = new Map<string, number>();
  const facets = item.semantic?.facets?.length ? item.semantic.facets : detectFacets(itemText(item));
  facets.forEach((f, i) => weights.set('facet:' + f, i === 0 ? 3 : 2));
  for (const t of tokens(itemText(item))) weights.set('tok:' + t, (weights.get('tok:' + t) ?? 0) + 0.6);
  return {itemId: item.id, facets, weights};
}

export function cosine(a: ItemVector, b: ItemVector): number {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a.weights) { na += v * v; const w = b.weights.get(k); if (w) dot += v * w; }
  for (const v of b.weights.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function findCandidateClusters(items: ReckonItem[], opts: {threshold?: number; minSize?: number} = {}): CandidateCluster[] {
  const threshold = opts.threshold ?? 0.3;
  const minSize = opts.minSize ?? 3;
  const vectors = items.filter(i => i.takeaway).map(vectorise);
  const n = vectors.length;
  if (n < 2) return [];
  const sim: number[][] = vectors.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) sim[i][j] = sim[j][i] = cosine(vectors[i], vectors[j]);

  // Average-linkage agglomerative clustering.
  let clusters: number[][] = vectors.map((_, i) => [i]);
  const linkage = (a: number[], b: number[]) => a.reduce((s, i) => s + b.reduce((t, j) => t + sim[i][j], 0), 0) / (a.length * b.length);
  for (;;) {
    let best = -1, bi = -1, bj = -1;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      const l = linkage(clusters[i], clusters[j]);
      if (l > best) { best = l; bi = i; bj = j; }
    }
    if (best < threshold || bi < 0) break;
    const merged = [...clusters[bi], ...clusters[bj]];
    clusters = clusters.filter((_, k) => k !== bi && k !== bj).concat([merged]);
  }

  return clusters
    .filter(c => c.length >= Math.min(minSize, Math.max(2, n >= 4 ? 3 : 2)))
    .map(c => {
      const counts = new Map<string, number>();
      c.forEach(i => vectors[i].facets.forEach(f => counts.set(f, (counts.get(f) ?? 0) + 1)));
      const shared = [...counts.entries()].filter(([, k]) => k >= Math.max(2, Math.ceil(c.length / 2))).sort((a, b) => b[1] - a[1]).map(([f]) => f);
      const pairs: number[] = [];
      for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) pairs.push(sim[c[i]][c[j]]);
      const score = pairs.length ? pairs.reduce((a, b) => a + b, 0) / pairs.length : 0;
      return {itemIds: c.map(i => vectors[i].itemId), sharedFacets: shared, score};
    })
    .filter(c => c.sharedFacets.some(f => facetById(f)?.kind !== 'topic') || c.score > 0.6)
    .sort((a, b) => b.score - a.score);
}

/** Drop candidates that match an existing proposed/confirmed theme, or a rejected one. */
export function novelClusters(candidates: CandidateCluster[], themes: Theme[]): CandidateCluster[] {
  return candidates.filter(c => !themes.some(t => overlap(c.itemIds, t.evidence.map(e => e.itemId)) >= 0.7));
}

export function overlap(a: string[], b: string[]): number {
  const sa = new Set(a), sb = new Set(b);
  let inter = 0; sa.forEach(x => { if (sb.has(x)) inter++; });
  return inter / Math.max(1, Math.min(sa.size, sb.size));
}

export function describeFacets(ids: string[]): string[] {
  return ids.map(id => facetById(id)?.label ?? id.replace(/_/g, ' '));
}
