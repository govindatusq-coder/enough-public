/**
 * URL / platform detection. Pure, testable, no network.
 */
import type {Platform, SourceType} from './types.ts';

export interface DetectedSource {
  platform: Platform;
  type: SourceType;
  url: string;
  canonicalUrl: string;
  externalId?: string;
  /** Provider embed URL that can be shown client-side without retrieval. */
  embedUrl?: string;
}

const TRACKING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'igsh', 'igshid', 'fbclid', 'si', 'feature', '_r', '_t'];

export function normaliseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (!url.hostname.includes('.')) return null;
    TRACKING.forEach(p => url.searchParams.delete(p));
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (/\s/.test(t)) return false;
  return !!normaliseUrl(t) && /\.[a-z]{2,}/i.test(t);
}

export function detectSource(raw: string): DetectedSource | null {
  const url = normaliseUrl(raw);
  if (!url) return null;
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const path = url.pathname.replace(/\/+$/, '');

  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
    const m = path.match(/^\/(?:[^/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    if (m) {
      const code = m[2];
      const kind = m[1];
      const canonicalUrl = `https://www.instagram.com/${kind === 'reels' ? 'reel' : kind}/${code}/`;
      return {
        platform: 'instagram',
        type: kind === 'p' ? 'post' : 'reel',
        url: url.toString(),
        canonicalUrl,
        externalId: code,
        embedUrl: `https://www.instagram.com/p/${code}/embed/captioned/`,
      };
    }
    return {platform: 'instagram', type: 'page', url: url.toString(), canonicalUrl: url.toString()};
  }

  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
    const m = path.match(/\/video\/(\d+)/);
    return {
      platform: 'tiktok',
      type: 'video',
      url: url.toString(),
      canonicalUrl: url.origin + path,
      externalId: m?.[1],
      embedUrl: m ? `https://www.tiktok.com/embed/v2/${m[1]}` : undefined,
    };
  }

  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    let id: string | undefined;
    let type: SourceType = 'video';
    if (host === 'youtu.be') id = path.slice(1).split('/')[0];
    else if (path.startsWith('/shorts/')) { id = path.split('/')[2]; type = 'short'; }
    else if (path === '/watch') id = url.searchParams.get('v') ?? undefined;
    else if (path.startsWith('/embed/')) id = path.split('/')[2];
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return {
        platform: 'youtube', type,
        url: url.toString(),
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
        externalId: id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
    return {platform: 'youtube', type: 'page', url: url.toString(), canonicalUrl: url.toString()};
  }

  return {platform: 'web', type: 'page', url: url.toString(), canonicalUrl: url.toString()};
}

export const platformLabel: Record<Platform, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', web: 'Web', manual: 'Your words', upload: 'Upload',
};
