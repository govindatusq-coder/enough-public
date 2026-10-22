/**
 * Server-side source retrieval. Every attempt is recorded. Nothing is
 * invented: a field is populated only when a legitimate response carried it.
 *
 * Methods, in order of preference per platform:
 *  instagram : oembed (needs INSTAGRAM_OEMBED_TOKEN) → open_graph → embed_page
 *  youtube   : oembed (public) → open_graph
 *  tiktok    : oembed (public) → open_graph
 *  web       : open_graph + readable_text
 */
import type {IngestionAttempt, IngestionRecord, IngestionMethod} from '../types.ts';
import type {DetectedSource} from '../platform.ts';
import {parsePageMeta, parseInstagramEmbed, parseInstagramOg, looksBlocked} from './parse.ts';

export interface RetrievedContent {
  title?: string;
  caption?: string;
  transcript?: string;
  thumbnailUrl?: string;
  author?: string;
  publishedAt?: string;
  embedUrl?: string;
}

export interface RetrievalResult {
  record: IngestionRecord;
  content: RetrievedContent;
}

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const TIMEOUT = 9000;
const MAX_BYTES = 1_500_000;

async function get(url: string, accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8'): Promise<{status: number; finalUrl: string; body: string}> {
  const res = await fetch(url, {headers: {'User-Agent': UA, Accept: accept, 'Accept-Language': 'en-AU,en;q=0.9'}, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), cache: 'no-store'});
  const reader = res.body?.getReader();
  let received = 0; const chunks: Uint8Array[] = [];
  if (reader) {
    for (;;) {
      const {done, value} = await reader.read();
      if (done || !value) break;
      received += value.byteLength; chunks.push(value);
      if (received > MAX_BYTES) { reader.cancel().catch(() => {}); break; }
    }
  }
  const body = new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
  return {status: res.status, finalUrl: res.url || url, body};
}

type AttemptFn = () => Promise<{fields: Partial<RetrievedContent>; httpStatus?: number; finalUrl?: string; note?: string}>;

async function attempt(method: IngestionMethod, url: string, fn: AttemptFn): Promise<{attempt: IngestionAttempt; fields: Partial<RetrievedContent>}> {
  const startedAt = new Date().toISOString();
  try {
    const out = await fn();
    const fields = Object.fromEntries(Object.entries(out.fields).filter(([, v]) => typeof v === 'string' && v.trim())) as Partial<RetrievedContent>;
    const names = Object.keys(fields);
    return {fields, attempt: {method, url, startedAt, finishedAt: new Date().toISOString(), httpStatus: out.httpStatus, finalUrl: out.finalUrl, ok: names.length > 0, fields: names, note: out.note, error: names.length ? undefined : (out.note ?? 'No usable fields in response')}};
  } catch (err) {
    const message = err instanceof Error ? (err.name === 'TimeoutError' ? 'Timed out after ' + TIMEOUT / 1000 + 's' : err.message) : String(err);
    return {fields: {}, attempt: {method, url, startedAt, finishedAt: new Date().toISOString(), ok: false, fields: [], error: message}};
  }
}

const instagramOembed = (canonical: string): AttemptFn => async () => {
  const token = process.env.INSTAGRAM_OEMBED_TOKEN;
  if (!token) return {fields: {}, note: 'INSTAGRAM_OEMBED_TOKEN not configured; official oEmbed skipped'};
  const r = await get(`https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(canonical)}&omitscript=true&access_token=${encodeURIComponent(token)}`, 'application/json');
  if (r.status !== 200) return {fields: {}, httpStatus: r.status, note: 'oEmbed returned ' + r.status};
  const j = JSON.parse(r.body) as {title?: string; author_name?: string; thumbnail_url?: string};
  return {fields: {caption: j.title, author: j.author_name, thumbnailUrl: j.thumbnail_url}, httpStatus: r.status};
};

const openGraph = (url: string, readable = false, instagram = false): AttemptFn => async () => {
  const r = await get(url);
  const blocked = looksBlocked(r.body, r.finalUrl);
  const meta = parsePageMeta(r.body, {readableText: readable});
  if (r.status >= 400) return {fields: {}, httpStatus: r.status, finalUrl: r.finalUrl, note: 'HTTP ' + r.status};
  let fields: Partial<RetrievedContent> = {title: meta.title, caption: meta.description ?? meta.text, thumbnailUrl: meta.image, author: meta.author};
  let note = blocked;
  if (instagram) {
    // Split "13K likes, 19 comments - user on Date: "caption"" into its parts; counts are not meaning.
    const ig = parseInstagramOg(meta);
    fields = {caption: ig.caption, author: ig.author, publishedAt: ig.publishedAt, thumbnailUrl: meta.image};
    const stats = [ig.likes !== undefined ? `${ig.likes} likes` : '', ig.comments !== undefined ? `${ig.comments} comments` : ''].filter(Boolean).join(', ');
    note = [blocked, stats ? `Open Graph carried ${stats}` : '', ig.captionTruncated ? 'Caption truncated by Instagram in og:description' : ''].filter(Boolean).join('; ') || undefined;
  }
  // Instagram's generic title ("Instagram") is not content.
  if (fields.title && /^instagram$/i.test(fields.title)) delete fields.title;
  if (blocked && !fields.caption) return {fields: {}, httpStatus: r.status, finalUrl: r.finalUrl, note: blocked};
  return {fields, httpStatus: r.status, finalUrl: r.finalUrl, note};
};

