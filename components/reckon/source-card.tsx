'use client';
import {useState} from 'react';
import {ExternalLink} from 'lucide-react';
import type {Source} from '@/lib/reckon/types';
import {platformLabel} from '@/lib/reckon/platform';

/** Shows the original where legitimately possible: provider embed, thumbnail, or the user's own text. */
export function SourceCard({source, compact = false}: {source: Source; compact?: boolean}) {
  const [embedFailed, setEmbedFailed] = useState(false);
  const height = source.platform === 'instagram' ? (compact ? 320 : source.retrieval.status === 'retrieved' ? 520 : 400) : source.platform === 'youtube' ? 220 : 400;
  const showEmbed = !!source.embedUrl && !embedFailed && !compact;
  return (
    <div className="rk-source">
      {showEmbed ? (
        <div className="embed" style={{height}}>
          <span className="placeholder">{platformLabel[source.platform]} preview, if {platformLabel[source.platform]} allows it here.</span>
          <iframe src={source.embedUrl} title={`${platformLabel[source.platform]} source`} height={height} loading="lazy" allow="encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" onError={() => setEmbedFailed(true)} />
        </div>
      ) : source.thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.thumbnailUrl} alt={source.title ?? 'Source thumbnail'} />
      ) : source.imageDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.imageDataUrl} alt="Uploaded image" />
      ) : source.manualText ? (
        <div className="text">{source.manualText}</div>
      ) : null}
      {(source.title || source.author) && !source.manualText && <div className="caption" style={{paddingTop: 12}}><strong>{source.title}</strong>{source.author ? <span className="rk-muted"> · {source.author}</span> : null}{source.publishedAt ? <span className="rk-muted"> · {source.publishedAt}</span> : null}</div>}
      {source.caption && !compact && <div className="caption">{source.caption.length > 600 ? source.caption.slice(0, 600) + '…' : source.caption}</div>}
      <div className="meta">
        <span>{platformLabel[source.platform]}{source.type !== 'page' && source.type !== 'text' ? ` ${source.type}` : ''}</span>
        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">Open original <ExternalLink size={12} style={{display: 'inline', verticalAlign: '-2px'}} /></a>}
      </div>
    </div>
  );
}
