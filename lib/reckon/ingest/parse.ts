/**
 * Pure HTML metadata parsing. Only reads what the page legitimately exposes
 * (Open Graph / standard meta tags / title / paragraph text).
 */
export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  video?: string;
  siteName?: string;
  canonical?: string;
  author?: string;
  text?: string;          // readable paragraph text, generic pages only
}

const decode = (s: string) => s
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/\s+/g, ' ').trim();

function metaContent(html: string, key: string): string | undefined {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return undefined;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content) : undefined;
}

export function parsePageMeta(html: string, opts: {readableText?: boolean} = {}): PageMeta {
  const meta: PageMeta = {
    title: metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title') ?? (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ? decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)![1]) : undefined),
    description: metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? metaContent(html, 'twitter:description'),
    image: metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image'),
    video: metaContent(html, 'og:video') ?? metaContent(html, 'og:video:url'),
    siteName: metaContent(html, 'og:site_name'),
    author: metaContent(html, 'author') ?? metaContent(html, 'article:author'),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1],
  };
  if (opts.readableText) {
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const paras = [...body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => decode(m[1].replace(/<[^>]+>/g, ' '))).filter(p => p.length > 60);
    if (paras.length) meta.text = paras.join('\n\n').slice(0, 6000);
  }
  for (const k of Object.keys(meta) as (keyof PageMeta)[]) if (!meta[k]) delete meta[k];
  return meta;
}

/** Instagram's public embed page carries the caption in a predictable block. */
export function parseInstagramEmbed(html: string): {caption?: string; username?: string; image?: string} {
  const captionBlock = html.match(/<div[^>]+class=["'][^"']*Caption[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  let caption: string | undefined;
  if (captionBlock) {
    caption = decode(captionBlock.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '));
    const username = html.match(/class=["'][^"']*CaptionUsername[^"']*["'][^>]*>([^<]+)</i)?.[1];
    if (username && caption.startsWith(username)) caption = caption.slice(username.length).trim();
  }
  const username = html.match(/class=["'][^"']*(?:Username|UsernameText)[^"']*["'][^>]*>([^<]+)</i)?.[1]?.trim();
  const image = html.match(/class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i)?.[1]
    ?? html.match(/src=["']([^"']+)["'][^>]*class=["'][^"']*EmbeddedMediaImage/i)?.[1];
  const out: {caption?: string; username?: string; image?: string} = {};
  if (caption && caption.length > 2) out.caption = caption;
  if (username) out.username = username;
  if (image) out.image = decode(image);
  return out;
}

/** Does the page look like a login wall / consent wall rather than content? */
export function looksBlocked(html: string, finalUrl?: string): string | undefined {
  if (finalUrl && /\/accounts\/login|\/login\b|consent\./i.test(finalUrl)) return 'Redirected to a login or consent page';
  if (/id=["']loginForm["']|name=["']username["'][^>]*>[\s\S]{0,400}name=["']password["']/i.test(html)) return 'Page contains a login form instead of content';
  if (/Enable JavaScript|please enable javascript/i.test(html) && html.length < 20000) return 'Page requires JavaScript rendering';
  return undefined;
}