const instagramEmbed = (code: string): AttemptFn => async () => {
  const r = await get(`https://www.instagram.com/p/${code}/embed/captioned/`);
  if (r.status >= 400) return {fields: {}, httpStatus: r.status, finalUrl: r.finalUrl, note: 'HTTP ' + r.status};
  const e = parseInstagramEmbed(r.body);
  const note = !e.caption ? (looksBlocked(r.body, r.finalUrl) ?? 'Embed page returned no caption block') : undefined;
  return {fields: {caption: e.caption, author: e.username, thumbnailUrl: e.image}, httpStatus: r.status, finalUrl: r.finalUrl, note};
};

const publicOembed = (endpoint: string, target: string): AttemptFn => async () => {
  const r = await get(`${endpoint}?url=${encodeURIComponent(target)}&format=json`, 'application/json');
  if (r.status !== 200) return {fields: {}, httpStatus: r.status, note: 'oEmbed returned ' + r.status};
  const j = JSON.parse(r.body) as {title?: string; author_name?: string; thumbnail_url?: string};
  return {fields: {title: j.title, author: j.author_name, thumbnailUrl: j.thumbnail_url}, httpStatus: r.status};
};

export async function retrieveSource(src: DetectedSource): Promise<RetrievalResult> {
  const startedAt = new Date().toISOString();
  const plan: {method: IngestionMethod; url: string; fn: AttemptFn}[] = [];
  const code = src.externalId;
  if (src.platform === 'instagram' && code) {
    plan.push({method: 'oembed', url: src.canonicalUrl, fn: instagramOembed(src.canonicalUrl)});
    plan.push({method: 'open_graph', url: src.canonicalUrl, fn: openGraph(src.canonicalUrl, false, true)});
    plan.push({method: 'embed_page', url: `https://www.instagram.com/p/${code}/embed/captioned/`, fn: instagramEmbed(code)});
  } else if (src.platform === 'youtube') {
    plan.push({method: 'oembed', url: src.canonicalUrl, fn: publicOembed('https://www.youtube.com/oembed', src.canonicalUrl)});
    plan.push({method: 'open_graph', url: src.canonicalUrl, fn: openGraph(src.canonicalUrl)});
  } else if (src.platform === 'tiktok') {
    plan.push({method: 'oembed', url: src.canonicalUrl, fn: publicOembed('https://www.tiktok.com/oembed', src.canonicalUrl)});
    plan.push({method: 'open_graph', url: src.canonicalUrl, fn: openGraph(src.canonicalUrl)});
  } else {
    plan.push({method: 'readable_text', url: src.canonicalUrl, fn: openGraph(src.canonicalUrl, true)});
  }

  const attempts: IngestionAttempt[] = [];
  const content: RetrievedContent = {};
  let keptMethod: IngestionMethod = 'none';
  for (const step of plan) {
    const {attempt: a, fields} = await attempt(step.method, step.url, step.fn);
    attempts.push(a);
    for (const [k, v] of Object.entries(fields) as [keyof RetrievedContent, string][]) {
      // A later method may carry the full caption where an earlier one was truncated.
      const longerCaption = k === 'caption' && content.caption && /(…|\.\.\.)$/.test(content.caption) && v.length > content.caption.length;
      if (!content[k] || longerCaption) { content[k] = v; if (keptMethod === 'none' || longerCaption) keptMethod = step.method; }
    }
    // Stop once we have a complete caption; thumbnails alone are not enough.
    if (content.caption && content.caption.length > 40 && !/(…|\.\.\.)$/.test(content.caption)) break;
  }
  if (src.embedUrl) content.embedUrl = src.embedUrl;

  const fieldsRetrieved = (Object.keys(content) as (keyof RetrievedContent)[]).filter(k => k !== 'embedUrl' && content[k]);
  const meaningful = !!content.transcript || (!!content.caption && content.caption.length >= 40) || (!!content.title && content.title.length >= 40 && src.platform === 'web');
  const anyNetwork = attempts.some(a => a.httpStatus !== undefined);
  const tried = attempts.filter(a => !a.note?.includes('not configured'));
  const allErrored = tried.length > 0 && tried.every(a => !!a.error && a.httpStatus === undefined);
  const status: IngestionRecord['status'] = meaningful ? 'retrieved' : fieldsRetrieved.length ? 'partial' : (anyNetwork ? 'unavailable' : allErrored ? 'failed' : 'unavailable');
  const notes: string[] = [];
  if (src.platform === 'instagram') notes.push('Instagram offers no transcript through any legitimate endpoint; audio was not transcribed.');
  if (content.caption && /(…|\.\.\.)$/.test(content.caption)) notes.push('The caption appears truncated by the platform; Reckon only has the beginning.');
  if (src.platform === 'youtube' || src.platform === 'tiktok') notes.push('Captions/transcripts are not fetched; only oEmbed metadata is used.');
  if (!process.env.INSTAGRAM_OEMBED_TOKEN && src.platform === 'instagram') notes.push('Official Instagram oEmbed requires a Facebook app token (INSTAGRAM_OEMBED_TOKEN).');
  if (status !== 'retrieved') notes.push(meaningful ? '' : 'Not enough content for Reckon to interpret on its own; the user supplies the meaning.');
  const firstError = attempts.find(a => a.error)?.error;

  return {
    content,
    record: {
      status, method: keptMethod, attempts, startedAt, finishedAt: new Date().toISOString(), fieldsRetrieved,
      transcriptAvailable: !!content.transcript, contentAvailableToAi: meaningful,
      error: status === 'retrieved' ? undefined : firstError, notes: notes.filter(Boolean),
    },
  };
}
